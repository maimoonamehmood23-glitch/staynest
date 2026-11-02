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

## Testing
`npm test` runs Vitest unit tests (`src/utils.test.js`) for date handling, pricing, and booking validation (18 tests). The testable logic lives in `src/utils.js`.

## Custom AI skill: code-review
`.claude/skills/code-review/SKILL.md` is a reusable Claude Code skill. It reviews a diff against an 8-point checklist (secrets, validation/SQL sync, error handling, edge cases, tests, data model, style, docs/commits) and always answers in the same table + verdict format. Use it by asking Claude Code: "review my changes with the code-review skill". Benefit: reviews are consistent between sessions and nothing on the checklist gets forgotten.

## MCP integrations (Jira + GitHub)
Claude Code is connected to two remote MCP servers, so the agent can read Jira tasks and work with GitHub directly:
```
claude mcp add --scope user --transport http atlassian https://mcp.atlassian.com/v2/mcp
# PowerShell: $env:GITHUB_PAT = "<token>" first (bash: export GITHUB_PAT=<token>)
claude mcp add --scope user --transport http github https://api.githubcopilot.com/mcp/ --header "Authorization: Bearer $env:GITHUB_PAT"
claude mcp list        # both should show "Connected"
```
Authenticate Atlassian through the browser prompt (`/mcp` inside Claude Code). Keep the GitHub token in an environment variable; never commit it.
Workflow: read a Jira task -> implement on a branch -> run `npm test` -> run the code-review skill -> commit with the Jira key (e.g. `KAN-5: ...`) -> push -> open a PR -> Jira links the commit/PR by key.
Limitations: MCP configuration lives in each developer's Claude config (not in this repo); Atlassian access needs the Jira site's admin to allow the app; GitHub PAT scopes are limited to the repo.

## Claude Code change log
1. Built homepage, search and listings. 2. Built details + booking flow and validation. 3. Integrated Supabase (schema, RLS, RPC).
4. **Bug fixed - wrong "today" near midnight.** `today()` used `new Date().toISOString()`, which is UTC. In timezones ahead of UTC (e.g. Pakistan, UTC+5) between 00:00 and 05:00 it returned *yesterday*, so the date pickers allowed past dates and "check-in cannot be in the past" was wrong. Fix: build the date from local year/month/day (`src/utils.js`); regression test added.
5. **Error handling:** extras and hotels fetches now report failures (and `.catch` network errors); booking submit catches thrown network errors so the button never gets stuck; a hotel with no room types shows "No rooms listed" instead of `$Infinity`.
6. Moved pure logic to `src/utils.js` and added Vitest tests; added the `code-review` skill.
