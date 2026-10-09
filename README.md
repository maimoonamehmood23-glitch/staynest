# StayNest – Hotel Booking MVP
Original hotel booking website (React + Vite + Supabase) built for a university assignment.

## Features
Hotel search by destination, dates and guests · listings and details · validated booking form · real Supabase insertion · confirmation page with booking ID · responsive layout.

## Setup
1. `npm install`
2. Create a Supabase project, open SQL Editor, run `supabase/schema.sql`, then `supabase/update_rooms_extras.sql` (hotels, room types with fixed prices, extras, dynamic pricing).
3. `cp .env.example .env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API → anon public key).
4. `npm run dev` · production build: `npm run build`.

## How booking works
The form is validated, then the browser calls the `create_booking` Postgres function via `supabase.rpc`. It finds/creates the user by email, inserts the booking (status `Confirmed`) and returns the ID shown on the confirmation page. Check the rows in Table Editor → `bookings`.

## Deployment (Netlify)
Connect the GitHub repo; build `npm run build`, publish `dist` (set in `netlify.toml`). Add the two `VITE_` variables in Site settings → Environment variables.

## Claude Code change log (fill in with screenshots)
1. Built homepage, search and listings. 2. Built details + booking flow and validation. 3. Integrated Supabase (schema, RLS, RPC). 4. Fixed errors found in testing: _(record here)_.
