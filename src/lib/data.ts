import { SUPPORTED_SCHEMA_VERSION, assertSupportedSchema } from './contract';
import { normalizeCategory } from './filters';
import type { City, CityFile, Meta, SourceRef } from './types';

// Every src/data/<city>.json becomes a city page: adding a city needs no code change.
const files = import.meta.glob<unknown>('../data/*.json', { eager: true, import: 'default' });

const metaEntry = Object.entries(files).find(([path]) => path.endsWith('/meta.json'));
// A missing meta.json is fine only while there are no city files at all (a fresh clone); otherwise the version must match.
const hasCityFiles = Object.keys(files).some((path) => !path.endsWith('/meta.json'));
if (metaEntry || hasCityFiles) assertSupportedSchema(metaEntry?.[1]);
export const meta: Meta = (metaEntry?.[1] as Meta | undefined) ?? { schema_version: SUPPORTED_SCHEMA_VERSION, generated_at: new Date(0).toISOString(), cities: {} };

export function loadCities(): City[] {
  const cities: City[] = [];
  for (const [path, content] of Object.entries(files)) {
    const slug = path.split('/').pop()!.replace(/\.json$/, '');
    if (slug === 'meta') continue;
    const info = meta.cities[slug];
    if (!info) throw new Error(`src/data/${slug}.json has no entry in src/data/meta.json (city name and timezone). Re-run the data exporter's export-site command.`);
    const data = content as CityFile;
    // An unknown category (a newer exporter than this site) is shown as "Otros", never a build error.
    const events = (data.events ?? []).map((e) => ({ ...e, category: normalizeCategory(e.category) }));
    const ongoing = (data.ongoing ?? []).map((o) => ({ ...o, category: normalizeCategory(o.category) }));
    cities.push({ ...info, events, ongoing });
  }
  return cities.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function allSources(cities: City[]): SourceRef[] {
  const seen = new Map<string, SourceRef>();
  for (const city of cities) for (const s of city.sources) seen.set(s.name, s);
  return [...seen.values()];
}
