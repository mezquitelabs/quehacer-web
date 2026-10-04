/** Prefix a site path with Astro's `base`. Works for "/" and for "/quehacer-web", with or without a trailing slash. */
export function withBase(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}
