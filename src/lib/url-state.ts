import { CATEGORIES, isDateKey, type DayFilter } from './filters';
import type { Category } from './types';

/** URL names for the categories (the data ids are English). Unknown names in a URL are ignored. */
export const CATEGORY_SLUGS: Record<Category, string> = {
  music: 'musica',
  comedy: 'comedia',
  theatre: 'teatro',
  film: 'cine',
  arts: 'arte',
  sports: 'deportes',
  family: 'familia',
  community: 'comunidad',
  other: 'otros',
};

const DAY_PARAMS = ['hoy', 'manana', 'finde', '7dias', 'todos'] as const;

export interface UrlState {
  day: DayFilter | null; // null = not in the URL
  categories: Category[];
  /** Source slugs from ?fuente=. Which ones exist is the page's business; unknown slugs are dropped there. */
  sources: string[];
  free: boolean;
}

const SOURCE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SOURCES = 20;

/** Read ?cuando=hoy|manana|finde|7dias|todos|YYYY-MM-DD, ?cat=musica,cine, ?fuente=ticketmaster,arema and ?gratis=1. Anything else is ignored. */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const cuando = params.get('cuando') ?? '';
  const day = (DAY_PARAMS as readonly string[]).includes(cuando) || isDateKey(cuando) ? (cuando as DayFilter) : null;
  const wanted = (params.get('cat') ?? '').split(',').map((s) => s.trim());
  const categories = CATEGORIES.map((c) => c.id).filter((id) => wanted.includes(CATEGORY_SLUGS[id]));
  const sources = [...new Set((params.get('fuente') ?? '').split(',').map((s) => s.trim().toLowerCase()))]
    .filter((slug) => slug.length <= 60 && SOURCE_SLUG.test(slug))
    .slice(0, MAX_SOURCES);
  return { day, categories, sources, free: params.get('gratis') === '1' };
}

/** The query string ("" or "?…") for a state. The default day is left out so the plain URL stays clean. */
export function serializeUrlState(
  state: { day: DayFilter; categories: ReadonlySet<Category>; sources?: ReadonlySet<string>; free: boolean },
  defaultDay: DayFilter,
): string {
  const params = new URLSearchParams();
  if (state.day !== defaultDay) params.set('cuando', state.day);
  const cats = CATEGORIES.map((c) => c.id).filter((id) => state.categories.has(id));
  if (cats.length > 0) params.set('cat', cats.map((id) => CATEGORY_SLUGS[id]).join(','));
  if (state.sources && state.sources.size > 0) params.set('fuente', [...state.sources].sort().join(','));
  if (state.free) params.set('gratis', '1');
  const query = params.toString().replace(/%2C/gi, ',');
  return query ? `?${query}` : '';
}
