# Data contract (`schema_version` 2)

The site reads the JSON files in `src/data/`. They are produced by the crawler's `export-site` command; nothing else
crosses between the two repos. This page is the interface: the crawler promises these files, the site relies on them.

```
src/data/
  meta.json        one file: version, generation time, and the cities with their sources
  <city>.json      one per city (the file name is the city slug): its events and its ongoing entries
```

## Versioning

`meta.json` carries an integer `schema_version`. This site supports **exactly one** version (currently `2`) and the build
**fails with a clear message** when it is missing, not an integer, or different.

- Adding an **optional** field, or a new `category` value the site can fall back on, keeps the version. Consumers must
  ignore fields they do not know.
- Renaming, removing or re-typing a field, changing what a value means, or making a nullable field non-null bumps it.
  The site and the crawler are then updated together.

## `meta.json`

| Field | Type | Null? | Meaning |
|---|---|---|---|
| `schema_version` | integer | no | `2` |
| `generated_at` | string | no | When the files were written, ISO 8601 in **UTC** with an explicit offset (`2026-10-04T16:00:29+00:00`). "Finished" was judged against this moment. |
| `cities` | object | no | Keys are city slugs; every `<city>.json` must have an entry. |
| `cities.<slug>.slug` | string | no | Same as the key; also the URL segment (`/<slug>/`). |
| `cities.<slug>.name` | string | no | Display name, e.g. `Monterrey`. |
| `cities.<slug>.timezone` | string | no | IANA zone name, e.g. `America/Monterrey`. **The reference for every "local" date.** |
| `cities.<slug>.sources` | array | no | Sources that actually contribute to this city's file. Each `{ "name": string, "url": string \| null }`: the source's display name and its public site (`null` if unknown). May be empty. |

## `<city>.json`

```json
{ "events": [ ... ], "ongoing": [ ... ] }
```

Both arrays are always present and may be empty. UTF-8, no BOM.

### `events[]`: things with a date to attend

| Field | Type | Null? | Meaning |
|---|---|---|---|
| `id` | string | no | **Opaque** and unique within the file; stable between exports while the sources keep their ids. Never parse it. |
| `title` | string | no | The source's title, unmodified third-party text. It can contain any characters, including `<`, `&` and quotes: always treat it as **text** and escape it on output. |
| `start` | string | no | ISO 8601 with a numeric offset, `YYYY-MM-DDTHH:MM:SS±HH:MM`; see "Time" below. |
| `end` | string \| null | yes | Same format. `null` when the source gives no end time. |
| `has_time` | boolean | no | `false` when the source only gives a **date**; the time part of `start` is then meaningless. |
| `venue` | string \| null | yes | Venue as the source writes it (the site cleans it for display). `null` when unknown; never an empty string. |
| `category` | string | no | One of `music`, `comedy`, `theatre`, `film`, `arts`, `sports`, `family`, `community`, `other` (see "Categories"). |
| `is_free` | boolean \| null | yes | `true`/`false` only when a source says so (a price of 0 or "entrada libre" / a price above 0). **`null` means unknown, never "free".** |
| `image_url` | string \| null | yes | Absolute URL on the source's own server (hotlinked, may disappear). `null` when there is none. |
| `url` | string \| null | yes | Absolute URL of the **original page** of the winning source. `null` only if no contributing source has one. |
| `source` | string | no | Display name of the winning source (the highest-priority contributor). |
| `sources` | array | no | Every contributing source, best first, at least one: `{ "name": string, "url": string \| null }`. The first is the winner. When the same event appears in several sources it is exported once with all of them. |

### `ongoing[]`: exhibitions, workshops, clubs, courses that span many days

| Field | Type | Null? | Meaning |
|---|---|---|---|
| `id` | string | no | As in `events`. |
| `title` | string | no | As in `events`. |
| `start` | string | no | ISO 8601 with offset. Can be months in the past (the entry is still running). |
| `end` | string \| null | yes | `null` means **open-ended** (no closing date published). Never in the past at `generated_at`. |
| `venue` | string \| null | yes | As in `events`. |
| `category` | string | no | As in `events`. |
| `url` | string \| null | yes | Original page. |
| `image_url` | string \| null | yes | As in `events`. |

There is deliberately no `has_time`, `is_free` or `source` here.

## Time and time zones

- Every instant is an ISO 8601 string **with the offset of the city at that instant** (`-06:00` for Monterrey). The offset is
  part of the value, so the string identifies a unique moment, and the date written in it is already the **local** date.
- "Local" always means the city's `timezone` from `meta.json`, **never the viewer's or the build machine's**. Group by day,
  decide "today" and "this weekend" with that zone. An event at `2026-10-10T23:30:00-06:00` belongs to October 10 even though
  it is October 11 in UTC.
- `has_time: false`: the source gave only a date. `start` is local midnight (`T00:00:00`) and its time is not data. If such an
  entry has an `end`, it is the close of the last day (`T23:59:00`).
- A source that lists several dates for one event (a play with a run of functions) is exported as **its next function**:
  `start`/`end` are that function's, chosen at `generated_at` (first function starting then or later). A play whose functions
  have all started is not exported.
- Only numeric offsets are used (no `Z`), and there are no durations or other units: the contract has no prices, currencies,
  distances or coordinates.

## Categories

| Value | Site label | Covers |
|---|---|---|
| `music` | Música | Concerts and music festivals. |
| `comedy` | Comedia | Stand-up, comedy shows, podcast tapings. |
| `theatre` | Teatro y musicales | Plays (comedic ones included), musicals, monologues. |
| `film` | Cine | Screenings (the Cineteca) and film segments of other sources. |
| `arts` | Arte | Everything else cultural: exhibitions, dance, classical, shows that fit nowhere finer. |
| `sports` | Deportes | |
| `family` | Familia | |
| `community` | Comunidad | |
| `other` | Otros | Anything else. |

The exporter decides the category; the site never re-classifies. A **category value this site does not know** (for
example one a newer exporter added without bumping the version) is shown as `other` / "Otros" and never fails the build.
Version 2 added `comedy`, `theatre` and `film`; before it, those events were `arts` (and some `music` or `other`).

## What the exporter has already decided

The files contain only what is worth showing at `generated_at`: events that are not cancelled, not withdrawn by their
source and not finished (a finished event is one whose `end` has passed; with no `end`, whose start has passed; a date-only
one lasts its whole local day), and ongoing entries that have not ended. The site additionally hides, in the browser,
what ends between exports.

## Not in the files, on purpose

Descriptions (third-party text, large), prices, coordinates, internal database ids, the crawler's raw records, and anything
about how the data was collected.

## Source of the data

All of it comes from third parties; each event links to its original page (`url` and `sources[].url`) and no rights over
the data are claimed. See the data notice in the README and in the site footer.
