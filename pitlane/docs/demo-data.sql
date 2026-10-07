-- Demo local o manual. Compatible con las validaciones del inventario KRE.
-- Crea borrador -> tandas -> publica. No duplica una fecha existente.
do $$
declare demo_date date; demo_id uuid;
begin
 demo_date := (now() at time zone 'America/El_Salvador')::date
   + ((5-extract(isodow from (now() at time zone 'America/El_Salvador'))::int+6)%7)+1;
 if not exists(select 1 from public.events where date=demo_date and start_time='18:00'::time) then
   insert into public.events(date,status,start_time,end_time) values(demo_date,'draft','18:00','18:40') returning id into demo_id;
   insert into public.slots(event_id,starts_at,ends_at)
   select demo_id, ((demo_date+'18:00'::time) at time zone 'America/El_Salvador')+make_interval(mins=>10*n),
     ((demo_date+'18:00'::time) at time zone 'America/El_Salvador')+make_interval(mins=>10*(n+1))
   from generate_series(0,3) n;
   update public.events set status='open' where id=demo_id;
 end if;
end $$;
