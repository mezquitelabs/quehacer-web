import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The footer says no referrer is sent to the sites that serve event images. That is true because every <img>
// carries referrerpolicy="no-referrer"; these tests keep it that way.
const walk = (dir: string, ext: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path, ext) : path.endsWith(ext) ? [path] : [];
  });

describe('no referrer for event images', () => {
  it('every <img> in the source sets referrerpolicy="no-referrer"', () => {
    const imgs = walk('src', '.astro').flatMap((file) => (readFileSync(file, 'utf8').match(/<img\b[^>]*>/g) ?? []).map((tag) => [file, tag] as const));
    expect(imgs.length).toBeGreaterThan(0);
    for (const [file, tag] of imgs) expect(tag, file).toContain('referrerpolicy="no-referrer"');
  });

  it('every external image in the built pages has it too (when dist/ exists)', () => {
    if (!existsSync('dist')) return;
    let external = 0;
    for (const file of walk('dist', '.html')) {
      for (const tag of readFileSync(file, 'utf8').match(/<img\b[^>]*>/g) ?? []) {
        if (!/\ssrc="https?:\/\//.test(tag)) continue;
        external += 1;
        expect(tag, file).toContain('referrerpolicy="no-referrer"');
      }
    }
    expect(external).toBeGreaterThanOrEqual(0);
  });

  it('the page script never creates images', () => {
    for (const file of walk('src', '.astro')) expect(readFileSync(file, 'utf8'), file).not.toMatch(/createElement\(['"]img['"]\)|new Image\(/);
  });
});
