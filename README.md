# Dominion Portfolio — interactive 3D portfolio + MySQL admin CMS

Public site (Three.js 3D laptop, scroll-to-enter, Selected Work, Global Footprint map) **reads everything from MySQL through an API**.
`/admin` is a protected CMS. Change something there and the public site changes — no code edits.

```
Admin (/admin)  ──►  Express API (/api/admin, auth + CSRF)  ──►  MySQL  ──►  Public API (/api/content)  ──►  Website
```

## Audit result (what existed before this project)
The only thing that existed was a **single-file HTML prototype** (vanilla JS + Three.js r128 from a CDN). There was no framework, no
`package.json`, no `db.json`, no backend, no auth and no upload code. All content was hardcoded in that file. So the framework
decision was made on that evidence: **Node.js + Express + MySQL** keeps the 3D frontend exactly as-is (no React/Next/Laravel migration),
and Hostinger runs Node.js apps natively.

## Structure
```
server/            index.js (app) · db.js · auth.js · upload.js · migrate.js · seed.js · routes/public.js · routes/admin.js
migrations/        001_init.sql  (add 002_… for any future STRUCTURAL change)
public/            index.html (the portfolio) · map-data.json (world geometry, not content) · admin/ (CMS)
scripts/           create-admin.js
uploads/           uploaded media (gitignored; MySQL stores only file names)
```

## Run locally
```bash
npm install
cp .env.example .env        # fill DB_* and a long random JWT_SECRET
npm run migrate             # creates all tables (tracked in the `migrations` table)
npm run seed                # optional: loads the sample content from the prototype
npm run create-admin        # prompts for admin email + password (never hardcoded)
npm start                   # http://localhost:3000   admin: /admin
```

## Is this "only HTML"? — what the stack actually is
* **Backend:** Node.js + Express REST API (`server/`), MySQL via `mysql2` connection pool.
* **Frontend:** the portfolio page (`public/index.html`) is plain JavaScript + Three.js. It is served by the Node app and fetches all content from `/api/content` at load. It is *not* a static export: nothing on it is hardcoded, and it only works with the backend + database.
* **Admin:** a separate single-page app in `public/admin/`, talking to the protected `/api/admin/*` endpoints.
* Frontend and backend live in one app on one domain, so there is no API URL / CORS setup to get wrong.

## Setup with phpMyAdmin (no migrations run by us)
1. hPanel → Databases → create the MySQL database and user. Open **phpMyAdmin** → select the database.
2. **Import** `migrations/001_init.sql` (creates every table).
3. *(optional)* **Import** `database/seed_sample_content.sql` (sample bio, projects, buttons, countries to start from).
4. Create the admin login — pick ONE:
   * SSH/terminal on Hostinger: `npm run create-admin`, **or**
   * anywhere with Node: `node scripts/hash-password.js you@example.com 'your long password'` → paste the printed `INSERT` into phpMyAdmin → SQL.
5. Later structural changes arrive as `migrations/002_….sql`, `003_….sql` … — import them the same way (or `npm run migrate`; it detects tables already created by hand).

## Deploy on Hostinger (Node.js app)
1. hPanel → Websites → **Node.js app**, connect this GitHub repo, branch `main`. Start file: `server/index.js`. Run `npm install`.
2. Add every variable from `.env.example` as an **environment variable** (DB_HOST/PORT/USER/PASSWORD/NAME from the database you made, a long random `JWT_SECRET`, `NODE_ENV=production`, `UPLOAD_DIR`).
3. Put `UPLOAD_DIR` **outside** the deployed code (e.g. `/home/USER/portfolio-uploads`) so redeploys never delete media.
4. Use HTTPS (admin cookies are `secure` in production). Open `/admin` and sign in.

## Built for traffic
* `/api/content` is cached in memory (rebuilt at most once per 30 s, and **immediately** after any admin edit), so thousands of visitors cost almost no database work. Concurrent rebuilds are coalesced.
* gzip/deflate compression, cache headers for static files, `ETag` revalidation, per-IP rate limiting (`RATE_LIMIT_MAX`), DB connection pooling, and crash guards so one bad request cannot take the process down.
* Local load test (200 concurrent connections, 10 s, 1 CPU, same machine as the DB): ~2,900 req/s on `/api/content`, p99 ≈ 100 ms, 0 errors. Real throughput depends on your Hostinger plan; for large spikes put Cloudflare (free) in front and it will serve the static page and map file from its edge.

## Migrations
* `001_init.sql` — all tables. * `002_closing_statement_and_footer.sql` — data-only: adds the mobile/tablet closing statement (`hero.closing_lead`, `hero.closing_rest`) and the footer line (`site.made_by`) to the key/value `settings` table, and renames the centre laptop button to "Click Me" **only if it still has the default label "Work"**. It uses `INSERT IGNORE`, so it never overwrites anything you edited. Import it in phpMyAdmin (or `npm run migrate`).

## Where each piece of content lives
| Content | Table / key | Admin page |
|---|---|---|
| Hero bio, contact line, top-right button text + destination, mouse destination, laptop screen video | `settings` (`hero.*`) + `media` | Homepage |
| Laptop buttons (label, hover text, destination, colour, order, active) | `laptop_buttons` | Homepage |
| Social/contact channels | `social_channels` | Homepage |
| About name/role/picture/text | `settings` (`about.*`) | About |
| Selected Work title, "All" label | `settings` (`work.*`) | Selected Work |
| Categories | `categories` | Selected Work |
| Projects, gallery, metrics | `projects`, `project_media`, `project_metrics` (**only `title` is required**) | Selected Work |
| Articles (schema ready, public UI later) | `articles` | Articles |
| Footprint title/text/countries (count is `COUNT(*)`) | `settings` (`footprint.*`), `countries` | Global Footprint |
| Mobile/tablet closing statement (bold lead + faded continuation) | `settings` (`hero.closing_lead`, `hero.closing_rest`) | Homepage |
| Copyright, “made by” footer line, site name, contact email, default theme | `settings` (`site.*`) | Settings |

New projects / countries / links are **rows**. Only structural changes need a new file in `migrations/`.

## Security notes
Passwords are bcrypt hashes; sessions are signed httpOnly `SameSite=Strict` cookies; writes also need an `X-Admin` header; login is
rate-limited; admin HTML fields are sanitised server-side (allow-list); uploads are type/size-limited with random file names.

## Notes / known gaps
* The seeded projects, countries and bio are **sample content** from the prototype; replace them in the admin.
* Three.js loads from cdnjs. Self-host it under `public/` if you want zero third-party requests.
* Public Articles UI and the Playground page are intentionally not designed yet (routes/data are ready).
* `public/map-data.json` is generated geometry (world-atlas) — it is not editable content.
