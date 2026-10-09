-- StayNest schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table users (id uuid primary key default gen_random_uuid(), name text not null, email text not null unique, phone text, created_at timestamptz default now());
create table hotels (id uuid primary key default gen_random_uuid(), name text not null, location text not null, description text, price_per_night numeric(8,2) not null, rating numeric(2,1), image_url text, facilities text[] default '{}', max_guests int default 4, rooms_available int default 5, created_at timestamptz default now());
create table bookings (id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id), hotel_id uuid not null references hotels(id), guest_name text not null, email text not null, phone text not null, check_in date not null, check_out date not null, guests int not null check (guests between 1 and 10), booking_status text not null default 'Confirmed', special_request text, created_at timestamptz default now(), check (check_out > check_in));

alter table users enable row level security;
alter table hotels enable row level security;
alter table bookings enable row level security;
create policy "Public can read hotels" on hotels for select using (true);
-- users/bookings have no public policies: the browser can only write through this function.

create or replace function create_booking(p_name text, p_email text, p_phone text, p_hotel uuid, p_check_in date, p_check_out date, p_guests int, p_request text)
returns table (booking_id uuid, booking_status text) language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_id uuid; v_status text;
begin
  if p_check_out <= p_check_in or p_check_in < current_date then raise exception 'Invalid dates'; end if;
  if not exists (select 1 from hotels where id = p_hotel) then raise exception 'Hotel not found'; end if;
  insert into users(name,email,phone) values (p_name,lower(p_email),p_phone)
    on conflict (email) do update set name = excluded.name, phone = excluded.phone returning id into v_user;
  insert into bookings(user_id,hotel_id,guest_name,email,phone,check_in,check_out,guests,special_request)
    values (v_user,p_hotel,p_name,lower(p_email),p_phone,p_check_in,p_check_out,p_guests,nullif(p_request,''))
    returning id, bookings.booking_status into v_id, v_status;
  return query select v_id, v_status;
end $$;
grant execute on function create_booking to anon, authenticated;

insert into hotels (name,location,description,price_per_night,rating,image_url,facilities,max_guests,rooms_available) values
('Azure Bay Resort','Barcelona, Spain','Beachfront resort with sea-view rooms and a rooftop pool.',185,4.7,'https://picsum.photos/seed/azurebay/800/500',array['Pool','WiFi','Breakfast','Beach access'],4,6),
('Old Town Lantern Inn','Prague, Czechia','Cosy boutique inn steps from the historic square.',95,4.5,'https://picsum.photos/seed/lantern/800/500',array['WiFi','Breakfast','Bar'],3,4),
('Skyline Grand Hotel','Dubai, UAE','Modern high-rise hotel with city views and a spa.',240,4.8,'https://picsum.photos/seed/skyline/800/500',array['Spa','Gym','Pool','WiFi'],5,8),
('Harbour Light Suites','Lisbon, Portugal','Bright apartments-style suites near the river.',120,4.4,'https://picsum.photos/seed/harbour/800/500',array['Kitchenette','WiFi','Parking'],4,5),
('Alpine Pine Lodge','Zurich, Switzerland','Quiet mountain-view lodge with a sauna.',210,4.6,'https://picsum.photos/seed/alpine/800/500',array['Sauna','Breakfast','WiFi','Parking'],4,3),
('Cedar Garden Hotel','Barcelona, Spain','Calm garden hotel in the Eixample district.',110,4.3,'https://picsum.photos/seed/cedar/800/500',array['Garden','WiFi','Breakfast'],3,7),
('Marina Pearl Hotel','Dubai, UAE','Family-friendly hotel next to the marina walk.',155,4.2,'https://picsum.photos/seed/pearl/800/500',array['Pool','Kids club','WiFi'],6,9),
('Riverside Courtyard','Lisbon, Portugal','Charming courtyard rooms with local tiles and terrace.',85,4.1,'https://picsum.photos/seed/riverside/800/500',array['Terrace','WiFi'],2,4);
