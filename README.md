# Singapore startup map

## About the project

**Singapore startup map** is a small web app for **discovering startups in Singapore** on an interactive [MapLibre](https://maplibre.org/) map, with a searchable list, filters, and company detail views (stage, sector, hiring, links). The audience is anyone browsing the ecosystem; **founders** can use **Add your startup** (when the operator enables it) to submit a public company website so the server can read the page, infer a profile, and save it to the map.

**Data and services:** company rows are stored in **[Supabase](https://supabase.com/)** (Postgres). [TinyFish](https://docs.tinyfish.ai/) is used for search, page fetch, structured extraction, and the optional **live agent** (SSE) during that add flow. An initial dataset ships as [`data/startups.json`](data/startups.json) and is loaded with `npm run db:seed` after you configure the database.

**Responsibility and cost:** whoever **deploys and operates** the site pays for hosting and third-party API usage. **Public visitors are not billed** for TinyFish, Supabase, or infrastructure. The app is built with [Next.js](https://nextjs.org/) (App Router) and server-side API routes; configuration is env-driven, as in the rest of this README.

## Supabase (required)

1. Create a project at [supabase.com](https://supabase.com).
2. Create tables: open **SQL Editor** and run [`supabase/migrations/20260426120000_init_startups.sql`](supabase/migrations/20260426120000_init_startups.sql) (adds `store_meta`, `startups`, and reloads the API schema cache). Or from this repo, set `DATABASE_URL` in `.env.local` (see **Settings → Database → Connection string, URI** with your password) and run `npm run db:migrate`.
3. In **Project Settings → API**, copy the **Project URL** and a **server** key for `SUPABASE_SERVICE_ROLE_KEY` (see below). Never use the **Publishable** key for the server; never commit keys to git.
4. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (see `.env.example`). For **Render**, set the same variables under **Web Service → Environment** and **redeploy** after changing them.

**If you see `Invalid API key`:** On the same API page, use the long **legacy** `service_role` JWT (starts with `eyJ...`) from **Project API keys** as `SUPABASE_SERVICE_ROLE_KEY`, or the **Secret** from **Secret keys** (not the Publishable key). Keys must be copied in full, one line, no extra quotes.

**`TypeError: fetch failed`:** Wrong project URL, project paused, or network/firewall. Open the project URL in a browser; restore the project in the Supabase dashboard if paused.

**`Could not find the table` / not in the schema cache:** The migration in step 2 was not run on this project (or PostgREST needs a cache reload; the script ends with a notify to reload the schema). Run the SQL in step 2, then call `/api/startups` again. No Render redeploy is required for a DB-only change.

**Debugging “my API key is correct”:** The app uses **two vendors**: [Supabase](https://supabase.com/) (DB) and [TinyFish](https://www.tinyfish.io/) (Fetch + live agent for “Add your startup”). A working Supabase key does **not** cover TinyFish. Check **`GET /api/health`** on your deployment (booleans only, no secret values) to see which env names the server actually loaded.
5. Seed the database from the repo seed file: `npm run db:seed` (requires env vars from step 4).

## Setup

```bash
npm install
cp .env.example .env
# set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, then:
npm run db:seed
# add TINYFISH_API_KEY and ENRICH_SECRET for enrichment / live agent
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Logos

Markers and list entries load each company’s **favicon** through **`GET /api/logo?domain=…`** (or `?src=` for a custom `logoUrl`). The server fetches Google’s favicon service and returns image bytes **same-origin**, so MapLibre can render them in WebGL (direct third-party favicon URLs often fail due to CORS and you only see the letter fallback). Optional `logoUrl` in `data/startups.json` is proxied when it is a public `http(s)` URL. If the proxy fetch fails, the UI falls back to the first letter of the company name.

## Live TinyFish agent (SSE)

Click **Add your startup** in the header, enter a public `https://` company site, and run the live flow (no custom prompt — the server uses a fixed founder profile goal). The app calls `POST /api/tinyfish/agent-sse`, which proxies TinyFish’s **`/v1/automation/run-sse`** stream to the browser (your API key stays on the server). The request body matches the same automation fields used in [Propelix](https://github.com/M-Sharan-Balaji/propelix) (`browser_profile`, `proxy_config`, `api_integration`, plus `url` and `goal`). Optional env: `TINYFISH_API_INTEGRATION` (default `sg-startup-map`). You get:

- A **scrollable log** of `PROGRESS` and other events.
- A **link to open the live session** in a new tab when a `STREAMING_URL` arrives (embedding is usually blocked in-page).
- A **JSON result** when the run `COMPLETE`s.

Set `TINYFISH_API_KEY` in `.env.local` (see `.env.example`). Do not commit real keys to git.

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `SUPABASE_URL` | Server, `.env` | Supabase project URL (`https://…supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server, `.env` | Service role `secret` — **server only**; bypasses RLS. Do not use the anon key for writes. |
| `TINYFISH_API_KEY` | Server, `.env` | Search / Fetch / Agent calls to TinyFish (never in client bundles). |
| `ENRICH_SECRET` | Server, `.env` | Protects `POST /api/admin/enrich` (header `x-enrich-secret` or `Authorization: Bearer`). |
| `NEXT_PUBLIC_MAP_STYLE` | Optional | Map style URL; defaults to Carto Positron. |

## API

- `GET /api/startups` — read store; query params: `q`, `stage`, `sector`, `hiring` (`1` / `0`).
- `GET /api/startups/lookup?url=…` — validate a public URL and return whether the host is **already in the map** (used by the Add your startup form). No API key.
- `POST /api/startups/merge-one` — JSON: `{ "url": "https://…" }`. Optional: `{ "agentResult": … }` (the live agent COMPLETE payload from the Add startup flow) so the server can save **without** a second page Fetch. If the host is already in the store, returns `alreadyOnMap: true` and **does not** call TinyFish. Otherwise it tries the agent result first, then Fetch, then a structured-extract run; `TINYFISH_API_KEY` is required on the server for Fetch/extract.
- `POST /api/admin/enrich` — run enrichment (requires `ENRICH_SECRET` and `TINYFISH_API_KEY`). JSON body: `{ "query": "Singapore proptech startup", "maxSearchPages": 2, "useAgent": false, "maxFetchUrls": 20 }`.

## CLI enrichment

From the project root, with `.env` loaded:

```bash
npm run enrich -- "Singapore cleantech startup"
npm run enrich -- --query "Singapore proptech startup" --use-agent
```

Rate limits and credits apply per your TinyFish plan. Failed Fetch URLs are reported in `result.errors` and do not bill per TinyFish’s docs.

**Hiring field:** For `useAgent: true`, hiring comes from the TinyFish structured extract (`hiring` on each row). For the default **Fetch** path (`useAgent: false`), the pipeline sets `hiring` using a **text + URL heuristic** (career paths, “we’re hiring”, “open roles”, and similar). It is a best effort from public page content, not a guarantee. When merging into an existing hostname, a `true` from any run is kept.

## Host on [Render](https://render.com)

1. Push this repo to GitHub (or connect GitLab/Bitbucket).
2. In the Render [Dashboard](https://dashboard.render.com), **New +** → **Blueprint** and select the repo, or create a **Web Service** and connect the repo.
3. **Build command:** `npm ci && npm run build` | **Start command:** `npm start` | **Runtime:** Node. Use the included [`render.yaml`](render.yaml) to apply settings automatically, or set them manually to match.
4. **Environment variables:** In the service → **Environment**, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, plus `TINYFISH_API_KEY` / `ENRICH_SECRET` as needed. The Blueprint can autogenerate `ENRICH_SECRET`.
5. **Data:** The app no longer uses a file-based JSON store; Supabase is the source of truth. Run the SQL migration and `npm run db:seed` (or your own import) at least once when deploying a new project.

## Production notes

- Keep `SUPABASE_SERVICE_ROLE_KEY` and all API keys in the host’s secret store, not in the repo. Never expose the service role key in client code or the browser.
- [Rotate keys](https://supabase.com/docs/guides/platform/going-into-prod) if a secret is ever shared or leaked.

## Scripts

| Script | Action |
|--------|--------|
| `npm run dev` | Development server (Turbopack). |
| `npm run build` | Production build. |
| `npm run start` | Run production build. |
| `npm run lint` | ESLint. |
| `npm run enrich` | CLI TinyFish pipeline (see above). |
| `npm run db:seed` | Load `data/startups.json` into Supabase (requires `SUPABASE_*` env and migration applied). |
