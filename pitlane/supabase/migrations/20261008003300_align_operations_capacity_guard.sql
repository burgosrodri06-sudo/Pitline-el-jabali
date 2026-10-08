-- Rodrigo: fix PR #14 review, 5 track + 5 web must not fit capacity 8.
-- Incremental migration: schema_base and all previously published migrations
-- remain unchanged. The public RPC/view contract remains the same.

-- Canonical web balance for both current availability and a proposed slot edit.
-- Internal only: the caller holds the slot lock for capacity-changing writes.
create function public.operations_slot_web_balance(
  p_slot_id uuid, p_capacity integer, p_track_reserved_spots integer
) returns integer
language sql stable security definer set search_path='' as $$
  select p_capacity
    - coalesce(sum(r.spots) filter (where r.channel='web'),0)::integer
    - greatest(p_track_reserved_spots,
        coalesce(sum(r.spots) filter (where r.channel='track'),0)::integer)
  from public.reservations r
  where r.slot_id=p_slot_id and (
    r.status in ('payment_review','paid','attended','no_show')
    or (r.status='pending_payment' and r.expires_at>statement_timestamp())
  );
$$;
revoke all on function public.operations_slot_web_balance(uuid,integer,integer)
  from public,anon,authenticated,service_role;

-- Preserve nonnegative public availability and existing grants.
create or replace function public.slot_available_spots(p_slot_id uuid) returns integer
language sql stable security definer set search_path='' as $$
  select greatest(0,public.operations_slot_web_balance(s.id,s.capacity,s.track_reserved_spots))
  from public.slots s where s.id=p_slot_id;
$$;

-- Preserve the calendar, overlap, historical and authorization protections.
create or replace function public.kre_guard_slot() returns trigger language plpgsql security definer set search_path='' as $$
declare event_row public.events; start_at timestamptz; end_at timestamptz; existing_available int;
begin
 if TG_OP='DELETE' then raise exception 'Conserva el historial: cancela la tanda en lugar de eliminarla.'; end if;
 -- Bloqueo por evento, compartido con la generación atómica.
 perform pg_advisory_xact_lock(hashtextextended(new.event_id::text,0));
 select * into event_row from public.events where id=new.event_id;
 if not found then raise exception 'Fecha inexistente.'; end if;
 if TG_OP='UPDATE' and new.event_id<>old.event_id then raise exception 'No se puede mover una tanda a otra fecha.'; end if;
 start_at:=(event_row.date+event_row.start_time) at time zone 'America/El_Salvador';
 end_at:=(event_row.date+event_row.end_time+case when event_row.end_time='00:00'::time then interval '1 day' else interval '0' end) at time zone 'America/El_Salvador';
 if new.ends_at-new.starts_at<>interval '10 minutes' or new.starts_at<start_at or new.ends_at>end_at then raise exception 'La tanda debe durar 10 minutos y quedar dentro de la fecha.'; end if;
 if TG_OP='INSERT' or new.starts_at is distinct from old.starts_at then
   if new.starts_at<=now() then raise exception 'No se pueden crear o mover tandas al pasado.'; end if;
   if TG_OP='UPDATE' and exists(select 1 from public.reservations where slot_id=old.id) then raise exception 'La tanda tiene reservas: su horario está protegido.'; end if;
 end if;
 if new.status='available' and event_row.status='cancelled' then raise exception 'No se puede abrir una tanda de una fecha cancelada.'; end if;
 if new.status<>'cancelled' and exists(select 1 from public.slots s where s.event_id=new.event_id and s.id<>new.id and s.status<>'cancelled' and tstzrange(s.starts_at,s.ends_at+make_interval(mins=>event_row.buffer_minutes),'[)') && tstzrange(new.starts_at,new.ends_at+make_interval(mins=>event_row.buffer_minutes),'[)')) then raise exception 'La tanda se solapa con otra o no respeta el buffer.'; end if;
 if TG_OP='UPDATE' and (new.capacity,new.track_reserved_spots) is distinct from (old.capacity,old.track_reserved_spots) then
   -- UPDATE already holds the slot row lock used by reservation writers.
   -- This VOLATILE trigger reads a fresh statement snapshot after that wait.
   if current_setting('transaction_isolation') <> 'read committed' then
     raise exception using errcode='25001', message='operations_read_committed_required';
   end if;
   -- Evaluate the proposed capacity/reserve, not a delta of the old balance.
   -- Keep the raw negative value: a UI clamp must never authorize overbooking.
   existing_available:=public.operations_slot_web_balance(old.id,new.capacity,new.track_reserved_spots);
   if existing_available<0 then raise exception 'La capacidad propuesta afecta cupos ya reservados.'; end if;
   if new.capacity<old.capacity and exists(select 1 from public.reservations where slot_id=old.id and status in ('attended','no_show')) then raise exception 'No reduzcas capacidad de una tanda con historial de asistencia.'; end if;
 end if;
 return new;
end $$;
