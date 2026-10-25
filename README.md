# Family Lottery System (RUTAZIGURWA)

Status: database, Express API (19 automated tests) and React frontend (builds cleanly) are written.
Frontend pages have NOT been clicked through in a real browser, there are no frontend tests, full API docs and the
deployment guide are not finished, and NOTHING has been deployed.

## Local setup
1. Create a PostgreSQL database, e.g. `createdb family_lottery`
2. `cd backend && cp .env.example .env` and fill in DATABASE_URL and a long random SESSION_SECRET
3. `npm install && npm run migrate`
4. (Optional sample data) `psql "$DATABASE_URL" -f seed.sql`  (fictional people only)
5. Create the administrator ONCE: set ADMIN_INITIAL_USERNAME / ADMIN_INITIAL_PASSWORD (12+ chars) in `.env`,
   run `npm run create-admin`, then delete the password from `.env`. The server never creates admins by itself.
6. `npm start`  (API on PORT, default 4000)
7. Tests: create a database `lottery_test`, apply `migrations/001_init.sql`, set TEST_DATABASE_URL, run `npm test`

## Important security limitation
Member ID-only login does not prove who is typing the ID. Anyone who learns or guesses an ID (RUT-001, RUT-002...
are easy to guess) can draw as that person. Mitigations in place: rate limiting, identical error for unknown and
inactive IDs, short 30-minute member sessions, one draw per member, admin audit log. For stronger protection,
use random IDs instead of sequential ones and hand them out privately.

## Matching
Default is one-to-one. If active male and female counts differ, the admin must approve before the lottery starts.
Admin can instead choose "open" mode (the same person may be drawn by several people) before starting.

## Frontend (local)
`cd frontend && cp .env.example .env && npm install && npm start` (opens on http://localhost:3000).
Set REACT_APP_API_URL to your API address when the frontend and API are hosted on different origins. If they share an origin behind a reverse proxy, the frontend uses that origin automatically. The member page is `/`, administrator login is `/admin/login`, and the lottery page is `/lottery`.
Build for hosting: `npm run build` (`public/_redirects` keeps page refreshes working on Netlify-style hosts). Configure the hosting provider to serve the SPA fallback for unknown paths so direct visits and refreshes on `/admin/login` and `/lottery` load the app.
In production, set the API's FRONTEND_URL to the exact frontend origin and use HTTPS. Session cookies are Secure + SameSite=None there. For separately hosted frontend and API, set REACT_APP_API_URL to the public API origin at build time.
