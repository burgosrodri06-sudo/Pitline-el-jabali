-- Schema base del equipo ("schema congelado"): todas las tablas del flujo de reservas.
-- RLS activado en todo. Aquí solo va la lectura pública del calendario;
-- cada dueño agrega las políticas de sus tablas en su propia migración.

-- 1. Enums
create type public.event_status as enum ('draft', 'open', 'closed', 'cancelled');
create type public.slot_status as enum ('available', 'full', 'closed', 'cancelled');
create type public.reservation_status as enum (
  'pending_payment', 'payment_review', 'paid', 'cancelled', 'expired', 'attended', 'no_show'
);
create type public.payment_status as enum ('pending', 'uploaded', 'approved', 'rejected', 'reconciled');
create type public.payment_method as enum ('bank_transfer', 'track_cash', 'credit');
create type public.waitlist_status as enum ('waiting', 'offered', 'accepted', 'expired', 'cancelled');

-- 2. Tablas
create table public.events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  status public.event_status not null default 'draft',
  start_time time not null,
  end_time time not null check (end_time > start_time),
  slot_minutes int not null default 10 check (slot_minutes > 0),
  buffer_minutes int not null default 0 check (buffer_minutes >= 0),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  capacity int not null default 10 check (capacity between 1 and 10),
  track_reserved_spots int not null default 0
    check (track_reserved_spots >= 0 and track_reserved_spots <= capacity),
  status public.slot_status not null default 'available',
  unique (event_id, starts_at)
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null check (price > 0),
  spots int not null check (spots > 0),
  duration_minutes int not null default 10 check (duration_minutes > 0),
  active boolean not null default true,
  valid_from date,
  valid_to date check (valid_to is null or valid_from is null or valid_to >= valid_from),
  eligibility text not null default 'none' check (eligibility in ('none', 'requires_first_ride'))
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    default 'KRE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  user_id uuid references public.profiles (id), -- null = walk-in en pista
  slot_id uuid not null references public.slots (id),
  package_id uuid not null references public.packages (id),
  spots int not null check (spots > 0),
  amount numeric(10, 2) not null check (amount >= 0), -- snapshot del precio del paquete
  status public.reservation_status not null default 'pending_payment',
  channel text not null default 'web' check (channel in ('web', 'track')),
  expires_at timestamptz,
  qr_token uuid not null unique default gen_random_uuid(),
  rules_accepted_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (channel <> 'web' or rules_accepted_at is not null)
);

create table public.reservation_participants (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  full_name text not null,
  is_holder boolean not null default false,
  -- Solo en una segunda vuelta: apunta a la participación de su primera vuelta.
  first_ride_participant_id uuid references public.reservation_participants (id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id),
  amount numeric(10, 2) not null check (amount > 0),
  method public.payment_method not null,
  reference text,
  last4 text check (last4 ~ '^[0-9]{4}$'),
  receipt_path text, -- ruta dentro del bucket payment-receipts
  status public.payment_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id),
  user_id uuid not null references public.profiles (id),
  requested_spots int not null check (requested_spots between 1 and 10),
  status public.waitlist_status not null default 'waiting',
  offered_at timestamptz,
  offer_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references public.reservation_participants (id) on delete cascade,
  reservation_id uuid not null references public.reservations (id),
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles (id),
  first_ride_completed boolean not null default false,
  first_ride_completed_at timestamptz,
  no_show boolean not null default false
);

-- Créditos a favor del piloto. No vencen.
create table public.credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  origin_reservation_id uuid not null references public.reservations (id),
  amount numeric(10, 2) not null check (amount > 0),
  reason text not null,
  used_reservation_id uuid references public.reservations (id),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  type text not null,
  channel text not null,
  status text not null default 'pending',
  error text,
  payload jsonb not null default '{}',
  sent_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  entity text not null,
  entity_id uuid,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- 3. Índices
-- slots(event_id, starts_at) ya tiene índice por el unique.
create index on public.events (created_by);
create index on public.reservations (slot_id, status);
create index on public.reservations (user_id);
create index on public.reservations (package_id);
create index on public.reservations (created_by);
create index on public.reservation_participants (reservation_id);
create index on public.reservation_participants (first_ride_participant_id);
create index on public.payments (reservation_id);
create index on public.payments (reviewed_by);
create index on public.payments (created_by);
create unique index payments_bank_transfer_reference_key
  on public.payments (reference) where method = 'bank_transfer';
create index on public.waitlist_entries (slot_id);
create index on public.waitlist_entries (user_id);
create index on public.attendance (reservation_id);
create index on public.attendance (checked_in_by);
create index on public.credits (user_id);
create index on public.credits (origin_reservation_id);
create index on public.credits (used_reservation_id);
create index on public.notifications (user_id);
create index on public.audit_logs (actor_id);

-- 4. Cupos disponibles: ÚNICA fórmula del proyecto.
-- security definer: cuenta todas las reservas aunque RLS no deje verlas.
create function public.slot_available_spots(p_slot_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select s.capacity - s.track_reserved_spots - coalesce((
    select sum(r.spots)
    from public.reservations r
    where r.slot_id = s.id
      and (
        r.status in ('payment_review', 'paid')
        or (r.status = 'pending_payment' and r.expires_at > now())
      )
  ), 0)::int
  from public.slots s
  where s.id = p_slot_id;
$$;

-- security_invoker: la vista respeta el RLS de slots (solo se ven las tandas visibles).
create view public.slot_availability
with (security_invoker = true) as
  select s.id as slot_id, public.slot_available_spots(s.id) as available_spots
  from public.slots s;

-- 5. RLS en todas las tablas
alter table public.events enable row level security;
alter table public.slots enable row level security;
alter table public.packages enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_participants enable row level security;
alter table public.payments enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.attendance enable row level security;
alter table public.credits enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Política base: el calendario público.
create policy "Cualquiera lee eventos abiertos"
  on public.events for select
  to anon, authenticated
  using (status = 'open');

create policy "Cualquiera lee tandas de eventos abiertos"
  on public.slots for select
  to anon, authenticated
  using (exists (
    select 1 from public.events e
    where e.id = event_id and e.status = 'open'
  ));

create policy "Cualquiera lee paquetes activos"
  on public.packages for select
  to anon, authenticated
  using (active);

-- 6. Storage: comprobantes de pago (privado; las políticas las agrega pagos).
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false);
