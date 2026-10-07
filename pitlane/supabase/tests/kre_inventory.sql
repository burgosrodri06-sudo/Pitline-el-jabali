-- Ejecutar después de la migración como postgres en SQL Editor.
-- Toda la prueba se revierte; no deja fechas, tandas ni reservas.
begin;
do $$
declare e uuid; s uuid; p uuid; n int; available int; admin_id uuid;
begin
 select id into admin_id from public.profiles where role='kre_admin' limit 1;
 if admin_id is null then raise exception 'Se necesita un perfil kre_admin para la prueba.'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 insert into public.events(date,start_time,end_time) values('2099-12-31','18:00','00:00') returning id into e;
 n:=public.kre_generate_slots(e,10,2);
 if n<>36 then raise exception 'Esperadas 36 tandas; recibidas %',n; end if;
 update public.events set status='open' where id=e;
 select id into s from public.slots where event_id=e order by starts_at limit 1;
 select available_spots into available from public.slot_availability where slot_id=s;
 if available<>8 then raise exception 'Esperados 8 cupos web; recibidos %',available; end if;
 begin
   insert into public.events(date,start_time,end_time) values('2099-12-31','19:00','21:00');
   raise exception 'FALLO: se permitió solapar fechas';
 exception when raise_exception then
   if sqlerrm like 'FALLO:%' then raise; end if;
   if sqlerrm not like '%solapa%' then raise; end if;
 end;
 select id into p from public.packages where name='Individual' limit 1;
 insert into public.reservations(slot_id,package_id,spots,amount,status,channel) values(s,p,5,75,'paid','track');
 begin
   update public.slots set capacity=6 where id=s;
   raise exception 'FALLO: se afectaron reservas existentes';
 exception when raise_exception then
   if sqlerrm like 'FALLO:%' then raise; end if;
   if sqlerrm not like '%reservados%' then raise; end if;
 end;
 update public.events set status='cancelled' where id=e;
 if (select count(*) from public.slots where event_id=e and status='cancelled')<>36 then raise exception 'FALLO: cancelación incompleta'; end if;
 if not exists(select 1 from public.reservations where slot_id=s) then raise exception 'FALLO: historial eliminado'; end if;
 raise notice 'OK: generación, medianoche, cupos, solapamiento, capacidad y cancelación.';
end $$;
rollback;
