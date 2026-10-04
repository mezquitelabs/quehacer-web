import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { imageHosts } from './privacy';

const ev = (image_url: string | null) => ({ image_url }) as never;

describe('imageHosts', () => {
  it('lists each image host once, sorted, from events and ongoing items', () => {
    const city = { events: [ev('https://b.example/x.jpg'), ev('https://a.example/y.jpg'), ev(null)], ongoing: [ev('https://b.example/z.jpg'), ev('not a url')] };
    expect(imageHosts([city])).toEqual(['a.example', 'b.example']);
  });
  it('is empty when nothing has an image', () => {
    expect(imageHosts([{ events: [], ongoing: [] }])).toEqual([]);
  });
});

describe('every page footer', () => {
  it('carries the privacy line and links to the notice page', () => {
    const layout = readFileSync('src/components/Layout.astro', 'utf8');
    expect(layout).toContain('class="privacy"');
    expect(layout).toContain("withBase('aviso/')");
  });
});
