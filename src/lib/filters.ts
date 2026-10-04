import type { Category } from './types';

export type DayFilter = 'todos' | 'hoy' | 'finde' | '7dias';

export const DAY_FILTERS: { id: DayFilter; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'finde', label: 'Este fin de semana' },
  { id: '7dias', label: 'Próximos 7 días' },
  { id: 'todos', label: 'Todos' },
];

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'music', label: 'Música' },
  { id: 'arts', label: 'Arte' },
  { id: 'sports', label: 'Deportes' },
  { id: 'family', label: 'Familia' },
  { id: 'community', label: 'Comunidad' },
  { id: 'other', label: 'Otros' },
];

export const categoryLabel = (id: string): string => CATEGORIES.find((c) => c.id === id)?.label ?? 'Otros';

/** The minimum the filters need about an event. `day` is its local date, YYYY-MM-DD. */
export interface Filterable {
  id: string;
  day: string;
  cat: Category;
}

/** YYYY-MM-DD of an instant in the CITY's timezone (never the browser's), so dates near midnight are right. */
export function localDateKey(instant: Date | string, timeZone: string): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const toUtc = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Calendar-day arithmetic on YYYY-MM-DD keys (no timezone, no DST surprises). */
export function addDays(key: string, days: number): string {
  return new Date(toUtc(key) + days * 86_400_000).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, for a YYYY-MM-DD key. */
export function weekday(key: string): number {
  return new Date(toUtc(key)).getUTCDay();
}

/** Inclusive [from, to] of local dates for a day filter, or null for "todos". */
export function dayRange(filter: DayFilter, now: Date, timeZone: string): { from: string; to: string } | null {
  const today = localDateKey(now, timeZone);
  switch (filter) {
    case 'todos':
      return null;
    case 'hoy':
      return { from: today, to: today };
    case '7dias':
      return { from: today, to: addDays(today, 6) }; // today plus the next six days
    case 'finde': {
      const w = weekday(today);
      if (w === 0) return { from: today, to: today }; // Sunday: what is left of the weekend
      const saturday = w === 6 ? today : addDays(today, 6 - w);
      return { from: saturday, to: addDays(saturday, 1) };
    }
  }
}

export function matchesDay(day: string, filter: DayFilter, now: Date, timeZone: string): boolean {
  const range = dayRange(filter, now, timeZone);
  return range === null || (day >= range.from && day <= range.to);
}

/** No category selected means all of them. */
export function matchesCategory(cat: Category, selected: ReadonlySet<Category>): boolean {
  return selected.size === 0 || selected.has(cat);
}

export interface FilterState {
  day: DayFilter;
  categories: ReadonlySet<Category>;
}

export function visibleIds(events: Filterable[], state: FilterState, now: Date, timeZone: string): Set<string> {
  return new Set(
    events
      .filter((e) => matchesDay(e.day, state.day, now, timeZone) && matchesCategory(e.cat, state.categories))
      .map((e) => e.id),
  );
}

/** Events per category among those that pass the DAY filter (the chip counts), regardless of selected chips. */
export function categoryCounts(events: Filterable[], day: DayFilter, now: Date, timeZone: string): Record<Category, number> {
  const counts: Record<Category, number> = { music: 0, arts: 0, sports: 0, family: 0, community: 0, other: 0 };
  for (const e of events) if (matchesDay(e.day, day, now, timeZone)) counts[e.cat] += 1;
  return counts;
}

/**
 * Which category chips to show: those with at least one event under the current day filter, plus any chip the
 * visitor has selected (a selected chip must stay reachable even when its count drops to 0, or it could not be
 * un-selected).
 */
export function shownCategories(counts: Record<Category, number>, selected: ReadonlySet<Category>): Set<Category> {
  return new Set(CATEGORIES.map((c) => c.id).filter((id) => counts[id] > 0 || selected.has(id)));
}

/** An event with no end time is treated as over this many hours after it started. */
export const STALE_HOURS = 3;

/** What `isFinished` needs: the instants, and whether the start is a real time or just a date. */
export interface Timed {
  day: string;
  start: string; // ISO 8601
  end: string | null;
  hasTime: boolean;
}

/**
 * Has the event already ended? (The page is a snapshot built earlier, so the browser hides what is over.)
 *  - with an end time: over once the end is in the past;
 *  - with no end: over when it started more than STALE_HOURS ago (exactly 3 h ago is still shown);
 *  - date-only (no real time): it lasts the whole LOCAL day, so it is over once that day has passed.
 */
export function isFinished(event: Timed, now: Date, timeZone: string): boolean {
  if (event.end) return new Date(event.end).getTime() < now.getTime();
  if (!event.hasTime) return event.day < localDateKey(now, timeZone);
  return new Date(event.start).getTime() < now.getTime() - STALE_HOURS * 3_600_000;
}

/** Only the events that are not over yet; counts and the list are computed from these. */
export function liveEvents<T extends Filterable & Timed>(events: T[], now: Date, timeZone: string): T[] {
  return events.filter((e) => !isFinished(e, now, timeZone));
}
