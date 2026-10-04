# quehacer-web

Static site for a city-events data set (Astro, TypeScript, plain CSS). It **only reads JSON files**
(`src/data/<city>.json` and `src/data/meta.json`, produced by a separate data exporter and committed here) and has no
access to anything else, so the exporter's code, database and credentials never live in this repo.

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

Refresh the data, then rebuild: run the exporter's `export-site` command with `WEB_REPO_PATH` set to this checkout
(or `--out <this checkout>/src/data`). The exporter has no built-in default location. The files it writes replace
`src/data/<city>.json` and `src/data/meta.json`.

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

`.github/workflows/deploy.yml` runs the tests, builds with the official Astro action and publishes on **every push to
`main`** (and on demand: Actions > Deploy > Run workflow). Nothing here creates the remote repo or pushes anything.
Manual steps:

1. **The repo** is `mezquitelabs/quehacer-web` on GitHub; add it as `origin` (through an SSH host alias that uses that account's key).
2. **Visibility.** GitHub Pages on the free plan needs a **public** repository (a private one needs a paid plan). The site itself
   is public either way. The repo contains no exporter code or secrets; its data files are what the site shows.
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

## Publishing the data every day (described here, NOT automated yet)

Today the data is published by hand. This is the flow it would follow once automated from the crawler's systemd timer;
nothing below exists as a script or unit yet.

**Flow (one run per day, after the crawl):**

1. **sync** in the crawler. Continue only on exit code `0` or `3` (3 = some sources degraded, the rest are fine; with systemd
   either add `SuccessExitStatus=3` or let a wrapper script read the code). Stop on `1` or `2`: never publish after a failed crawl.
2. **export-site into the web checkout**: `export-site` with `WEB_REPO_PATH` pointing at it.
3. **Checks** (see below). Any failure stops the run before anything is committed.
4. **Commit only if something changed**, then **push** with the deploy key. The push triggers the GitHub Actions workflow,
   which tests, builds and publishes.

**"Changed" needs care:** `meta.json` contains `generated_at`, which differs on every export. Compare the city files
(`git diff --quiet -- src/data/<city>.json`) and the rest of `meta.json` ignoring `generated_at`; if only that timestamp moved,
skip the commit (or commit at most once a week so the footer's "Actualizado" does not go stale).

**Checks the flow needs before committing:**

- The web checkout is on `main`, `git pull --ff-only` works, and the only modified paths are under `src/data/`
  (anything else means someone is editing the repo by hand: stop).
- `meta.json` parses and has `schema_version` equal to the one this site supports; every `<city>.json` parses.
- **Sanity of the content:** `events` is not empty, and the count did not fall by more than about half compared with the
  committed version (a crawl that quietly lost a source should not replace good data). `generated_at` is from today.
- `npm test` passes (it includes the test that validates the data files against the contract) and `npm run build` succeeds.
- **No secrets or personal data in what will be pushed:** the staged files are exactly `src/data/*.json`, and the crawler's
  `.env` values do not appear in them (`grep -F -f` against the values, never printing them).
- A lock so two runs never overlap (`flock`), and the commit identity of this repo set to the GitHub **noreply** address.

**Authentication.** A timer has no desktop session, so interactive credentials and the keyring helper do not work (a headless
`git push` over HTTPS fails with "could not read Username"). Use a credential made for machines:

- **Preferred: an SSH deploy key** limited to this repo, with write access (Settings > Deploy keys > Add deploy key >
  *Allow write access*). A deploy key belongs to one repository, so it cannot touch any other. Keep the private key in
  `~/.ssh` with mode `600`, use an SSH host alias for it in `~/.ssh/config` (`IdentityFile` = that key, `IdentitiesOnly yes`) with the
  remote `git@<alias>:mezquitelabs/quehacer-web.git`, and pin the key and host with
  `GIT_SSH_COMMAND='ssh -i ~/.ssh/quehacer-web-deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes'` (with GitHub's host key
  already in `known_hosts`).
- **Alternative:** a fine-grained personal access token restricted to this repo with "Contents: Read and write", supplied through a
  credential helper that does not need a keyring.

**Failure handling:** a failed export, check or push leaves the last published site untouched and exits non-zero so the unit shows
`failed` (the crawler's `--notify` can alert on repeated failures). A failed push must not hide a successful crawl: the data stays in
the crawler's database and the next run publishes it.

## Layout

```
src/data/            <city>.json + meta.json (from the crawler)
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
