-- Datos de prueba locales (se cargan con `npx supabase db reset`).
-- Los paquetes vienen de la migración seed_packages.
-- Mismo evento que docs/demo-data.sql (para pegarlo a mano en el SQL Editor).

-- 1 evento abierto el próximo viernes, de 18:00 a 18:40 (hora de El Salvador),
-- con 4 tandas de 10 minutos. Si ya existe ese evento, no hace nada.
with d as (
  select (now() at time zone 'America/El_Salvador')::date
    + ((5 - extract(isodow from (now() at time zone 'America/El_Salvador'))::int + 6) % 7) + 1
    as friday
),
e as (
  insert into public.events (date, status, start_time, end_time)
  select d.friday, 'open'::public.event_status, '18:00'::time, '18:40'::time
  from d
  where not exists (
    select 1 from public.events x where x.date = d.friday and x.start_time = '18:00'
  )
  returning id, date, start_time, slot_minutes
)
insert into public.slots (event_id, starts_at, ends_at)
select
  e.id,
  ((e.date + e.start_time) at time zone 'America/El_Salvador') + make_interval(mins => e.slot_minutes * n),
  ((e.date + e.start_time) at time zone 'America/El_Salvador') + make_interval(mins => e.slot_minutes * (n + 1))
from e, generate_series(0, 3) as n;
