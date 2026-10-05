-- Andrés Montes: administración KRE sobre el schema congelado.
-- No agrega tablas ni columnas. No modifica la fórmula de disponibilidad.
-- Ejecutar primero BEGIN; + este archivo + ROLLBACK; en SQL Editor.
-- Medianoche representa el final del día operativo.
alter table public.events drop constraint events_check;
alter table public.events add constraint events_operating_hours_check check (end_time > start_time or (end_time = '00:00'::time and start_time > '00:00'::time));

create index if not exists events_date_status_idx on public.events(date,status);

create policy "KRE admins administran eventos" on public.events for all to authenticated
 using ((select public.has_role(array['kre_admin','system_admin'])))
 with check ((select public.has_role(array['kre_admin','system_admin'])));
create policy "KRE admins administran tandas" on public.slots for all to authenticated
 using ((select public.has_role(array['kre_admin','system_admin'])))
 with check ((select public.has_role(array['kre_admin','system_admin'])));
create policy "KRE admins administran paquetes" on public.packages for all to authenticated
 using ((select public.has_role(array['kre_admin','system_admin'])))
 with check ((select public.has_role(array['kre_admin','system_admin'])));
-- Los estados cerrados/cancelados se muestran sin permitir reservar.
create policy "Calendario muestra fechas cerradas y canceladas" on public.events for select to anon,authenticated
 using (status in ('closed','cancelled'));
create policy "Calendario muestra tandas de fechas cerradas y canceladas" on public.slots for select to anon,authenticated
 using (exists(select 1 from public.events e where e.id=event_id and e.status in ('closed','cancelled')));

create function public.kre_guard_event() returns trigger language plpgsql security definer set search_path='' as $$
declare start_at timestamptz; end_at timestamptz;
begin
 if TG_OP='DELETE' then raise exception 'Conserva el historial: cancela la fecha en lugar de eliminarla.'; end if;
 -- Serializa ediciones del calendario para evitar dos fechas solapadas concurrentes.
 perform pg_advisory_xact_lock(610051,1);
 if TG_OP='INSERT' or (new.date,new.start_time,new.end_time,new.slot_minutes,new.buffer_minutes) is distinct from (old.date,old.start_time,old.end_time,old.slot_minutes,old.buffer_minutes) then
   if new.date < (now() at time zone 'America/El_Salvador')::date then raise exception 'No se pueden crear o reprogramar fechas pasadas.'; end if;
   if new.slot_minutes<>10 or new.buffer_minutes not between 0 and 60 then raise exception 'Tandas de 10 minutos; buffer entre 0 y 60.'; end if;
   if TG_OP='UPDATE' and exists(select 1 from public.slots where event_id=old.id) then raise exception 'La fecha ya tiene tandas. Edita sus tandas o crea otra fecha.'; end if;
 end if;
 start_at := (new.date+new.start_time) at time zone 'America/El_Salvador';
 end_at := (new.date+new.end_time+case when new.end_time='00:00'::time then interval '1 day' else interval '0' end) at time zone 'America/El_Salvador';
 if end_at-start_at<interval '10 minutes' then raise exception 'El horario debe permitir al menos una tanda.'; end if;
 if new.status<>'cancelled' and exists(
   select 1 from public.events e where e.id<>new.id and e.status<>'cancelled' and
   tstzrange((e.date+e.start_time) at time zone 'America/El_Salvador',
     (e.date+e.end_time+case when e.end_time='00:00'::time then interval '1 day' else interval '0' end) at time zone 'America/El_Salvador','[)') && tstzrange(start_at,end_at,'[)')
 ) then raise exception 'El horario se solapa con otra fecha KRE.'; end if;
 if new.status='open' and (TG_OP='INSERT' or old.status is distinct from new.status) then
   if start_at<=now() then raise exception 'No se puede publicar una fecha que ya comenzó.'; end if;
   if not exists(select 1 from public.slots where event_id=new.id and status='available') then raise exception 'Genera o habilita al menos una tanda antes de publicar.'; end if;
 end if;
 return new;
end $$;
create trigger kre_guard_event before insert or update or delete on public.events for each row execute function public.kre_guard_event();

create function public.kre_guard_slot() returns trigger language plpgsql security definer set search_path='' as $$
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
   -- Valida el cambio contra la única función compartida; no reconstruye reservas.
   existing_available:=public.slot_available_spots(old.id);
   if existing_available + (new.capacity-old.capacity) - (new.track_reserved_spots-old.track_reserved_spots)<0 then raise exception 'La capacidad propuesta afecta cupos ya reservados.'; end if;
   if new.capacity<old.capacity and exists(select 1 from public.reservations where slot_id=old.id and status in ('attended','no_show')) then raise exception 'No reduzcas capacidad de una tanda con historial de asistencia.'; end if;
 end if;
 return new;
end $$;
create trigger kre_guard_slot before insert or update or delete on public.slots for each row execute function public.kre_guard_slot();

create function public.kre_event_status_slots() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status is distinct from old.status then
   if new.status='cancelled' then update public.slots set status='cancelled' where event_id=new.id and status<>'cancelled';
   elsif new.status='closed' then update public.slots set status='closed' where event_id=new.id and status in ('available','full');
   end if;
 end if;
 return new;
end $$;
create trigger kre_event_status_slots after update of status on public.events for each row execute function public.kre_event_status_slots();

create function public.kre_guard_package() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then raise exception 'Desactiva el paquete para conservar el historial.'; end if;
 if new.name not in ('Individual','Segunda vuelta','Friends Combo') or new.duration_minutes<>10 or
    new.spots<>(case when new.name='Friends Combo' then 5 else 1 end) or
    new.eligibility<>(case when new.name='Segunda vuelta' then 'requires_first_ride' else 'none' end) then
   raise exception 'Solo Individual (1), Segunda vuelta (1, con primera vuelta completada) y Friends Combo (5), de 10 minutos.';
 end if;
 if TG_OP='UPDATE' and (new.name,new.spots,new.duration_minutes,new.eligibility) is distinct from (old.name,old.spots,old.duration_minutes,old.eligibility) and exists(select 1 from public.reservations where package_id=old.id) then raise exception 'El paquete tiene reservas: crea una nueva versión y desactiva esta.'; end if;
 return new;
end $$;
create trigger kre_guard_package before insert or update or delete on public.packages for each row execute function public.kre_guard_package();

create function public.kre_generate_slots(p_event_id uuid,p_capacity int default 10,p_track_reserved_spots int default 0)
returns int language plpgsql security invoker set search_path='' as $$
declare e public.events; cursor_at timestamptz; final_at timestamptz; inserted_count int:=0;
begin
 if not public.has_role(array['kre_admin','system_admin']) then raise exception 'Solo KRE Admin puede generar tandas.' using errcode='42501'; end if;
 if p_capacity is null or p_capacity not between 1 and 10 or p_track_reserved_spots is null or p_track_reserved_spots not between 0 and p_capacity then raise exception 'Capacidad o reserva para pista inválida.'; end if;
 select * into e from public.events where id=p_event_id for update;
 if not found then raise exception 'Fecha inexistente.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event_id::text,0));
 if e.status<>'draft' then raise exception 'Genera las tandas mientras la fecha está en borrador.'; end if;
 if exists(select 1 from public.slots where event_id=e.id) then raise exception 'Esta fecha ya tiene tandas. No se generaron duplicados.'; end if;
 cursor_at:=(e.date+e.start_time) at time zone 'America/El_Salvador';
 final_at:=(e.date+e.end_time+case when e.end_time='00:00'::time then interval '1 day' else interval '0' end) at time zone 'America/El_Salvador';
 if cursor_at<=now() then raise exception 'El horario ya comenzó.'; end if;
 while cursor_at+interval '10 minutes'<=final_at loop
   insert into public.slots(event_id,starts_at,ends_at,capacity,track_reserved_spots)
     values(e.id,cursor_at,cursor_at+interval '10 minutes',p_capacity,p_track_reserved_spots);
   inserted_count:=inserted_count+1;
   cursor_at:=cursor_at+make_interval(mins=>10+e.buffer_minutes);
 end loop;
 if inserted_count=0 then raise exception 'El horario no permite generar tandas.'; end if;
 return inserted_count;
end $$;
revoke all on function public.kre_generate_slots(uuid,int,int) from public,anon;
grant execute on function public.kre_generate_slots(uuid,int,int) to authenticated;
revoke all on function public.kre_guard_event(), public.kre_guard_slot(), public.kre_event_status_slots(), public.kre_guard_package() from public;
