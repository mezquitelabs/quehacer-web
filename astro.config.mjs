import { defineConfig } from 'astro/config';
import { resolveBase, resolveSite } from './src/lib/site-config.ts';

// Defaults: SITE_URL=https://mezquitelabs.github.io and BASE_PATH=/quehacer-web (a GitHub Pages project site).
// Both can be overridden from the environment (in CI, from repository variables), for example for a custom domain:
//   SITE_URL=https://example.com  BASE_PATH=/
export default defineConfig({
  site: resolveSite(process.env),
  base: resolveBase(process.env),
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
