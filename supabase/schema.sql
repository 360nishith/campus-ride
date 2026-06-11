-- Campus Ride database schema for Supabase/Postgres.
-- Run this in the Supabase SQL editor after creating a project.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create type public.user_role as enum ('passenger', 'rider', 'admin');
create type public.document_type as enum (
  'college_id_front',
  'college_id_back',
  'driving_license_front',
  'driving_license_back'
);
create type public.verification_status as enum ('pending', 'approved', 'rejected');
create type public.ride_status as enum ('active', 'closed', 'cancelled', 'completed');
create type public.booking_status as enum ('pending', 'accepted', 'rejected', 'cancelled', 'completed');
create type public.payment_status as enum ('unpaid', 'initiated', 'paid', 'failed', 'refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  full_name text not null,
  primary_role public.user_role not null default 'passenger',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nmamit_email_chk check (email ~* '^[^[:space:]@]+@nmamit\.in$')
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.student_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  usn text not null unique,
  branch text not null,
  study_year smallint not null check (study_year between 1 and 4),
  phone text not null,
  usual_pickup text,
  college_id_collected boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_profiles_phone_chk check (phone ~ '^[0-9]{10}$')
);

create table public.rider_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  upi_id text not null,
  rider_onboarding_complete boolean not null default false,
  rider_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rider_profiles_upi_chk check (upi_id ~* '^[a-z0-9._-]{2,255}@[a-z0-9.-]{2,64}$')
);

create table public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type public.document_type not null,
  storage_bucket text not null default 'verification-documents',
  storage_path text not null,
  status public.verification_status not null default 'pending',
  rejection_reason text,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  unique (user_id, document_type)
);

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.rider_profiles(user_id) on delete cascade,
  start_location text not null,
  destination_location text not null,
  via_locations text[] not null default '{}',
  seats_total smallint not null check (seats_total between 1 and 7),
  cost_per_km numeric(8,2) not null check (cost_per_km >= 0),
  estimated_distance_km numeric(8,2) check (estimated_distance_km >= 0),
  departure_at timestamptz,
  vehicle_details text,
  status public.ride_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rides_route_chk check (lower(start_location) <> lower(destination_location))
);

create table public.ride_bookings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  passenger_id uuid not null references public.profiles(id) on delete cascade,
  seats_requested smallint not null default 1 check (seats_requested between 1 and 7),
  status public.booking_status not null default 'pending',
  fare_estimate numeric(10,2) check (fare_estimate >= 0),
  payment_status public.payment_status not null default 'unpaid',
  payment_reference text,
  applied_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ride_id, passenger_id)
);

create or replace view public.ride_seat_summary as
select
  r.id as ride_id,
  r.seats_total,
  coalesce(sum(b.seats_requested) filter (where b.status = 'accepted'), 0)::int as seats_booked,
  (
    r.seats_total
    - coalesce(sum(b.seats_requested) filter (where b.status = 'accepted'), 0)
  )::int as seats_available
from public.rides r
left join public.ride_bookings b on b.ride_id = r.id
group by r.id;

create or replace view public.available_rides as
select
  r.id,
  r.rider_id,
  p.full_name as rider_name,
  p.email as rider_email,
  rp.upi_id,
  r.start_location,
  r.destination_location,
  r.via_locations,
  r.seats_total,
  rss.seats_booked,
  rss.seats_available,
  r.cost_per_km,
  r.estimated_distance_km,
  r.departure_at,
  r.vehicle_details,
  r.status,
  r.created_at
from public.rides r
join public.ride_seat_summary rss on rss.ride_id = r.id
join public.profiles p on p.id = r.rider_id
join public.rider_profiles rp on rp.user_id = r.rider_id
where r.status = 'active'
  and rss.seats_available > 0;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger student_profiles_set_updated_at
before update on public.student_profiles
for each row execute function public.set_updated_at();

create trigger rider_profiles_set_updated_at
before update on public.rider_profiles
for each row execute function public.set_updated_at();

create trigger rides_set_updated_at
before update on public.rides
for each row execute function public.set_updated_at();

create trigger ride_bookings_set_updated_at
before update on public.ride_bookings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
begin
  requested_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'passenger');

  insert into public.profiles (id, email, full_name, primary_role)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    requested_role
  );

  insert into public.user_roles (user_id, role)
  values (new.id, requested_role)
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.rider_profiles enable row level security;
alter table public.verification_documents enable row level security;
alter table public.rides enable row level security;
alter table public.ride_bookings enable row level security;

create policy "authenticated users can read profiles"
on public.profiles for select
to authenticated
using (true);

create policy "users can insert own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "users can read own roles"
on public.user_roles for select
to authenticated
using (auth.uid() = user_id);

create policy "users can add own passenger or rider role"
on public.user_roles for insert
to authenticated
with check (auth.uid() = user_id and role in ('passenger', 'rider'));

create policy "users can update own roles"
on public.user_roles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and role in ('passenger', 'rider'));

create policy "users can read own student profile"
on public.student_profiles for select
to authenticated
using (auth.uid() = user_id);

create policy "users can upsert own student profile"
on public.student_profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update own student profile"
on public.student_profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "authenticated users can read rider profiles"
on public.rider_profiles for select
to authenticated
using (true);

create policy "users can insert own rider profile"
on public.rider_profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update own rider profile"
on public.rider_profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can manage own verification documents"
on public.verification_documents for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "authenticated users can read active rides"
on public.rides for select
to authenticated
using (status = 'active' or auth.uid() = rider_id);

create policy "riders can create own rides"
on public.rides for insert
to authenticated
with check (
  auth.uid() = rider_id
  and exists (
    select 1 from public.rider_profiles rp
    where rp.user_id = auth.uid()
      and rp.rider_onboarding_complete = true
  )
);

create policy "riders can update own rides"
on public.rides for update
to authenticated
using (auth.uid() = rider_id)
with check (auth.uid() = rider_id);

create policy "riders can delete own rides"
on public.rides for delete
to authenticated
using (auth.uid() = rider_id);

create policy "passengers can create own bookings"
on public.ride_bookings for insert
to authenticated
with check (auth.uid() = passenger_id);

create policy "passengers and riders can read related bookings"
on public.ride_bookings for select
to authenticated
using (
  auth.uid() = passenger_id
  or exists (
    select 1 from public.rides r
    where r.id = ride_bookings.ride_id
      and r.rider_id = auth.uid()
  )
);

create policy "passengers and riders can update related bookings"
on public.ride_bookings for update
to authenticated
using (
  auth.uid() = passenger_id
  or exists (
    select 1 from public.rides r
    where r.id = ride_bookings.ride_id
      and r.rider_id = auth.uid()
  )
)
with check (
  auth.uid() = passenger_id
  or exists (
    select 1 from public.rides r
    where r.id = ride_bookings.ride_id
      and r.rider_id = auth.uid()
  )
);

create index profiles_email_idx on public.profiles (email);
create index student_profiles_usn_idx on public.student_profiles (usn);
create index rides_rider_id_idx on public.rides (rider_id);
create index rides_status_idx on public.rides (status);
create index rides_route_idx on public.rides (lower(start_location), lower(destination_location));
create index ride_bookings_ride_id_idx on public.ride_bookings (ride_id);
create index ride_bookings_passenger_id_idx on public.ride_bookings (passenger_id);
create index verification_documents_user_id_idx on public.verification_documents (user_id);

insert into storage.buckets (id, name, public)
values ('verification-documents', 'verification-documents', false)
on conflict (id) do nothing;

create policy "users can upload own verification files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can read own verification files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can update own verification files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can delete own verification files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
