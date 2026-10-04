import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoryCounts, categoryLabel, matchesCategory, normalizeCategory, shownCategories } from './filters';

describe('category labels', () => {
  it('start with a capital letter (cards show them as they are)', () => {
    for (const { label } of CATEGORIES) expect(label[0]).toBe(label[0].toLocaleUpperCase('es'));
    expect(categoryLabel('music')).toBe('Música');
    expect(categoryLabel('arts')).toBe('Arte');
    expect(categoryLabel('unknown-category')).toBe('Otros');
  });
  it('are not lower-cased by the stylesheet', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    expect(css).not.toMatch(/\.cat\s*\{[^}]*text-transform\s*:\s*lowercase/);
  });
});

describe('chip order and labels', () => {
  it('is Música, Comedia, Teatro y musicales, Cine, Arte, Deportes, Familia, Comunidad, Otros', () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual([
      'Música', 'Comedia', 'Teatro y musicales', 'Cine', 'Arte', 'Deportes', 'Familia', 'Comunidad', 'Otros',
    ]);
    expect(CATEGORIES.map((c) => c.id)).toEqual(['music', 'comedy', 'theatre', 'film', 'arts', 'sports', 'family', 'community', 'other']);
  });
  it('shows the shown chips in that order and hides the empty ones', () => {
    const counts = categoryCounts(
      [
        { id: 'a', day: '2026-10-10', cat: 'film' },
        { id: 'b', day: '2026-10-10', cat: 'music' },
        { id: 'c', day: '2026-10-10', cat: 'theatre' },
      ],
      'todos',
      new Date('2026-10-04T12:00:00Z'),
      'America/Monterrey',
    );
    const shown = shownCategories(counts, new Set());
    expect(CATEGORIES.filter((c) => shown.has(c.id)).map((c) => c.label)).toEqual(['Música', 'Teatro y musicales', 'Cine']);
  });
});

describe('an unknown category value (a newer exporter) never breaks the page', () => {
  it('is labelled "Otros" and treated as other', () => {
    expect(categoryLabel('podcasts')).toBe('Otros');
    expect(normalizeCategory('podcasts')).toBe('other');
    expect(normalizeCategory(undefined)).toBe('other');
    expect(normalizeCategory('film')).toBe('film');
  });
  it('is counted under Otros (not NaN) and matched by the Otros chip', () => {
    const events = [{ id: 'a', day: '2026-10-10', cat: 'podcasts' as never }, { id: 'b', day: '2026-10-10', cat: 'other' as const }];
    const counts = categoryCounts(events, 'todos', new Date('2026-10-04T12:00:00Z'), 'America/Monterrey');
    expect(counts.other).toBe(2);
    expect(Object.values(counts).every(Number.isFinite)).toBe(true);
    expect(matchesCategory('podcasts' as never, new Set(['other']))).toBe(true);
    expect(matchesCategory('podcasts' as never, new Set(['music']))).toBe(false);
  });
});

describe('category dot colours', () => {
  const css = readFileSync('src/styles/global.css', 'utf8');
  const channel = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
  const darkStart = css.indexOf('prefers-color-scheme: dark');
  const themes = { light: tokens(css.slice(0, darkStart)), dark: tokens(css.slice(darkStart, css.indexOf('*, *::before')))};

  for (const [name, t] of Object.entries(themes)) {
    it(`every category is at least 4.5:1 on the background and the card surface (${name})`, () => {
      for (const { id } of CATEGORIES) {
        const colour = t[`cat-${id}`];
        expect(colour, `--cat-${id} in ${name}`).toBeDefined();
        expect(ratio(colour, t.bg), `${id} on bg (${name})`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(colour, t.surface), `${id} on surface (${name})`).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`the colours are all different (${name})`, () => {
      const colours = CATEGORIES.map(({ id }) => t[`cat-${id}`]);
      expect(new Set(colours).size).toBe(CATEGORIES.length);
    });
  }
  it('every category has a dot rule', () => {
    for (const { id } of CATEGORIES) expect(css).toContain(`.dot[data-dot="${id}"] { background: var(--cat-${id}); }`);
  });
});
