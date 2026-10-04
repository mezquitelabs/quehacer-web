import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, categoryLabel } from './filters';

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
