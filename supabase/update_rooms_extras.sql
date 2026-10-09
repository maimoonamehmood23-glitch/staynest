-- Run AFTER schema.sql. Safe to re-run (no duplicates). Adds room types, extras, dynamic pricing and hotel data.
create table if not exists room_types (id uuid primary key default gen_random_uuid(), hotel_id uuid not null references hotels(id) on delete cascade, name text not null, price_per_night numeric(8,2) not null, capacity int not null, rooms_available int not null, unique (hotel_id, name));
create table if not exists extras (code text primary key, name text not null, price numeric(8,2) not null, pricing text not null check (pricing in ('per_guest_night','per_night','per_stay')));
alter table bookings add column if not exists room_type_id uuid references room_types(id);
alter table bookings add column if not exists rooms int not null default 1;
alter table bookings add column if not exists extras text[] default '{}';
alter table bookings add column if not exists total_price numeric(10,2);
alter table room_types enable row level security;
alter table extras enable row level security;
drop policy if exists "Public can read room_types" on room_types;
drop policy if exists "Public can read extras" on extras;
drop policy if exists "Public can read hotels" on hotels;
create policy "Public can read room_types" on room_types for select using (true);
create policy "Public can read extras" on extras for select using (true);
create policy "Public can read hotels" on hotels for select using (true);

-- Hotels (price_per_night = base "from" price)
insert into hotels (name,location,description,price_per_night,rating,image_url,facilities,max_guests)
select * from (values
('Azure Bay Resort','Barcelona, Spain','Beachfront resort with sea-view rooms and a rooftop pool.',185,4.7,'https://picsum.photos/seed/azurebay/800/500',array['Pool','WiFi','Breakfast','Beach access'],5),
('Old Town Lantern Inn','Prague, Czechia','Cosy boutique inn steps from the historic square.',95,4.5,'https://picsum.photos/seed/lantern/800/500',array['WiFi','Breakfast','Bar'],5),
('Skyline Grand Hotel','Dubai, UAE','Modern high-rise hotel with city views and a spa.',240,4.8,'https://picsum.photos/seed/skyline/800/500',array['Spa','Gym','Pool','WiFi'],5),
('Harbour Light Suites','Lisbon, Portugal','Bright suites near the river with a kitchenette.',120,4.4,'https://picsum.photos/seed/harbour/800/500',array['Kitchenette','WiFi','Parking'],5),
('Alpine Pine Lodge','Zurich, Switzerland','Quiet mountain-view lodge with a sauna.',210,4.6,'https://picsum.photos/seed/alpine/800/500',array['Sauna','Breakfast','WiFi','Parking'],5),
('Cedar Garden Hotel','Barcelona, Spain','Calm garden hotel in the Eixample district.',110,4.3,'https://picsum.photos/seed/cedar/800/500',array['Garden','WiFi','Breakfast'],5),
('Marina Pearl Hotel','Dubai, UAE','Family-friendly hotel next to the marina walk.',155,4.2,'https://picsum.photos/seed/pearl/800/500',array['Pool','Kids club','WiFi'],5),
('Riverside Courtyard','Lisbon, Portugal','Charming courtyard rooms with local tiles and a terrace.',85,4.1,'https://picsum.photos/seed/riverside/800/500',array['Terrace','WiFi'],5)
) v(name,location,description,price_per_night,rating,image_url,facilities,max_guests)
where not exists (select 1 from hotels h where h.name = v.name);

-- Three fixed room types per hotel, priced from the hotel's base price
insert into room_types (hotel_id,name,price_per_night,capacity,rooms_available)
select h.id, r.name, round(h.price_per_night * r.mult), r.cap, r.avail
from hotels h cross join (values ('Standard Double',1.0,2,5),('Deluxe Room',1.35,3,3),('Family Suite',1.8,5,2)) r(name,mult,cap,avail)
on conflict (hotel_id,name) do nothing;

insert into extras values ('BREAKFAST','Breakfast',12,'per_guest_night'),('TRANSFER','Airport transfer',30,'per_stay'),('LATE_CHECKOUT','Late check-out',20,'per_stay'),('PARKING','Parking',10,'per_night')
on conflict (code) do nothing;

drop function if exists create_booking(text,text,text,uuid,date,date,int,text);
create or replace function create_booking(p_name text,p_email text,p_phone text,p_hotel uuid,p_room uuid,p_rooms int,p_check_in date,p_check_out date,p_guests int,p_request text,p_extras text[])
returns table (booking_id uuid, booking_status text, total_price numeric) language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_room room_types; v_nights int; v_total numeric; v_extra numeric;
begin
  if p_check_out <= p_check_in or p_check_in < current_date then raise exception 'Invalid dates'; end if;
  select * into v_room from room_types where id = p_room and hotel_id = p_hotel;
  if not found then raise exception 'Room type not found'; end if;
  if p_rooms < 1 or p_rooms > v_room.rooms_available then raise exception 'Only % room(s) available', v_room.rooms_available; end if;
  if p_guests < 1 or p_guests > v_room.capacity * p_rooms then raise exception 'Too many guests for the selected rooms'; end if;
  v_nights := p_check_out - p_check_in;
  select coalesce(sum(case e.pricing when 'per_guest_night' then e.price*p_guests*v_nights when 'per_night' then e.price*v_nights*p_rooms else e.price end),0)
    into v_extra from extras e where e.code = any(coalesce(p_extras,'{}'));
  v_total := v_room.price_per_night * v_nights * p_rooms + v_extra;  -- price is always computed server-side
  insert into users(name,email,phone) values (p_name,lower(p_email),p_phone)
    on conflict (email) do update set name = excluded.name, phone = excluded.phone returning id into v_user;
  return query insert into bookings(user_id,hotel_id,room_type_id,rooms,guest_name,email,phone,check_in,check_out,guests,special_request,extras,total_price)
    values (v_user,p_hotel,p_room,p_rooms,p_name,lower(p_email),p_phone,p_check_in,p_check_out,p_guests,nullif(p_request,''),coalesce(p_extras,'{}'),v_total)
    returning bookings.id, bookings.booking_status, bookings.total_price;
end $$;
grant execute on function create_booking to anon, authenticated;
