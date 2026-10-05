import { describe, expect, it } from 'vitest';
import allowedHostsFile from './allowed-hosts.json';
import { DataContractError } from './contract';
import { allowedHosts, assertSafeCityFile, assertSafeMeta, linkProblem, MAX_ITEMS } from './data-guard';

const hosts = allowedHosts(allowedHostsFile);
const event = (over: Record<string, unknown> = {}) => ({
  id: 'x:1', title: 'Evento', start: '2026-10-20T20:00:00-06:00', end: null, has_time: true, venue: null, category: 'music', is_free: null,
  image_url: 'https://s1.ticketm.net/a.jpg', url: 'https://www.ticketmaster.com.mx/e/1', source: 'Ticketmaster',
  sources: [{ name: 'Ticketmaster', url: 'https://www.ticketmaster.com.mx/e/1' }], ...over,
});
const file = (...events: unknown[]) => ({ events, ongoing: [] });
const run = (data: unknown) => () => assertSafeCityFile('monterrey', data, hosts);

describe('data guard', () => {
  it('accepts clean data, null links and the allowlisted hosts', () => {
    expect(run(file(event(), event({ id: 'x:2', url: null, image_url: null, sources: [{ name: 'S', url: null }] })))).not.toThrow();
    for (const h of allowedHostsFile.hosts) expect(linkProblem(`https://${h}/p`, hosts)).toBeNull();
  });

  it('rejects non-https links, in url, image_url and sources', () => {
    expect(run(file(event({ url: 'http://www.ticketmaster.com.mx/e/1' })))).toThrow(/events\[0\]\.url is not https/);
    expect(run(file(event({ image_url: 'javascript:alert(1)' })))).toThrow(/image_url is not https/);
    expect(run(file(event({ sources: [{ name: 'T', url: 'http://www.ticketmaster.com.mx/' }] })))).toThrow(/sources\[0\]\.url is not https/);
    expect(run(file(event({ url: 'data:text/html,<script>' })))).toThrow(DataContractError);
  });

  it('rejects hosts outside the allowlist, lookalikes and credentials, and says how to add one', () => {
    expect(run(file(event({ url: 'https://evil.example/e' })))).toThrow(/host that is not allowed \(evil\.example\)/);
    expect(run(file(event({ url: 'https://evil.example/e' })))).toThrow(/src\/lib\/allowed-hosts\.json/);
    expect(run(file(event({ url: 'https://www.ticketmaster.com.mx.evil.example/' })))).toThrow(/not allowed/);
    expect(run(file(event({ url: 'https://conarte.org.mx@evil.example/' })))).toThrow(/not allowed|credentials/);
    expect(run(file(event({ url: 'https://user:pw@conarte.org.mx/' })))).toThrow(/credentials/);
    expect(run(file(event({ image_url: 'https://cdn.evil.example/i.jpg' })))).toThrow(/image_url has a host that is not allowed/);
  });

  it('rejects a link that is not a string or not a URL', () => {
    expect(run(file(event({ url: 42 })))).toThrow(/is not a string/);
    expect(run(file(event({ url: '/relative' })))).toThrow(/not an absolute URL/);
  });

  it('checks ongoing entries too', () => {
    const bad = { events: [], ongoing: [{ id: 'o', title: 'Expo', start: 's', end: null, venue: null, category: 'arts', url: 'http://x.example/', image_url: null }] };
    expect(run(bad)).toThrow(/ongoing\[0\]\.url is not https/);
  });

  it('rejects non-numeric or out-of-range coordinates, and accepts real ones', () => {
    expect(run(file(event({ lat: '25.6', lon: -100.3 })))).toThrow(/lat must be a number/);
    expect(run(file(event({ lat: 25.6, lon: 'abc' })))).toThrow(/lon must be a number/);
    expect(run(file(event({ latitude: 91 })))).toThrow(/latitude must be a number between -90 and 90/);
    expect(run(file(event({ lng: Number.NaN })))).toThrow(/lng must be a number/);
    expect(run(file(event({ lat: 25.6, lon: -100.3 })))).not.toThrow();
    expect(run(file(event({ lat: null })))).not.toThrow();
  });

  it('rejects fields longer than their limit', () => {
    expect(run(file(event({ title: 'a'.repeat(401) })))).toThrow(/title is 401 characters long \(limit 400\)/);
    expect(run(file(event({ venue: 'v'.repeat(401) })))).toThrow(/venue is 401/);
    expect(run(file(event({ url: 'https://conarte.org.mx/' + 'a'.repeat(2100) })))).toThrow(/url is \d+ characters/);
    expect(run(file(event({ surprise: 'z'.repeat(1001) })))).toThrow(/surprise is 1001/);
    expect(run(file(event({ title: 'a'.repeat(400) })))).not.toThrow();
  });

  it('rejects an absurd number of entries and a non-array', () => {
    expect(run({ events: new Array(MAX_ITEMS + 1).fill(null), ongoing: [] })).toThrow(/limit/);
    expect(run({ events: 'nope', ongoing: [] })).toThrow(/events is not an array/);
  });

  it('lists several problems at once, capped', () => {
    const many = file(...Array.from({ length: 15 }, (_, i) => event({ id: `x:${i}`, url: 'http://evil.example/' })));
    expect(run(many)).toThrow(/15 problems/);
    expect(run(many)).toThrow(/and 5 more/);
  });

  it('checks meta.json source links and sizes', () => {
    const meta = (url: unknown) => ({ schema_version: 2, generated_at: 'g', cities: { monterrey: { slug: 'monterrey', name: 'M', timezone: 'America/Monterrey', sources: [{ name: 'S', url }] } } });
    expect(() => assertSafeMeta(meta('https://conarte.org.mx'), hosts)).not.toThrow();
    expect(() => assertSafeMeta(meta(null), hosts)).not.toThrow();
    expect(() => assertSafeMeta(meta('http://conarte.org.mx'), hosts)).toThrow(/sources\[0\]\.url is not https/);
    expect(() => assertSafeMeta(meta('https://evil.example'), hosts)).toThrow(/not allowed/);
  });

  it('the real data in src/data (when present) and the sample pass the same checks', async () => {
    const { existsSync, readFileSync } = await import('node:fs');
    for (const dir of ['src/data', 'tests/fixtures/data']) {
      if (!existsSync(`${dir}/meta.json`)) continue; // src/data is not tracked on main
      assertSafeMeta(JSON.parse(readFileSync(`${dir}/meta.json`, 'utf8')), hosts);
      assertSafeCityFile('monterrey', JSON.parse(readFileSync(`${dir}/monterrey.json`, 'utf8')), hosts);
    }
  });
});
