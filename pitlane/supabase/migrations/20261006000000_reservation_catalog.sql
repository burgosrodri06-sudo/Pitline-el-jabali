-- Fail on name collisions: do not silently adopt an unknown remote schema.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  event_date date not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 10),
  track_reserved_capacity integer not null default 0,
  status text not null default 'open' check (status in ('open', 'closed')),
  -- Every allocation writes this internal row version; RPC requires READ COMMITTED.
  allocation_version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at = starts_at + interval '10 minutes'),
  check (track_reserved_capacity between 0 and capacity),
  unique(event_id, starts_at)
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 1 and 60),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  price_cents integer not null check (price_cents > 0),
  spots_required integer not null check (spots_required between 1 and 10),
  active boolean not null default false,
  -- Only initial, single-slot packages are supported in this block.
  booking_type text not null default 'initial' check (booking_type = 'initial'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.reservation_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.reservation_touch_updated_at() from public, anon, authenticated, service_role;
create trigger events_updated before update on public.events for each row execute function public.reservation_touch_updated_at();
create trigger slots_updated before update on public.slots for each row execute function public.reservation_touch_updated_at();
create trigger packages_updated before update on public.packages for each row execute function public.reservation_touch_updated_at();

alter table public.events enable row level security;
alter table public.slots enable row level security;
alter table public.packages enable row level security;
revoke all on public.events, public.slots, public.packages from public, anon, authenticated;
grant select on public.events, public.packages to anon, authenticated;
-- Do not expose allocation counters or allocation timestamps as a side channel.
-- API readers must use this explicit projection rather than SELECT * on slots.
grant select (id, event_id, starts_at, ends_at, capacity, track_reserved_capacity, status, created_at)
  on public.slots to anon, authenticated;
create policy events_published on public.events for select to anon, authenticated using (status = 'published');
create policy slots_published on public.slots for select to anon, authenticated using (
  status = 'open' and exists(select 1 from public.events e where e.id = event_id and e.status = 'published')
);
create policy packages_active on public.packages for select to anon, authenticated using (active);
create policy events_admin_read on public.events for select to authenticated using (public.has_role(array['kre_admin', 'system_admin']));
create policy slots_admin_read on public.slots for select to authenticated using (public.has_role(array['kre_admin', 'system_admin']));
create policy packages_admin_read on public.packages for select to authenticated using (public.has_role(array['kre_admin', 'system_admin']));
