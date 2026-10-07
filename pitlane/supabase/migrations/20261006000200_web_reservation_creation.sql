-- Incremental extension of the frozen schema_base. No catalog/availability DDL.
-- The two superseded reservation-engine migrations were never deployed.
alter table public.reservations
  add column idempotency_key uuid,
  add column request_fingerprint bytea,
  add constraint reservations_web_idempotency_check check (
    (idempotency_key is null and request_fingerprint is null) or
    (idempotency_key is not null and request_fingerprint is not null
      and octet_length(request_fingerprint) = 32 and channel = 'web' and user_id is not null)
  );
create unique index reservations_web_idempotency_key
  on public.reservations(user_id, idempotency_key)
  where channel = 'web' and idempotency_key is not null;

-- No browser writes, including operational profiles. Service writers must use
-- dedicated RPCs with the same slot lock before consuming/reinstating capacity.
revoke all on public.reservations, public.reservation_participants
  from public, anon, authenticated, service_role;
grant select on public.reservations, public.reservation_participants to authenticated, service_role;
create policy reservations_owner_read on public.reservations for select to authenticated
  using (user_id = (select auth.uid()));
create policy reservations_operations_read on public.reservations for select to authenticated
  using ((select public.has_role(array['staff', 'payments', 'kre_admin', 'system_admin'])));
create policy participants_reservation_read on public.reservation_participants for select to authenticated
  using (exists(select 1 from public.reservations r where r.id = reservation_id));

create function public.create_reservation(
  p_slot_id uuid,
  p_package_id uuid,
  p_participants jsonb,
  p_idempotency_key uuid,
  p_rules_accepted boolean
) returns jsonb
language plpgsql security definer set search_path = '' set row_security = off as $$
declare
  v_user uuid := auth.uid();
  v_slot public.slots%rowtype;
  v_event public.events%rowtype;
  v_package public.packages%rowtype;
  v_reservation public.reservations%rowtype;
  v_names jsonb;
  v_fingerprint bytea;
  v_now timestamptz;
  v_expires_at timestamptz;
  v_available integer;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  -- Read trusted Auth state, not user metadata or a browser/JWT flag.
  if not exists(select 1 from auth.users where id = v_user and email_confirmed_at is not null) then
    raise exception using errcode = '42501', message = 'email_verification_required';
  end if;
  -- Fresh statement snapshot after waiting for the slot lock is required.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '25001', message = 'read_committed_required';
  end if;
  if p_slot_id is null or p_package_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'invalid_identifiers';
  end if;
  if p_rules_accepted is distinct from true then
    raise exception using errcode = '22023', message = 'rules_required';
  end if;
  if p_participants is null or jsonb_typeof(p_participants) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_participants';
  end if;
  if jsonb_array_length(p_participants) not between 1 and 5 then
    raise exception using errcode = '22023', message = 'invalid_participants';
  end if;
  if exists(select 1 from jsonb_array_elements(p_participants) x where
    jsonb_typeof(x) <> 'object' or jsonb_typeof(x->'full_name') is distinct from 'string'
    or char_length(btrim(x->>'full_name', E' \t\n\r')) not between 1 and 120
    or (x - 'full_name') <> '{}'::jsonb
  ) then raise exception using errcode = '22023', message = 'invalid_participants'; end if;
  select jsonb_agg(jsonb_build_object('full_name', btrim(x->>'full_name', E' \t\n\r')) order by ord)
    into v_names from jsonb_array_elements(p_participants) with ordinality as t(x, ord);
  -- One fixed-size fingerprint preserves original order/holder and duplicates
  -- without adding position columns or copying participant PII into a payload.
  v_fingerprint := sha256(convert_to(jsonb_build_object(
    'slot_id', p_slot_id, 'package_id', p_package_id,
    'participants', v_names, 'rules_accepted', true)::text, 'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_idempotency_key::text, 0));
  select * into v_reservation from public.reservations
    where user_id = v_user and idempotency_key = p_idempotency_key and channel = 'web';
  if found then
    if v_reservation.request_fingerprint is distinct from v_fingerprint then
      raise exception using errcode = '22023', message = 'idempotency_conflict';
    end if;
  else
    -- Common writer protocol: slot UPDATE lock -> event SHARE -> package SHARE.
    select * into v_slot from public.slots where id = p_slot_id for update;
    if not found or v_slot.status <> 'available' then
      raise exception using errcode = '22023', message = 'slot_unavailable';
    end if;
    select * into v_event from public.events where id = v_slot.event_id for share;
    if not found or v_event.status <> 'open' then
      raise exception using errcode = '22023', message = 'event_unavailable';
    end if;
    select * into v_package from public.packages where id = p_package_id for share;
    if not found or not v_package.active or v_package.eligibility <> 'none'
      or v_package.spots not in (1, 5)
      or (v_package.valid_from is not null and v_event.date < v_package.valid_from)
      or (v_package.valid_to is not null and v_event.date > v_package.valid_to) then
      raise exception using errcode = '22023', message = 'package_unavailable';
    end if;
    if jsonb_array_length(v_names) <> v_package.spots then
      raise exception using errcode = '22023', message = 'participant_count_mismatch';
    end if;
    -- Separate SQL statement AFTER the lock: the official STABLE function sees
    -- earlier committed holders at READ COMMITTED. Never duplicate its formula.
    select public.slot_available_spots(p_slot_id) into v_available;
    if v_available is null or v_available < v_package.spots then
      raise exception using errcode = 'P0001', message = 'insufficient_capacity';
    end if;
    v_now := clock_timestamp();
    -- End strictly before the slot, without a rounded/minimum booking window.
    v_expires_at := least(v_now + interval '15 minutes', v_slot.starts_at - interval '1 microsecond');
    if v_expires_at <= v_now
      or (v_slot.starts_at at time zone 'America/El_Salvador')::date <> v_event.date then
      raise exception using errcode = '22023', message = 'slot_unavailable';
    end if;
    -- Preserve schema_base defaults for code/qr_token.
    insert into public.reservations(user_id, slot_id, package_id, spots, amount,
      status, channel, expires_at, rules_accepted_at, created_by, created_at,
      idempotency_key, request_fingerprint)
    values(v_user,
      p_slot_id, p_package_id, v_package.spots, v_package.price, 'pending_payment', 'web',
      v_expires_at, v_now, v_user, v_now, p_idempotency_key, v_fingerprint)
    returning * into v_reservation;
    insert into public.reservation_participants(reservation_id, full_name, is_holder, first_ride_participant_id)
      select v_reservation.id, x->>'full_name', ord = 1, null
      from jsonb_array_elements(v_names) with ordinality as t(x, ord);
  end if;
  return jsonb_build_object('id', v_reservation.id, 'code', v_reservation.code,
    'status', v_reservation.status, 'amount', v_reservation.amount,
    'spots', v_reservation.spots, 'expiresAt', v_reservation.expires_at);
end;
$$;
revoke all on function public.create_reservation(uuid, uuid, jsonb, uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.create_reservation(uuid, uuid, jsonb, uuid, boolean) to authenticated;
