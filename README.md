# Dominion Portfolio — interactive 3D portfolio + MySQL admin CMS

Public site (Three.js 3D laptop, scroll-to-enter, Selected Work, Global Footprint map) **reads everything from MySQL through an API**.
`/plug` is the protected CMS. Change something there and the public site changes — no code edits.

```
Admin (/plug)  ──►  Express API (/api/admin, auth + CSRF)  ──►  MySQL  ──►  Public API (/api/content)  ──►  Website
```

## Audit result (what existed before this project)
The only thing that existed was a **single-file HTML prototype** (vanilla JS + Three.js r128 from a CDN). There was no framework, no
`package.json`, no `db.json`, no backend, no auth and no upload code. All content was hardcoded in that file. So the framework
decision was made on that evidence: **Node.js + Express + MySQL** keeps the 3D frontend exactly as-is (no React/Next/Laravel migration),
and Hostinger runs Node.js apps natively.

## Structure
```
server/            index.js (app + routes) · render.js (SEO/head, preloader, inlined content) · upload.js (persistent media)
                   db.js · auth.js · migrate.js · seed.js · routes/public.js · routes/admin.js · views/index.html · assets/preloader.js
migrations/        001_init · 002_closing_statement_and_footer · 003_site_settings  (add 004_… for STRUCTURAL changes only)
public/            map-data.json · favicon.svg (default) · plug/ (the admin app, served at /plug)
scripts/           create-admin.js · hash-password.js · media-check.js
uploads/           local-dev default only (git-ignored). In production set UPLOAD_DIR elsewhere.
```

## URLs
| URL | What |
|---|---|
| `/` | Homepage (hero, Selected Work, Global Footprint) |
| `/about`, `/playground` | Real pages (server-rendered head: title, description, canonical, robots). Lowercase, no trailing slash; `/About` and `/about/` 301 to the canonical. Refresh, back and forward work. `/playground` is `noindex` until it has content (flip it in `server/render.js`). |
| `/plug` | Admin dashboard (`noindex`). **`/admin` does not exist and returns a real 404.** The JSON API still lives under `/api/admin/*`; it is not a page, and every route there requires a signed-in session. |
| `/robots.txt`, `/sitemap.xml`, `/favicon.ico` | Generated. `/favicon.ico` redirects to the uploaded favicon or the default icon. |

Note: a hidden URL is not security. Access to `/plug` is protected by login (bcrypt, signed httpOnly SameSite=Strict cookie, CSRF header, rate limit).

## Persistent media (why uploads used to vanish, and the exact arrangement)
**Cause.** Uploads were saved to `<project>/uploads` (the default, and the value in the old `.env.example`). That folder is git-ignored, so each deploy (a fresh checkout/container of `main`) recreated it empty, while MySQL still held the `media` row. The site then asked for a file that no longer existed. Reproduced: upload OK (HTTP 200) -> fresh checkout -> same URL 404, row still in MySQL.

**Fix.** Set `UPLOAD_DIR` to a directory outside the project that your host keeps between deploys (see `.env.example`). Then:
* The file lives in `UPLOAD_DIR`; MySQL stores only its file name (`media.path`); the public URL is `/uploads/<name>` (served with long cache, `nosniff`, and a CSP sandbox so an uploaded SVG can never run script).
* On start the server checks the folder against a marker also recorded in MySQL. If the folder was erased or replaced it logs `STORAGE RESET`, the admin shows a warning and the **Storage health** panel, and the public API stops advertising missing files so the site falls back gracefully (the laptop screen shows the generated screen, not a black box).
* Missing files cannot be recovered from MySQL. Admin -> Media -> click the flagged item -> **Replace file** restores it under the same id, so every setting/project that used it works again.
* If you move `UPLOAD_DIR` out of the project, existing files in `./uploads` are **copied** across at start (never moved or overwritten).
* `npm run media:check` lists rows whose file is missing (exit code 2 if any).
* Uploads are validated by real file bytes (not just the declared type), images <= 12 MB, video <= 80 MB, scripted SVGs rejected.

## Settings added in 003 (all rows in the existing `settings` table)
`hero.mobile_scroll` (1/0, phones only) · `site.favicon_media_id` · `hero.nav_image_media_id` · `preloader.enabled` · `preloader.duration` (800–3500 ms, clamped server-side) · `preloader.text`.
Preloader: the duration sets the animation only. The site is revealed as soon as the hero is ready (a fast app fast-forwards the animation in ~350 ms; a slow one never stays hidden longer than 9 s).

## Run locally
```bash
npm install
cp .env.example .env        # fill DB_* and a long random JWT_SECRET
npm run migrate             # creates all tables (tracked in the `migrations` table)
npm run seed                # optional: loads the sample content from the prototype
npm run create-admin        # prompts for admin email + password (never hardcoded)
npm start                   # http://localhost:3000   admin: /plug
```

## Is this "only HTML"? — what the stack actually is
* **Backend:** Node.js + Express REST API (`server/`), MySQL via `mysql2` connection pool.
* **Frontend:** the portfolio page (`server/views/index.html`) is plain JavaScript + Three.js. It is served by the Node app and fetches all content from `/api/content` at load. It is *not* a static export: nothing on it is hardcoded, and it only works with the backend + database.
* **Admin:** a separate single-page app in `public/plug/`, talking to the protected `/api/admin/*` endpoints.
* Frontend and backend live in one app on one domain, so there is no API URL / CORS setup to get wrong.

## Setup with phpMyAdmin (no migrations run by us)
1. hPanel → Databases → create the MySQL database and user. Open **phpMyAdmin** → select the database.
2. **Import** `migrations/001_init.sql` (creates every table).
3. **Import** `migrations/002_closing_statement_and_footer.sql` and `migrations/003_site_settings.sql` in order (plain SQL, safe on a live site: they only add missing settings and never overwrite yours). On an existing install these two are all you need.
3b. *(fresh install only, optional)* **Import** `database/seed_sample_content.sql` (sample bio, projects, buttons, countries).
4. Create the admin login — pick ONE:
   * SSH/terminal on Hostinger: `npm run create-admin`, **or**
   * anywhere with Node: `node scripts/hash-password.js you@example.com 'your long password'` → paste the printed `INSERT` into phpMyAdmin → SQL.
5. Later structural changes arrive as `migrations/002_….sql`, `003_….sql` … — import them the same way (or `npm run migrate`; it detects tables already created by hand).

## Deploy on Hostinger (Node.js app)
1. hPanel → Websites → **Node.js app**, connect this GitHub repo, branch `main`. Start file: `server/index.js`. Run `npm install`.
2. Add every variable from `.env.example` as an **environment variable** (DB_*, a long random `JWT_SECRET`, `NODE_ENV=production`, `SITE_URL`, and above all `UPLOAD_DIR`: see *Persistent media* above).
3. Put `UPLOAD_DIR` **outside** the deployed code (e.g. `/home/USER/portfolio-uploads`) so redeploys never delete media.
4. Use HTTPS (admin cookies are `secure` in production). Open `/plug`, sign in, and check Admin -> Media -> Storage health says **Persistent ✓**.

## Built for traffic
* `/api/content` is cached in memory (rebuilt at most once per 30 s, and **immediately** after any admin edit), so thousands of visitors cost almost no database work. Concurrent rebuilds are coalesced.
* gzip/deflate compression, cache headers for static files, `ETag` revalidation, per-IP rate limiting (`RATE_LIMIT_MAX`), DB connection pooling, and crash guards so one bad request cannot take the process down.
* Local load test (200 concurrent connections, 10 s, 1 CPU, same machine as the DB): ~2,900 req/s on `/api/content`, p99 ≈ 100 ms, 0 errors. Real throughput depends on your Hostinger plan; for large spikes put Cloudflare (free) in front and it will serve the static page and map file from its edge.

## Migrations
* `001_init.sql` — all tables. * `003_site_settings.sql` — data-only; adds the settings above and rewrites the old `#/about` / `#/playground` targets to `/about` / `/playground`. * `002_closing_statement_and_footer.sql` — data-only: adds the mobile/tablet closing statement (`hero.closing_lead`, `hero.closing_rest`) and the footer line (`site.made_by`) to the key/value `settings` table, and renames the centre laptop button to "Click Me" **only if it still has the default label "Work"**. It uses `INSERT IGNORE`, so it never overwrites anything you edited. Import it in phpMyAdmin (or `npm run migrate`).

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
