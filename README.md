# Family Lottery System (RUTAZIGURWA)

Status: database, Express API (19 automated tests) and React frontend (builds cleanly) are written.
Frontend pages have NOT been clicked through in a real browser, there are no frontend tests, full API docs and
provider-specific deployment steps remain unfinished, and NOTHING has been deployed.

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

## Deploy with a clean database

For a production launch with no test members, use a **new, empty PostgreSQL database**. The migrations create the schema and default lottery settings; they do not add members. Do not run `seed.sql` in production. The only initial data you need is the administrator account.

1. Create a production PostgreSQL database and save its connection string as the backend `DATABASE_URL`. Do not point production at the local/test database (it may contain sample members or duplicate phone numbers).
2. Deploy the `backend` folder as a Node service with build/install command `npm install` and start command `npm start`. Set `NODE_ENV=production`, a long random `SESSION_SECRET`, `DATABASE_URL`, and `FRONTEND_URL` to the exact HTTPS origin of the frontend. If your database provider requires SSL, set `DATABASE_SSL=true`.
3. Run `npm run migrate` once from the `backend` folder with the production environment variables. This creates only the schema and default lottery settings. It does not create users or run `seed.sql`.
4. Create the initial admin once: temporarily set `ADMIN_INITIAL_USERNAME` and `ADMIN_INITIAL_PASSWORD` (at least 12 characters) in the backend service environment, run `npm run create-admin` from `backend`, then remove `ADMIN_INITIAL_PASSWORD`. The password is stored as a hash. Keep the username and password private.
5. Build the frontend from `frontend` with `npm install` and `npm run build`. If the API uses a separate domain, set `REACT_APP_API_URL` to its HTTPS origin **before building**. Publish the `frontend/build` directory and configure SPA rewrites so `/admin/login` and `/lottery` load `index.html`. If the frontend and API share an origin behind a reverse proxy, leave `REACT_APP_API_URL` blank and route `/api` to the backend.
6. Open `/admin/login`, sign in, and verify the admin dashboard. The member list should be empty. Member registrations will create real member rows after launch.

If `npm run migrate` fails while adding the unique phone index, the selected database already contains members with duplicate phone numbers. Stop and use a fresh empty production database instead of copying test records; do not remove or change existing phone numbers unless you have confirmed which values to keep.

### Use Neon for PostgreSQL

1. In Neon, create a new project and use its default empty branch/database. Do not import a dump or run `seed.sql` if you want no test members.
2. In the Neon Console, open **Connect**, select the branch, database, and role, then copy the connection string. The pooled connection is selected by default; Neon documents the pooled hostname with `-pooler` and the URL with SSL parameters. Use that full string as the backend `DATABASE_URL` secret. Do not paste it into frontend settings or commit it to source control.
3. Keep `DATABASE_SSL=true` in the backend environment for a Neon connection. Run the backend migration and one-time admin creation commands from the clean-deployment steps above.
