# Singapore startup map

Next.js (App Router) app with a [MapLibre](https://maplibre.org/) map, clustered markers, and startup data in **[Supabase](https://supabase.com/)** (Postgres). Optional [TinyFish](https://docs.tinyfish.ai/) **Search** + **Fetch** (and **Agent** when `useAgent` is enabled) can discover and merge rows server-side. A bundled [`data/startups.json`](data/startups.json) is the seed source for a one-time `npm run db:seed` into Supabase.

**Visitors:** the site is for discovering startups; public analysis runs and hosting are your (operator) cost — end users are not billed for TinyFish or infrastructure.

## Supabase (required)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the script in [`supabase/migrations/20260426120000_init_startups.sql`](supabase/migrations/20260426120000_init_startups.sql) to create `store_meta` and `startups`.
3. In **Project Settings → API**, copy the **Project URL** and the **service role** `secret` key (server-only; never use in the browser or commit to git). If your key format changes, the official `service_role` JWT from the same page also works with `@supabase/supabase-js`.
4. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (see `.env.example`).
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

Click **Add your startup** in the header, enter a public `https://` company site, and run the live flow (no custom prompt — the server uses a fixed founder profile goal). The app calls `POST /api/tinyfish/agent-sse`, which proxies TinyFish’s **`/v1/automation/run-sse`** stream to the browser (your API key stays on the server). You get:

- A **scrollable log** of `PROGRESS` and other events.
- A **live iframe** when a `STREAMING_URL` event is received (remote browser view).
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
- `POST /api/startups/merge-one` — merge one company by website into Supabase. If the host is already in the store, returns `alreadyOnMap: true` and **does not** call TinyFish. Otherwise uses Fetch (and a structured-extract fallback) and needs `TINYFISH_API_KEY` on the server.
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
