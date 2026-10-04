/** Where the site is published unless the environment says otherwise (GitHub Pages project site). */
export const DEFAULT_SITE_URL = 'https://mezquitelabs.github.io';
export const DEFAULT_BASE_PATH = '/quehacer-web';

type Env = Record<string, string | undefined>;

/** `SITE_URL` from the environment, or the default. An empty value means "not set". */
export function resolveSite(env: Env): string {
  const value = env.SITE_URL?.trim();
  return value ? value.replace(/\/+$/, '') : DEFAULT_SITE_URL;
}

/**
 * `BASE_PATH` from the environment, or the default. Always a leading slash and no trailing one, except the root:
 *   unset or empty -> "/quehacer-web"      "/"  -> "/" (custom domain)      "docs/" -> "/docs"
 */
export function resolveBase(env: Env): string {
  const value = env.BASE_PATH?.trim();
  if (!value) return DEFAULT_BASE_PATH;
  if (value === '/') return '/';
  return '/' + value.replace(/^\/+|\/+$/g, '');
}
