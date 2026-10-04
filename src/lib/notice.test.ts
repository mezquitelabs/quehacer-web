import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('data notice', () => {
  it('is in the footer of every page (the layout), in Spanish', () => {
    const layout = readFileSync('src/components/Layout.astro', 'utf8');
    expect(layout).toContain('Los eventos provienen de fuentes de terceros');
    expect(layout).toContain('enlaza a su página original');
    expect(layout).toContain('No se reclaman derechos sobre esos datos');
  });
  it('is in the README', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toMatch(/## Data notice/);
    expect(readme).toMatch(/third-party sources/);
    expect(readme).toMatch(/no rights over that data\s+are claimed/);
  });
});
