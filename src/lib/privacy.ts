import type { City } from './types';

/** Where people ask for content to be removed. */
export const ISSUES_URL = 'https://github.com/mezquitelabs/quehacer-web/issues';

/**
 * The hosts the pages load event images from (the only resources fetched from outside the site: no scripts, fonts,
 * styles or analytics). Derived from the data so the privacy sentence always matches what the pages really load.
 */
export function imageHosts(cities: Pick<City, 'events' | 'ongoing'>[]): string[] {
  const hosts = new Set<string>();
  for (const city of cities) {
    for (const item of [...city.events, ...city.ongoing]) {
      if (!item.image_url) continue;
      try {
        hosts.add(new URL(item.image_url).hostname);
      } catch {
        // an unparseable URL is never rendered as a working image; nothing to list
      }
    }
  }
  return [...hosts].sort();
}
