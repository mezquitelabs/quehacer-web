# quehacer-web

Static site for a city-events data set (Astro, TypeScript, plain CSS). It **only reads JSON files**
(`src/data/<city>.json` and `src/data/meta.json`, produced by a separate data exporter and published on this repo's
`data` branch, see "Where the data comes from") and has no access to anything else, so the exporter's code, database and credentials never live in this repo.

## Data notice

The events shown here come from **third-party sources**. Each event links to its original page and no rights over that data
are claimed; titles, venues and images belong to their sources (images are linked from the source's own server, not copied).
The site's footer says the same in Spanish. The structure of the files the site reads is described in
[`docs/data-contract.md`](docs/data-contract.md).

Spanish UI, light and dark mode (`prefers-color-scheme`), no UI framework, no CSS framework, no external fonts, no CDN
scripts, no trackers. One small script powers the two client-side filters (day and category).

## Run it locally

Needs Node 18.17.1+ (Astro 4 is pinned because of that; see "Dependencies").

```bash
cd quehacer-web
npm install
npm run dev          # http://localhost:4321/quehacer-web/  (live reload; see the base path below)
npm test             # unit tests for the filter logic
npm run typecheck    # tsc on the .ts files
npm run build        # static site in dist/
npm run preview      # serve dist/ at http://localhost:4321/quehacer-web/
```

`src/data/*.json` is **not tracked on `main`** (it is git-ignored), so a fresh clone has no data and `npm run build` fails until
you provide it. Generate it from the crawler checkout (`~/quehacer`):

```bash
cd ~/quehacer
.venv/bin/python -m quehacer.cli export-site --out ~/quehacer-web/src/data     # or set WEB_REPO_PATH and omit --out
```

The exporter has no built-in default location. `npm test` skips the suite that validates the real data files (with a message)
when `src/data` is absent; a tiny synthetic sample in `tests/fixtures/data` keeps the validator itself covered.

The files must follow the [data contract](docs/data-contract.md). `meta.json`'s `schema_version` is checked at build time:
a mismatch stops the build with a message instead of publishing a broken site.

## Pages

| URL | What |
|---|---|
| `/` | links to every city found in `src/data` |
| `/<city>/` | upcoming events grouped by local day, soonest first, with the filters |
| `/<city>/en-curso/` | ongoing entries (exhibitions, workshops, clubs) with their date range |

Pages are generated for **every** `src/data/<city>.json`; adding a city needs no code change, only its JSON file and its
entry in `meta.json` (both come from `export-site`). A city file without a `meta.json` entry fails the build with a clear message.

Filters (client-side, no reload; with JS disabled the full list is simply shown):

- **Day:** Hoy, Este fin de semana, Próximos 7 días, Todos (default). Days are the **city's** local days (from
  `meta.json`'s timezone), not the browser's, so events near midnight are filed correctly. "Este fin de semana" is Saturday
  and Sunday (on Saturday it starts today; on Sunday only today is left). "Próximos 7 días" is today plus the next six.
- **Category** chips, multi-select (none selected = all), each with a count of **events** (not cards). The counts follow the
  day filter. Chips with no events are hidden, except one the visitor has selected (so it can still be un-selected).

What the page shows and hides:

- **Grouped days.** When 4 or more events share a venue on the same day (as displayed), they become one card
  "<Venue> · N funciones" that expands (`<details>`, no library) to the time, title and link of each function. Set
  `GROUP_MIN_EVENTS` (an integer of at least 2; default 4) at build time to change the threshold. Events without a venue
  are never grouped. While filters are active, a group lists only its matching functions and its number follows them.
- **Finished events are hidden in the browser**, because the page is a snapshot built earlier: an event with an end time
  disappears once it has ended; one with no end time disappears 3 hours after it started (exactly 3 hours is still shown);
  a date-only event stays for its whole local day. Counts and filters ignore hidden events. If all are over, a message says so.
- **Venue text:** only what precedes " | " is shown, and " I " becomes " · " (the exported data is not changed).
  Categories are shown with a capital initial.

## `site` and `base` (GitHub Pages or a custom domain)

Both can be set from environment variables (read in `astro.config.mjs`; in CI, from repository variables); every internal
link goes through `withBase()`. An empty variable counts as unset.

**Two sets of defaults, on purpose.** The code defaults (`src/lib/site-config.ts`: `SITE_URL=https://mezquitelabs.github.io`,
`BASE_PATH=/quehacer-web`) are for local work, so `npm run dev` serves at `http://localhost:4321/quehacer-web/`. The deploy
workflow overrides them for production: `SITE_URL=https://quehacer.mx` and `BASE_PATH=/`, because the site lives on the
custom domain at the root.

| Where it is served | `SITE_URL` | `BASE_PATH` |
|---|---|---|
| `https://quehacer.mx/` (production, set by the workflow) | `https://quehacer.mx` | `/` |
| `http://localhost:4321/quehacer-web/` (local default) | (default) | (default) |
| `https://mezquitelabs.github.io/quehacer-web/` (project site) | (default) | (default) |

```bash
npm run build                                                          # the local defaults (project-site paths)
SITE_URL=https://quehacer.mx BASE_PATH=/ npm run build                 # what production builds
SITE_URL=https://example.com BASE_PATH=/ npm run build                 # any other custom domain
```

`GROUP_MIN_EVENTS` works the same way (`GROUP_MIN_EVENTS=6 npm run build`).

`npm run preview` reads the same variables, so give it the same `BASE_PATH` you built with (for a build with `BASE_PATH=/`, run
`BASE_PATH=/ npm run preview`, served at `http://localhost:4321/`); a mismatch serves the files at one path while the links carry another.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` checks out `main` and the `data` branch, runs the tests, builds with the official Astro action
and publishes on **every push to `main` or `data`** (and on demand: Actions > Deploy > Run workflow). It needs **no
secrets**; deploys never overlap (one `pages` concurrency group, queued, never cancelled). It fails with a clear message if
`data` is missing or empty. Nothing here creates the remote repo or pushes anything. Manual steps:

1. **The repo** is `mezquitelabs/quehacer-web` on GitHub; add it as `origin` (through an SSH host alias that uses that account's key).
2. **Visibility.** GitHub Pages on the free plan needs a **public** repository (a private one needs a paid plan). The site itself
   is public either way. The repo contains no exporter code or secrets; the `data` branch holds what the site shows.
3. **Settings > Pages > Build and deployment > Source: GitHub Actions.**
4. **Production is the custom domain `https://quehacer.mx/`.** The workflow's defaults are `SITE_URL=https://quehacer.mx` and
   `BASE_PATH=/`, so no repository variables are needed. `public/CNAME` (`quehacer.mx`) keeps the domain set on every deploy.
5. **Custom domain setup (one time):** in DNS, point the apex at GitHub's four `A` records (`185.199.108.153`, `.109.153`,
   `.110.153`, `.111.153`) and `www` with a `CNAME` to `mezquitelabs.github.io`; with Cloudflare keep both records
   **DNS only** (grey cloud) so GitHub can issue the certificate. Set the domain in Settings > Pages and tick
   **Enforce HTTPS** once the certificate is ready. To publish somewhere else (another domain, or the project site again),
   set the repository **variables** (Settings > Secrets and variables > Actions > Variables) `SITE_URL` and `BASE_PATH`.
6. Push `main`. The first run asks you to approve the `github-pages` environment if it is protected.

The workflow installs with `npm ci`, so commit `package-lock.json` (it is).

## Where the data comes from

Code and data live on **different branches** of this repository:

| Branch | Holds | Written by |
|---|---|---|
| `main` | the site's code, tests and workflow | normal pushes by hand |
| `data` | `src/data/meta.json` and `src/data/<city>.json`, nothing else | the crawler, once a day (`quehacer daily`, which ends with `quehacer publish-site`) |

`data` is **replaced with a single orphan commit on every publish** (force-push with a lease, author `quehacer-bot`, message
`Update event data <UTC timestamp>`), so the public history never accumulates snapshots of third-party data. Never commit to
`data` by hand and never merge it into `main`.

```
crawler: sync -> publish-site -> force-push `data` (deploy key)
                                      |  push to `data` triggers
GitHub Actions: checkout main + checkout data -> copy data into src/data -> npm test -> build -> Pages
```

The push of `data` triggers the workflow, so every publish rebuilds the site with a fresh "Actualizado". A push to `main`
(code change) rebuilds it with the current `data`.

### If the `data` branch is deleted (or damaged)

The workflow then fails with "Missing data branch" (or "Empty data branch") and the live site keeps its last good deploy. To
recover, run from the crawler checkout:

```bash
cd ~/quehacer
.venv/bin/python -m quehacer.cli publish-site        # recreates the branch from the crawler's database
```

It needs `QUEHACER_DATA_REMOTE` in the crawler's `.env` (deploy-key alias URL). The push creates `data` from nothing (the lease
expects it absent) and triggers a deploy. If an export looks too small compared with the last publish, add `--force-small`
once. The crawler's database is the source of truth, so nothing is lost.

## Layout

```
src/data/            <city>.json + meta.json (git-ignored; from the `data` branch or the crawler's export-site)
tests/fixtures/data/ tiny synthetic sample that keeps the contract test running without real data
src/lib/filters.ts   pure filter logic (+ filters.test.ts)
src/lib/format.ts    Spanish date/time formatting in the city's timezone
src/lib/url.ts       withBase()
src/pages/           index, [city]/index, [city]/en-curso
src/components/      Layout, EventCard
```

## Dependencies

`astro`, plus `typescript` and `vitest` for development. **Astro is pinned to 4.x because the development machine runs
Node 18**; Astro 5+ needs a newer Node (the current release requires Node 22.12+). `npm audit` lists advisories against
Astro 4; they concern server rendering, islands, middleware, image optimization and the dev server, none of which this
fully static site uses (no adapter, no `astro:assets`). Upgrading Node and Astro together is advisable.

## Known limits

- Images are linked straight from each source. If a source changes or blocks hotlinking the image disappears and the card
  stays complete (the script removes broken images).
- Event times are the source's stated times; "Hora por confirmar" is shown when a source gives only a date.
- Filters work on the snapshot built at the last publish; the "now" used by "Hoy" etc. is the visitor's clock.
