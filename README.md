# TWB (Toilets with Bidets)

TWB is a mobile-first, static web application that showcases all bidet-equipped toilets across Singapore. It features an interactive map paired with a synchronized, filterable list view. The project uses Google Sheets and Google My Maps as read-only data sources, automated via GitHub Actions for seamless updates, and is deployed on Vercel’s free tier.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Getting Started](#getting-started)
5. [Project Structure](#project-structure)
6. [Data Sources & Sync](#data-sources--sync)
7. [Deployment](#deployment)
8. [Contributing](#contributing)
9. [Roadmap & Status](#roadmap--status)
10. [License](#license)

---

## Project Overview

TWB is designed to provide users with a quick and easy way to locate toilets equipped with bidets throughout Singapore. The application prioritizes fast load times and smooth interactions on low-end devices by leveraging static site generation and a lightweight map library.

## Features

* **Interactive Map**: Pan, zoom, and click on markers to see details.
* **Filterable List View**: Search and filter locations by region, facility type, or amenities.
* **Mobile-First Design**: Responsive layouts for phones, tablets, and desktops using Tailwind CSS.
* **Read-Only Data Integration**: Data from Google Sheets (CSV) and Google My Maps (KML) without requiring any authentication.
* **Automated Data Sync**: A scheduled GitHub Actions workflow fetches and commits updated data to the repository.
* **Zero Sign-In Required**: Public access with no user accounts or authentication.
* **Dark Mode** *(planned)*: Theme toggle with a dark palette across the map, list, and detail views.

## Tech Stack

* **Framework**: Next.js with TypeScript and Tailwind CSS
* **Map Rendering**: Leaflet.js with React-Leaflet on free CARTO basemap tiles (migration to MapLibre GL + OpenFreeMap vector tiles planned alongside dark mode)
* **Data Parsing**: custom CSV/KML parsing in `scripts/fetch-data.mjs` (csv-parse + regex-based KML extraction)
* **Testing**: Vitest unit tests for data processing & filtering (`npm test`)
* **Deployment & CI**: Vercel (hosting) & GitHub Actions (data sync & redeploy)
* **Optional Analytics**: Plausible or Google Analytics for lightweight usage tracking

## Getting Started

### Prerequisites

* Node.js v18.18+ and npm installed (required by Next.js 15 & React 19)
* GitHub account

### Initial Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/<your-org>/twb.git
   cd twb
   ```
2. **Install dependencies**

   ```bash
   npm install
   ```
3. **Sync location data** (required on a fresh clone - generated data files are gitignored)

   ```bash
   npm run sync-data
   ```
4. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
/
├── public/               # Static assets (images, icons)
├── src/
│   ├── app/              # Next.js App Router (pages, layouts)
│   ├── components/       # Reusable UI & map components
│   ├── lib/              # Data-fetching & parsing utilities
│   └── styles/           # Global & Tailwind CSS styles
├── data/                 # Generated JSON from Sheets & KML
├── .github/
│   └── workflows/        # GitHub Actions for data sync
├── README.md
└── package.json
```

## Data Sources & Sync

* **Google Sheets (CSV)**

  * Public CSV export per tab: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=<TAB_GID>`
  * Fetched by `scripts/fetch-data.mjs` (`npm run sync-data`), which merges Sheets + My Maps data into `data/combined.geojson`
* **Google My Maps (KML)**

  * KML network link: `https://www.google.com/maps/d/kml?forcekml=1&mid=<MAP_ID>`
  * Parsed and converted to GeoJSON by the same sync script
* **Serving**

  * The `/api/locations` route handler reads `data/combined.geojson` from the deployment filesystem on every request (dynamic, not statically cached)
* **Automation**

  * The `postbuild` npm hook runs `npm run sync-data` after every `next build`, so each Vercel deployment ships freshly fetched data.
  * GitHub Actions workflow (`.github/workflows/sync-data.yml`) runs daily: it validates the fetch, then triggers a Vercel Deploy Hook to redeploy with fresh data.
  * Requires a `VERCEL_DEPLOY_HOOK_URL` repository secret (create the Deploy Hook in Vercel: Project Settings → Git → Deploy Hooks, then add its URL as a GitHub Actions secret).

## Deployment

### Vercel Setup

1. Sign in to Vercel and import the `twb` GitHub repository.
2. Configure environment variables (if any) in Vercel dashboard.
3. Vercel will automatically build and deploy on every push to `main`.

**Deploy Button** (add to this README for one-click deploy):

```markdown
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https://github.com/<your-org>/twb)
```

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository and create a new branch (`feature/...` or `fix/...`).
2. Write clear, descriptive commit messages following Conventional Commits.
3. Ensure code passes ESLint and Prettier: `npm run lint` and `npm run format`.
4. Open a pull request describing your changes.

## Roadmap & Status

| Milestone               | Description                                    | Status  |
| ----------------------- | ---------------------------------------------- | ------- |
| Data Ingestion          | Fetch & parse Google Sheets + MyMaps sources   | Done    |
| Map & List Prototype    | Leaflet map with initial list layout           | Done    |
| Filtering & Clustering  | Region/mall/type filters; marker clustering    | Done    |
| Responsive UI           | Mobile/tablet/desktop breakpoints & styling    | Done    |
| CI/CD Pipeline          | GitHub Actions for data sync & Vercel deploy   | WIP     |
| Dark Mode               | Theme toggle + MapLibre/OpenFreeMap migration  | Planned |
| Performance Tuning      | Code-splitting, tile caching, viewport culling | WIP     |
| Documentation & Testing | README, unit & integration tests               | WIP     |

## License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.
