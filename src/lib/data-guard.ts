import { DataContractError } from './contract';

// The data arrives from outside this repo (the quehacer-data repo), so it is checked at build time before it can reach
// a page: every link must be https on an allowlisted host, coordinates (if any ever appear) must be real numbers, and no
// string may be absurdly long. A failure stops the build with a message that says where and what to do.

/** Longest allowed value per field name; anything not listed uses `DEFAULT_MAX`. */
export const MAX_LENGTH: Record<string, number> = { id: 300, title: 400, venue: 400, source: 200, name: 200, url: 2048, image_url: 2048, start: 40, end: 40, timezone: 64, slug: 64, category: 40 };
export const DEFAULT_MAX = 1000;
export const MAX_ITEMS = 20000;
const LINK_FIELDS = ['url', 'image_url'];
const COORD_RANGES: Record<string, number> = { lat: 90, latitude: 90, lon: 180, lng: 180, longitude: 180 };

const HINT = 'To accept a new host, add it to src/lib/allowed-hosts.json (see "Allowed hosts" in the README); otherwise the data is wrong.';

export function allowedHosts(list: { hosts: string[] }): Set<string> {
  return new Set(list.hosts.map((h) => h.toLowerCase()));
}

/** Returns what is wrong with a link, or null when it is an https URL on an allowed host. */
export function linkProblem(value: unknown, hosts: Set<string>): string | null {
  if (typeof value !== 'string') return 'is not a string';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `is not an absolute URL (${JSON.stringify(value.slice(0, 80))})`;
  }
  if (url.protocol !== 'https:') return `is not https (${url.protocol})`;
  if (url.username || url.password) return 'carries credentials';
  if (!hosts.has(url.hostname.toLowerCase())) return `has a host that is not allowed (${url.hostname})`;
  return null;
}

function checkStrings(node: unknown, where: string, problems: string[]): void {
  if (typeof node === 'string') return;
  if (Array.isArray(node)) return node.forEach((item, i) => checkStrings(item, `${where}[${i}]`, problems));
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      const here = `${where}.${key}`;
      if (typeof value === 'string' && value.length > (MAX_LENGTH[key] ?? DEFAULT_MAX)) problems.push(`${here} is ${value.length} characters long (limit ${MAX_LENGTH[key] ?? DEFAULT_MAX})`);
      if (key in COORD_RANGES && value !== null) {
        const limit = COORD_RANGES[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) problems.push(`${here} must be a number between -${limit} and ${limit}, got ${JSON.stringify(value)}`);
      }
      checkStrings(value, here, problems);
    }
  }
}

function checkItem(item: unknown, where: string, hosts: Set<string>, problems: string[]): void {
  if (typeof item !== 'object' || item === null) return void problems.push(`${where} is not an object`);
  const record = item as Record<string, unknown>;
  for (const field of LINK_FIELDS) {
    if (record[field] === null || record[field] === undefined) continue;
    const problem = linkProblem(record[field], hosts);
    if (problem) problems.push(`${where}.${field} ${problem}`);
  }
  if (Array.isArray(record.sources)) {
    record.sources.forEach((s: any, i: number) => {
      if (s && s.url !== null && s.url !== undefined) {
        const problem = linkProblem(s.url, hosts);
        if (problem) problems.push(`${where}.sources[${i}].url ${problem}`);
      }
    });
  }
}

/** Throws a DataContractError listing the first problems found in a city file and the meta.json that goes with it. */
export function assertSafeCityFile(slug: string, data: unknown, hosts: Set<string>): void {
  const problems: string[] = [];
  const file = data as { events?: unknown[]; ongoing?: unknown[] };
  for (const key of ['events', 'ongoing'] as const) {
    const list = file?.[key] ?? [];
    if (!Array.isArray(list)) {
      problems.push(`${key} is not an array`);
      continue;
    }
    if (list.length > MAX_ITEMS) problems.push(`${key} has ${list.length} entries (limit ${MAX_ITEMS})`);
    list.slice(0, MAX_ITEMS).forEach((item, i) => checkItem(item, `${key}[${i}]`, hosts, problems));
  }
  checkStrings(data, '', problems);
  report(`src/data/${slug}.json`, problems);
}

export function assertSafeMeta(meta: unknown, hosts: Set<string>): void {
  const problems: string[] = [];
  const cities = (meta as { cities?: Record<string, { sources?: { url?: unknown }[] }> })?.cities ?? {};
  for (const [slug, city] of Object.entries(cities)) {
    (city?.sources ?? []).forEach((s, i) => {
      if (s.url === null || s.url === undefined) return;
      const problem = linkProblem(s.url, hosts);
      if (problem) problems.push(`cities.${slug}.sources[${i}].url ${problem}`);
    });
  }
  checkStrings(meta, '', problems);
  report('src/data/meta.json', problems);
}

function report(file: string, problems: string[]): void {
  if (!problems.length) return;
  const shown = problems.slice(0, 10).map((p) => `  - ${p}`).join('\n');
  const more = problems.length > 10 ? `\n  ... and ${problems.length - 10} more` : '';
  throw new DataContractError(`${file} failed the safety checks (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n${shown}${more}\n${HINT}`);
}
