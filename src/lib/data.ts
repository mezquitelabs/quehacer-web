import { assertSupportedSchema } from './contract';
import type { City, CityFile, Meta, SourceRef } from './types';

// Every src/data/<city>.json becomes a city page: adding a city needs no code change.
const files = import.meta.glob<unknown>('../data/*.json', { eager: true, import: 'default' });

const metaEntry = Object.entries(files).find(([path]) => path.endsWith('/meta.json'));
// A missing meta.json is fine only while there are no city files at all (a fresh clone); otherwise the version must match.
const hasCityFiles = Object.keys(files).some((path) => !path.endsWith('/meta.json'));
if (metaEntry || hasCityFiles) assertSupportedSchema(metaEntry?.[1]);
export const meta: Meta = (metaEntry?.[1] as Meta | undefined) ?? { schema_version: 1, generated_at: new Date(0).toISOString(), cities: {} };

export function loadCities(): City[] {
  const cities: City[] = [];
  for (const [path, content] of Object.entries(files)) {
    const slug = path.split('/').pop()!.replace(/\.json$/, '');
    if (slug === 'meta') continue;
    const info = meta.cities[slug];
    if (!info) throw new Error(`src/data/${slug}.json has no entry in src/data/meta.json (city name and timezone). Re-run the data exporter's export-site command.`);
    const data = content as CityFile;
    cities.push({ ...info, events: data.events ?? [], ongoing: data.ongoing ?? [] });
  }
  return cities.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function allSources(cities: City[]): SourceRef[] {
  const seen = new Map<string, SourceRef>();
  for (const city of cities) for (const s of city.sources) seen.set(s.name, s);
  return [...seen.values()];
}
