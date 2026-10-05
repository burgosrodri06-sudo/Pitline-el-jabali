-- Los 3 paquetes del plan. Va como migración (no en seed.sql) para que también
-- llegue al proyecto remoto. Idempotente: no duplica si ya existe uno con ese nombre.
insert into public.packages (name, price, spots, duration_minutes, eligibility)
select v.name, v.price, v.spots, v.duration_minutes, v.eligibility
from (values
  ('Individual', 15, 1, 10, 'none'),
  ('Segunda vuelta', 10, 1, 10, 'requires_first_ride'),
  ('Friends Combo', 50, 5, 10, 'none')
) as v (name, price, spots, duration_minutes, eligibility)
where not exists (select 1 from public.packages p where p.name = v.name);
