# TWB (Toilets with Bidets)

TWB is a mobile-first web app that maps every recorded bidet-equipped toilet across Singapore. It pairs an interactive, clustered map with a synchronized, filterable list view. Data comes from the community-maintained **Toilets with Bidets SG** Google Sheet and Google My Maps (read-only, no auth), is synced daily by GitHub Actions, deployed on Vercel. Visitors can also leave a short crowd-sourced remark on any location.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Project Structure](#project-structure)
5. [Data Pipeline](#data-pipeline)
6. [Community Remarks (Supabase)](#community-remarks-supabase)
7. [Automation & CI](#automation--ci)
8. [Deployment](#deployment)
9. [Contributing](#contributing)
10. [License](#license)

---

## Features

* **Interactive Map**: MapLibre GL with native marker clustering; click a cluster to zoom in, click a pin for details and directions.
* **Live Location**: Geolocate control that flies to and tracks the visitor's position (browser permission required).
* **Filterable List View**: Search by name/address/region; filter by region, facility type (Male / Female / Hotel), gender tab, and derived amenities (wheelchair access, baby changing, unisex, bidet in all cubicles).
* **Community Remarks**: One wiki-style editable remark (max 280 chars) per location, shared by all visitors.
* **Themes**: Light / Dark / OLED-black toggle, persisted per visitor, following system preference by default; the basemap follows the theme.
* **Mobile-First**: Responsive layouts for phones, tablets, and desktops using Tailwind CSS.
* **SEO & Sharing**: Generated OG image, JSON-LD, sitemap, robots, and web manifest.
* **Zero Sign-In**: Fully public- no accounts.

## Tech Stack

* **Framework**: Next.js 15 (App Router) with TypeScript and Tailwind CSS 4
* **Map**: MapLibre GL via `@vis.gl/react-maplibre`, free OpenFreeMap vector tiles (`liberty` light / `dark` styles)
* **Data Pipeline**: `scripts/fetch-data.mjs` (Node, `csv-parse`, regex-based KML extraction, OneMap geocoding)
* **Community Remarks**: Supabase (Postgres + RLS) via `@supabase/supabase-js`, server-side only
* **Observability**: Vercel Web Analytics & Speed Insights
* **Testing**: Vitest (`npm test`) covering data processing, filtering, remarks & feedback APIs
* **CI/CD**: GitHub Actions (type-check, lint, test on push/PR; daily data sync) + Vercel Git integration

## Getting Started

### Prerequisites

* Node.js 20+ and npm
* (Optional) A Supabase project, only needed for community remarks

### Setup

1. **Clone & install**

   ```bash
   git clone https://github.com/shondoe11/twb.git
   cd twb
   npm install
   ```

2. **Environment variables** (optional, for community remarks)

   ```bash
   cp .env.example .env.local
   ```

   Fill in `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` from Supabase Dashboard → Settings → API. These are read server-side only and never shipped to the browser. Without them the remarks UI degrades gracefully.

3. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). `data/combined.geojson` is committed, so no data sync is required for a fresh clone.

4. **(Optional) Refresh data locally**

   ```bash
   npm run sync-data
   ```

### Scripts

| Command             | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `npm run dev`       | Start Next.js dev server                                        |
| `npm run build`     | Production build                                                |
| `npm start`         | Serve the production build                                      |
| `npm run lint`      | ESLint                                                          |
| `npm test`          | Vitest unit tests                                               |
| `npm run sync-data` | Fetch Sheets + My Maps, geocode, write `data/combined.geojson` |

## Project Structure

```
/
├── .github/workflows/
│   ├── ci.yml                 # tsc, lint, test
│   └── sync-data.yml          # daily data sync
├── data/
│   ├── combined.geojson       # generated dataset
│   └── cache/geocode.json     # OneMap geocode cache
├── public/                    
├── scripts/
│   └── fetch-data.mjs
├── src/
│   ├── app/
│   │   ├── api/locations/     # GET processed ToiletLocation[] (edge-cached 1h)
│   │   ├── api/remarks/       # GET/POST community remark per location
│   │   ├── api/feedback/      # POST form submission
│   │   ├── about/             
│   │   ├── feedback/          # form
│   │   └── ...                # layout, page, manifest, sitemap, robots, og image
│   ├── components/            # Map, ListView, FilterBar, CommunityRemarks, FeedbackForm, FeedbackLink, ThemeToggle, TwbIcon
│   └── lib/
│       ├── data/client/       # fetchLocations, filterLocations
│       ├── data/server/       # readCombinedGeoJSON, geoJSONToLocations
│       ├── data/shared/       # ToiletLocation & GeoJSON types
│       ├── supabase/          # server-side supabase client
│       ├── rateLimit.ts       # per-ip write limiter shared by write apis
│       └── feedback.ts        # feedback categories & limits shared by form + api
├── supabase/schema.sql        # community_remarks + feedback tables & RLS policies
└── vitest.config.ts
```

## Data Pipeline

`npm run sync-data` runs `scripts/fetch-data.mjs`:

1. **Google Sheets (CSV)** - fetches all three public tabs (`MALE TOILETS`, `FEMALE TOILETS`, `HOTEL ROOMS W BIDET`) via `https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=<TAB_GID>`. Rows without a name are dropped.
2. **Google My Maps (KML)** - fetches `https://www.google.com/maps/d/kml?forcekml=1&mid=<MAP_ID>` and extracts placemarks (name, coordinates, description) into GeoJSON.
3. **Coordinates** - each sheet row is matched to a KML pin by name (exact → lowercase → parentheses-stripped → alphanumeric-normalized). Rows with no pin are geocoded via **OneMap** (SG's official geocoder) using the sheet address; results are cached in `data/cache/geocode.json`. Rows that cannot be resolved are excluded.
4. **Merge** - sheet rows and map pins for same venue are merged into one feature; regions are normalized (or derived from coordinates), and the result is written to `data/combined.geojson`.

The pipeline exits non-zero if the sheet fetch returns no rows, so a bad upstream response never overwrites good data.

At request time, `/api/locations` reads `combined.geojson` and `geoJSONToLocations` turns it into `ToiletLocation[]`: venues that appear in both the Male and Female tabs are merged into a single location carrying both tags and both remarks, and amenity flags are derived from remark keywords.

## Community Remarks (Supabase)

* One row per location in `public.community_remarks` (see `supabase/schema.sql`); `location_id` is the primary key so edits are upserts.
* `/api/remarks` validates the posted `locationId` against the canonical dataset, stamps name/address/region server-side, caps content at 280 chars, and applies a lightweight per-instance write rate limit.
* RLS lets the anon key read and upsert; the length constraint is enforced in Postgres regardless of client input.
* Set up: paste the whole of `supabase/schema.sql` into Supabase SQL editor and run it (idempotent - safe to re-run on existing project, never touches rows), then add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to Vercel (and `.env.local`).

## Feedback Form (Supabase)

* `/feedback` (linked from home and about headers) posts to `/api/feedback`, which inserts into `public.feedback` - an append-only inbox with `category`, `message` (≤1000 chars), optional `contact` (≤200), the referring `page`, `user_agent` and `created_at`.
* RLS grants anon key **insert only** - there are no select/update/delete policies, so submissions can never be read back through publishable key. Read them in Supabase Dashboard → Table Editor → `feedback`.
* Abuse dampening
* Same env vars as remarks; same `schema.sql` creates both tables.

## Automation & CI

* **`ci.yml`** - on every push to `main` and every PR: `tsc --noEmit`, `npm run lint`, `npm test`.
* **`sync-data.yml`** - daily at 00:00 UTC (and on manual dispatch): runs `npm run sync-data`, and if `data/` changed, commits as `github-actions[bot]` and pushes. The push triggers a Vercel deploy via Git integration. If nothing changed, no commit or deploy happens
* **Supabase keepalive** - the same workflow pings `<APP_URL>/api/remarks` so Supabase never pauses from inactivity. Set the `APP_URL` repository variable to enable it.

## Deployment

1. Import the repo into Vercel; it builds and deploys on every push to `main`.
2. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as environment variables if using community remarks.
3. `next.config.ts` traces `data/combined.geojson` into the serverless bundle for both API routes, so no extra config is needed for the data to be available at runtime.

## Contributing

1. Fork and branch (`feature/...` or `fix/...`).
2. Make sure `npx tsc --noEmit`, `npm run lint`, and `npm test` pass.
3. PR

## License

MIT - see [LICENSE](./LICENSE).
