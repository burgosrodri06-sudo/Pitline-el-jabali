create table public.reservation_settings (
  id boolean primary key default true check (id),
  hold_minutes integer not null default 15 check (hold_minutes between 1 and 60),
  -- Database-owner configuration only. Both defaults fail closed for test waivers.
  deployment_environment text not null default 'production'
    check (deployment_environment in ('production', 'development', 'staging')),
  waiver_mode text not null default 'official' check (waiver_mode in ('official', 'test')),
  -- NULL disables NEW reservations. DEV-ONLY is a reserved test namespace, not legal content.
  active_waiver_version text check (
    active_waiver_version = btrim(active_waiver_version)
    and char_length(active_waiver_version) between 1 and 120
  ),
  constraint waiver_environment_guard check (
    (waiver_mode = 'official' and (active_waiver_version is null or upper(active_waiver_version) not like 'DEV-ONLY%'))
    or (waiver_mode = 'test' and deployment_environment in ('development', 'staging')
      and (active_waiver_version is null or active_waiver_version like 'DEV-ONLY%'))
  )
);
insert into public.reservation_settings(id) values (true);
alter table public.reservation_settings enable row level security;
revoke all on public.reservation_settings from public, anon, authenticated, service_role;
grant select on public.reservation_settings to authenticated;
create policy settings_admin_read on public.reservation_settings for select to authenticated
  using (public.has_role(array['system_admin']));

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  slot_id uuid not null references public.slots(id) on delete restrict,
  package_id uuid not null references public.packages(id) on delete restrict,
  status text not null default 'pending_payment' check (status in (
    'pending_payment', 'payment_review', 'paid', 'cancelled', 'expired', 'attended', 'no_show'
  )),
  package_name_snapshot text not null check (char_length(btrim(package_name_snapshot)) between 1 and 120),
  price_cents_snapshot integer not null check (price_cents_snapshot > 0),
  spots_snapshot integer not null check (spots_snapshot between 1 and 10),
  currency text not null default 'USD' check (currency = 'USD'),
  expires_at timestamptz not null,
  idempotency_key uuid not null,
  request_payload jsonb not null check (jsonb_typeof(request_payload) = 'object'),
  waiver_version text not null check (char_length(btrim(waiver_version)) between 1 and 120),
  waiver_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  unique(user_id, idempotency_key)
);
create index reservations_slot_status on public.reservations(slot_id, status);
create index reservations_owner_created on public.reservations(user_id, created_at desc);
create index reservations_pending_expiry on public.reservations(expires_at) where status = 'pending_payment';

create table public.reservation_participants (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  position integer not null check (position between 1 and 10),
  full_name text not null check (full_name = btrim(full_name) and char_length(full_name) between 1 and 120),
  unique(reservation_id, position)
);

create function public.protect_reservation_snapshot() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
    raise exception using errcode = '23514', message = 'immutable_reservation_snapshot';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger reservation_snapshot_immutable before update on public.reservations
  for each row execute function public.protect_reservation_snapshot();

create function public.check_reservation_participants() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_ids uuid[];
  v_spots integer;
  v_count integer;
  v_max integer;
begin
  if tg_table_name = 'reservations' then
    v_ids := array[new.id];
  elsif tg_op = 'DELETE' then
    v_ids := array[old.reservation_id];
  elsif tg_op = 'UPDATE' then
    v_ids := array[old.reservation_id, new.reservation_id];
  else
    v_ids := array[new.reservation_id];
  end if;
  foreach v_id in array v_ids loop
    select spots_snapshot into v_spots from public.reservations where id = v_id;
    if found then
      select count(*), max(position) into v_count, v_max from public.reservation_participants where reservation_id = v_id;
      if v_count <> v_spots or v_max <> v_spots then
        raise exception using errcode = '23514', message = 'participant_count_mismatch';
      end if;
    end if;
  end loop;
  return null;
end;
$$;
create constraint trigger reservation_participants_complete after insert or update on public.reservations
  deferrable initially deferred for each row execute function public.check_reservation_participants();
create constraint trigger participants_complete after insert or update or delete on public.reservation_participants
  deferrable initially deferred for each row execute function public.check_reservation_participants();
revoke all on function public.protect_reservation_snapshot(), public.check_reservation_participants() from public, anon, authenticated, service_role;

alter table public.reservations enable row level security;
alter table public.reservation_participants enable row level security;
revoke all on public.reservations, public.reservation_participants from public, anon, authenticated;
grant select on public.reservations, public.reservation_participants to authenticated;
create policy reservations_owner on public.reservations for select to authenticated using (user_id = (select auth.uid()));
create policy reservations_operations on public.reservations for select to authenticated
  using (public.has_role(array['staff', 'payments', 'kre_admin', 'system_admin']));
create policy participants_visible_reservation on public.reservation_participants for select to authenticated using (
  exists(select 1 from public.reservations r where r.id = reservation_id)
);

create function public.create_reservation(
  p_slot_id uuid,
  p_package_id uuid,
  p_participants jsonb,
  p_idempotency_key uuid,
  p_waiver_accepted boolean,
  p_waiver_version text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_slot public.slots%rowtype;
  v_event public.events%rowtype;
  v_package public.packages%rowtype;
  v_settings public.reservation_settings%rowtype;
  v_reservation public.reservations%rowtype;
  v_names jsonb;
  v_payload jsonb;
  v_now timestamptz;
  v_expires_at timestamptz;
  v_consumed integer;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'authentication_required'; end if;
  -- READ COMMITTED is the supported PostgREST contract. Do not count stale snapshots.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '25001', message = 'read_committed_required';
  end if;
  if p_slot_id is null or p_package_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'invalid_identifiers';
  end if;
  if p_waiver_accepted is distinct from true or p_waiver_version is null or char_length(btrim(p_waiver_version)) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'waiver_required';
  end if;
  if p_participants is null or jsonb_typeof(p_participants) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_participants';
  end if;
  if jsonb_array_length(p_participants) not between 1 and 10 then
    raise exception using errcode = '22023', message = 'invalid_participants';
  end if;
  if exists(select 1 from jsonb_array_elements(p_participants) x where
    jsonb_typeof(x) <> 'object' or jsonb_typeof(x->'full_name') is distinct from 'string'
    or char_length(btrim(x->>'full_name', E' \t\n\r')) not between 1 and 120
    or (x - 'full_name') <> '{}'::jsonb
  ) then raise exception using errcode = '22023', message = 'invalid_participants'; end if;
  select jsonb_agg(jsonb_build_object('full_name', btrim(x->>'full_name', E' \t\n\r')) order by ord)
    into v_names from jsonb_array_elements(p_participants) with ordinality as t(x, ord);
  v_payload := jsonb_build_object('slot_id', p_slot_id, 'package_id', p_package_id,
    'participants', v_names, 'waiver_version', p_waiver_version);
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':' || p_idempotency_key::text, 0));
  select * into v_reservation from public.reservations where user_id = v_user and idempotency_key = p_idempotency_key;
  if found then
    if v_reservation.request_payload <> v_payload then
      raise exception using errcode = '22023', message = 'idempotency_conflict';
    end if;
  else
    -- Event first, then slot, package, settings: same order for future writers.
    select e.* into v_event from public.events e join public.slots s on s.event_id = e.id
      where s.id = p_slot_id for share of e;
    if not found or v_event.status <> 'published' then
      raise exception using errcode = '22023', message = 'event_unavailable';
    end if;
    select * into v_slot from public.slots where id = p_slot_id for update;
    if not found or v_slot.event_id <> v_event.id or v_slot.status <> 'open' then
      raise exception using errcode = '22023', message = 'slot_unavailable';
    end if;
    select * into v_package from public.packages where id = p_package_id for share;
    if not found or not v_package.active or v_package.booking_type <> 'initial' then
      raise exception using errcode = '22023', message = 'package_unavailable';
    end if;
    if jsonb_array_length(v_names) <> v_package.spots_required then
      raise exception using errcode = '22023', message = 'participant_count_mismatch';
    end if;
    select * into v_settings from public.reservation_settings where id for share;
    if not found or v_settings.active_waiver_version is null or v_settings.active_waiver_version <> p_waiver_version then
      raise exception using errcode = '22023', message = 'waiver_unavailable';
    end if;
    v_now := clock_timestamp();
    if v_slot.starts_at <= v_now or (v_slot.starts_at at time zone 'America/El_Salvador')::date <> v_event.event_date then
      raise exception using errcode = '22023', message = 'slot_unavailable';
    end if;
    select coalesce(sum(spots_snapshot), 0) into v_consumed from public.reservations
      where slot_id = p_slot_id and (
        (status = 'pending_payment' and expires_at > v_now)
        or status in ('payment_review', 'paid', 'attended', 'no_show')
      );
    if v_consumed + v_package.spots_required > v_slot.capacity - v_slot.track_reserved_capacity then
      raise exception using errcode = 'P0001', message = 'insufficient_capacity';
    end if;
    update public.slots set allocation_version = allocation_version + 1 where id = p_slot_id;
    -- Refresh after any processing/trigger delay. Use the SAME instant for the
    -- comparison, created_at and hold calculation; never round to seconds.
    v_now := clock_timestamp();
    v_expires_at := least(v_now + make_interval(mins => v_settings.hold_minutes), v_slot.starts_at);
    if v_expires_at <= v_now then
      raise exception using errcode = '22023', message = 'slot_unavailable';
    end if;
    insert into public.reservations(user_id, slot_id, package_id, package_name_snapshot,
      price_cents_snapshot, spots_snapshot, expires_at, idempotency_key, request_payload,
      waiver_version, waiver_accepted_at, created_at, updated_at)
    values(v_user, p_slot_id, p_package_id, v_package.name, v_package.price_cents, v_package.spots_required,
      v_expires_at,
      p_idempotency_key, v_payload, p_waiver_version, v_now, v_now, v_now)
    returning * into v_reservation;
    insert into public.reservation_participants(reservation_id, position, full_name)
      select v_reservation.id, ord::integer, x->>'full_name'
      from jsonb_array_elements(v_names) with ordinality as t(x, ord);
  end if;
  return jsonb_build_object('id', v_reservation.id, 'status', v_reservation.status,
    'price_cents_snapshot', v_reservation.price_cents_snapshot, 'spots_snapshot', v_reservation.spots_snapshot,
    'currency', v_reservation.currency, 'expires_at', v_reservation.expires_at);
end;
$$;
revoke all on function public.create_reservation(uuid, uuid, jsonb, uuid, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.create_reservation(uuid, uuid, jsonb, uuid, boolean, text) to authenticated;

create function public.expire_reservations(p_batch_size integer default 500) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if p_batch_size is null or p_batch_size not between 1 and 5000 then
    raise exception using errcode = '22023', message = 'invalid_batch_size';
  end if;
  with due as (
    select id from public.reservations where status = 'pending_payment' and expires_at <= clock_timestamp()
    order by expires_at, id limit p_batch_size for update skip locked
  ) update public.reservations r set status = 'expired' from due where r.id = due.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.expire_reservations(integer) from public, anon, authenticated, service_role;
grant execute on function public.expire_reservations(integer) to service_role;

-- Aggregate public availability without exposing owners or participant names.
-- SECURITY INVOKER would either fail for anon or undercount other users' holds.
-- Keep a fixed, argument-free aggregate. row_security=off fails rather than
-- silently filtering reservations if a future owner loses its RLS bypass.
create function public.get_slot_availability() returns table(slot_id uuid, available_spots integer)
language sql stable security definer set search_path = '' set row_security = off as $$
  select s.id, greatest(0, s.capacity - s.track_reserved_capacity - coalesce((
    select sum(r.spots_snapshot)::integer from public.reservations r where r.slot_id = s.id and (
      (r.status = 'pending_payment' and r.expires_at > statement_timestamp())
      or r.status in ('payment_review', 'paid', 'attended', 'no_show')
    )
  ), 0))
  from public.slots s join public.events e on e.id = s.event_id
  where e.status = 'published' and s.status = 'open' and s.starts_at > statement_timestamp();
$$;
revoke all on function public.get_slot_availability() from public, anon, authenticated, service_role;
grant execute on function public.get_slot_availability() to anon, authenticated;
