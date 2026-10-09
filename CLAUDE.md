# CLAUDE.md – StayNest

**Purpose:** StayNest is an original hotel booking MVP (university assignment): search hotels, view details, book, store the booking in Supabase, show confirmation.

## Stack
React 18 + Vite, plain CSS, Supabase (Postgres + `@supabase/supabase-js`), Git/GitHub, Netlify.

## Structure
- `src/main.jsx` entry · `src/App.jsx` views + components (`SearchBox`, `HotelCard`, `BookingForm`, `validateBooking`) · `src/supabase.js` client · `src/styles.css`
- `supabase/schema.sql` tables, RLS, `create_booking` function, sample hotels
- `netlify.toml` build + SPA redirect · `.env.example`

## Architecture
Single-page app; `App` holds `view` state (home, hotels, details, booking, confirm, about, contact) plus `search`, `selected`, `booking`. Search values persist into the booking form. No router dependency; Netlify redirect keeps refreshes working.

## Database
`users(id,name,email unique,phone,created_at)`, `hotels(id,name,location,description,price_per_night,rating,image_url,facilities[],max_guests,rooms_available,created_at)`, `bookings(id,user_id→users,hotel_id→hotels,guest_name,email,phone,check_in,check_out,guests,booking_status,special_request,created_at)`.

## Booking workflow
Form validation (client) → `supabase.rpc('create_booking')` → function re-checks dates/hotel, upserts user by email, inserts booking with status `Confirmed`, returns id/status → confirmation screen.

## Supabase config
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (see `.env.example`). Only the anon key is used. RLS: hotels are publicly readable; users/bookings are writable only through the `security definer` function. Never use the service_role key in the frontend.

## Conventions & instructions for Claude Code
Keep code beginner-friendly; no new dependencies without reason; never commit `.env`; update this file and `schema.sql` when changing the data model; keep validation in `validateBooking` and the SQL function in sync; log each meaningful change in README "Claude Code change log".

## Run locally
`npm install`, copy `.env.example` to `.env`, run `supabase/schema.sql` in the Supabase SQL editor, `npm run dev`.

## Rooms, extras and pricing
`room_types` (fixed price per room type) and `extras` (fixed add-on prices) are in `supabase/update_rooms_extras.sql`. Total = room price x nights x rooms + extras; the UI previews it and `create_booking` recomputes it server-side and stores `total_price`. Run schema.sql first, then update_rooms_extras.sql.
