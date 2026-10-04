import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_SCHEMA_VERSION } from './contract';

// Validates the files in src/data against docs/data-contract.md, so data that breaks the contract cannot be published.
const dir = 'src/data';
const read = (name: string) => JSON.parse(readFileSync(`${dir}/${name}`, 'utf8'));
const meta = read('meta.json');
const cityFiles = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'meta.json');

const ISO_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const CATEGORIES = ['music', 'arts', 'sports', 'family', 'community', 'other'];
const EVENT_KEYS = ['category', 'end', 'has_time', 'id', 'image_url', 'is_free', 'source', 'sources', 'start', 'title', 'url', 'venue'];
const ONGOING_KEYS = ['category', 'end', 'id', 'image_url', 'start', 'title', 'url', 'venue'];
const nullableString = (v: unknown) => v === null || (typeof v === 'string' && v.length > 0);
const isUrl = (v: unknown) => typeof v === 'string' && /^https?:\/\/[^\s]+$/.test(v);

describe('meta.json', () => {
  it('follows the contract', () => {
    expect(meta.schema_version).toBe(SUPPORTED_SCHEMA_VERSION);
    expect(meta.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/);
    expect(Object.keys(meta).sort()).toEqual(['cities', 'generated_at', 'schema_version']);
  });
  it('has an entry for every city file, and each entry is complete', () => {
    expect(Object.keys(meta.cities).sort()).toEqual(cityFiles.map((f) => f.replace('.json', '')).sort());
    for (const [slug, city] of Object.entries<any>(meta.cities)) {
      expect(Object.keys(city).sort()).toEqual(['name', 'slug', 'sources', 'timezone']);
      expect(city.slug).toBe(slug);
      expect(typeof city.name).toBe('string');
      expect(() => new Intl.DateTimeFormat('en', { timeZone: city.timezone })).not.toThrow(); // a real IANA zone
      for (const s of city.sources) {
        expect(Object.keys(s).sort()).toEqual(['name', 'url']);
        expect(typeof s.name).toBe('string');
        expect(s.url === null || isUrl(s.url)).toBe(true);
      }
    }
  });
});

describe.each(cityFiles)('%s', (file) => {
  const data = read(file);
  const slug = file.replace('.json', '');
  const generated = Date.parse(meta.generated_at);

  it('has exactly events and ongoing arrays', () => {
    expect(Object.keys(data).sort()).toEqual(['events', 'ongoing']);
    expect(Array.isArray(data.events) && Array.isArray(data.ongoing)).toBe(true);
  });

  it('events have exactly the documented fields, types and nullability', () => {
    for (const e of data.events) {
      expect(Object.keys(e).sort()).toEqual(EVENT_KEYS); // no raw, no description, no internal fields
      expect(typeof e.id === 'string' && e.id.length > 0).toBe(true);
      expect(typeof e.title === 'string' && e.title.length > 0).toBe(true);
      expect(e.start).toMatch(ISO_OFFSET);
      expect(e.end === null || ISO_OFFSET.test(e.end)).toBe(true);
      expect(typeof e.has_time).toBe('boolean');
      expect(nullableString(e.venue)).toBe(true); // null, never ""
      expect(CATEGORIES).toContain(e.category);
      expect([true, false, null]).toContain(e.is_free);
      expect(e.image_url === null || isUrl(e.image_url)).toBe(true);
      expect(e.url === null || isUrl(e.url)).toBe(true);
      expect(typeof e.source).toBe('string');
      expect(e.sources.length).toBeGreaterThan(0);
      expect(e.sources[0].name).toBe(e.source); // the first contributor is the winner
      for (const s of e.sources) {
        expect(Object.keys(s).sort()).toEqual(['name', 'url']);
        expect(s.url === null || isUrl(s.url)).toBe(true);
      }
      if (e.end) expect(Date.parse(e.end)).toBeGreaterThanOrEqual(Date.parse(e.start));
    }
  });

  it('ongoing entries have exactly the documented fields, and none has ended', () => {
    for (const o of data.ongoing) {
      expect(Object.keys(o).sort()).toEqual(ONGOING_KEYS);
      expect(o.start).toMatch(ISO_OFFSET);
      expect(o.end === null || ISO_OFFSET.test(o.end)).toBe(true);
      if (o.end) expect(Date.parse(o.end)).toBeGreaterThanOrEqual(generated); // "never in the past at generated_at"
      expect(nullableString(o.venue)).toBe(true);
      expect(CATEGORIES).toContain(o.category);
      expect(o.url === null || isUrl(o.url)).toBe(true);
      expect(o.image_url === null || isUrl(o.image_url)).toBe(true);
    }
  });

  it('ids are unique in the file', () => {
    const ids = [...data.events, ...data.ongoing].map((x: any) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every offset is the city offset at that instant (the written date is the local date)', () => {
    const tz = meta.cities[slug].timezone;
    const parts = (iso: string) => {
      const local = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
      return local;
    };
    for (const e of [...data.events, ...data.ongoing] as any[]) expect(e.start.slice(0, 10)).toBe(parts(e.start));
  });

  it('events that are date-only sit at local midnight', () => {
    for (const e of data.events.filter((x: any) => !x.has_time)) expect(e.start).toMatch(/T00:00:00[+-]/);
  });
});
