import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_PATH, DEFAULT_SITE_URL, resolveBase, resolveSite } from './site-config';

describe('site and base defaults', () => {
  it('default to the GitHub Pages project site', () => {
    expect(DEFAULT_SITE_URL).toBe('https://mezquitelabs.github.io');
    expect(DEFAULT_BASE_PATH).toBe('/quehacer-web');
    expect(resolveSite({})).toBe('https://mezquitelabs.github.io');
    expect(resolveBase({})).toBe('/quehacer-web');
  });
  it('treat an empty or blank variable as not set', () => {
    expect(resolveSite({ SITE_URL: '' })).toBe(DEFAULT_SITE_URL);
    expect(resolveSite({ SITE_URL: '   ' })).toBe(DEFAULT_SITE_URL);
    expect(resolveBase({ BASE_PATH: '' })).toBe(DEFAULT_BASE_PATH);
  });
  it('can be overridden for a custom domain', () => {
    expect(resolveSite({ SITE_URL: 'https://example.com' })).toBe('https://example.com');
    expect(resolveBase({ BASE_PATH: '/' })).toBe('/');
  });
  it('normalises what it is given', () => {
    expect(resolveSite({ SITE_URL: 'https://example.com/' })).toBe('https://example.com');
    expect(resolveBase({ BASE_PATH: 'docs/' })).toBe('/docs');
    expect(resolveBase({ BASE_PATH: '//a/b//' })).toBe('/a/b');
    expect(resolveBase({ BASE_PATH: '/quehacer-web/' })).toBe('/quehacer-web');
  });
});
