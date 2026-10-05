-- Explicit opt-in on a disposable LOCAL database only; not included in migrations
-- or supabase/config.toml seeds. Does not configure a production waiver.
do $$ begin
  if current_setting('pitlane.allow_development_seed', true) is distinct from 'yes' then
    raise exception 'Development seed requires explicit local opt-in';
  end if;
end $$;

insert into public.packages(code, name, price_cents, spots_required, active)
values ('individual', 'Individual', 1500, 1, true),
       ('friends', 'Friends Combo', 5000, 5, true)
on conflict (code) do nothing;

-- Published sample event is deliberately identifiable and has no users/reservations.
insert into public.events(id, title, event_date, status)
values ('00000000-0000-4000-8000-000000000001', 'DESARROLLO — KRE',
  (now() at time zone 'America/El_Salvador')::date + 2, 'published')
on conflict (id) do nothing;
insert into public.slots(event_id, starts_at, ends_at, capacity, track_reserved_capacity)
select id, (event_date + time '18:00') at time zone 'America/El_Salvador',
  (event_date + time '18:10') at time zone 'America/El_Salvador', 10, 2
from public.events where id = '00000000-0000-4000-8000-000000000001'
on conflict (event_id, starts_at) do nothing;
