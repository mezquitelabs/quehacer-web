import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// `astro dev` pre-scans every .astro file for "<script" with a regex and chokes when that text appears in the
// frontmatter (even in a comment or a string). `astro build` does not notice, so this guards the dev server.
function astroFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? astroFiles(path) : path.endsWith('.astro') ? [path] : [];
  });
}

describe('.astro files', () => {
  it('never contain the text "<script" inside the frontmatter', () => {
    const offenders = astroFiles('src').filter((file) => {
      const match = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
      return match !== null && /<script/i.test(match[1]);
    });
    expect(offenders).toEqual([]);
  });

  it('mark the embedded JSON script as inline so Astro leaves it alone', () => {
    const page = readFileSync('src/pages/[city]/index.astro', 'utf8');
    expect(page).toMatch(/<script is:inline type="application\/json"/);
  });
});
