import type { Category } from './types';

/** A single calendar day, YYYY-MM-DD (what "see upcoming events" jumps to). */
export type DateKey = `${number}-${number}-${number}`;
export type DayPreset = 'todos' | 'hoy' | 'manana' | 'finde' | '7dias';
export type DayFilter = DayPreset | DateKey;

/** The date control, in order. `short` is what narrow screens show; `label` is always the accessible name. */
export const DAY_FILTERS: { id: DayPreset; label: string; short: string }[] = [
  { id: 'hoy', label: 'Hoy', short: 'Hoy' },
  { id: 'manana', label: 'Mañana', short: 'Mañana' },
  { id: 'finde', label: 'Fin de semana', short: 'Finde' },
  { id: '7dias', label: 'Próximos 7 días', short: '7 días' },
  { id: 'todos', label: 'Todo', short: 'Todo' },
];

export const isDateKey = (value: string): value is DateKey => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** In chip order. */
export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'music', label: 'Música' },
  { id: 'comedy', label: 'Comedia' },
  { id: 'theatre', label: 'Teatro y musicales' },
  { id: 'film', label: 'Cine' },
  { id: 'arts', label: 'Arte' },
  { id: 'sports', label: 'Deportes' },
  { id: 'family', label: 'Familia' },
  { id: 'community', label: 'Comunidad' },
  { id: 'other', label: 'Otros' },
];

/** A category value this site knows; anything else (e.g. one added by a newer exporter) is `other`. */
export const normalizeCategory = (value: unknown): Category => CATEGORIES.find((c) => c.id === value)?.id ?? 'other';

export const categoryLabel = (id: string): string => CATEGORIES.find((c) => c.id === id)?.label ?? 'Otros';

/** The minimum the filters need about an event. `day` is its local date, YYYY-MM-DD. */
export interface Filterable {
  id: string;
  day: string;
  cat: Category;
  /** Known to be free (`is_free === true`); unknown is not free. */
  free?: boolean;
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
  if (isDateKey(filter)) return { from: filter, to: filter };
  switch (filter) {
    case 'todos':
      return null;
    case 'hoy':
      return { from: today, to: today };
    case 'manana': {
      const tomorrow = addDays(today, 1);
      return { from: tomorrow, to: tomorrow };
    }
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
  return selected.size === 0 || selected.has(normalizeCategory(cat));
}

export interface FilterState {
  day: DayFilter;
  categories: ReadonlySet<Category>;
  /** Only events known to be free. */
  free?: boolean;
}

export function visibleIds(events: Filterable[], state: FilterState, now: Date, timeZone: string): Set<string> {
  return new Set(
    events
      .filter((e) => matchesDay(e.day, state.day, now, timeZone) && matchesCategory(e.cat, state.categories) && (!state.free || e.free === true))
      .map((e) => e.id),
  );
}

/** Events per category among those that pass the DAY filter (and Gratis, if on): the chip counts, regardless of selected chips. */
export function categoryCounts(events: Filterable[], day: DayFilter, now: Date, timeZone: string, free = false): Record<Category, number> {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<Category, number>;
  for (const e of events) if (matchesDay(e.day, day, now, timeZone) && (!free || e.free === true)) counts[normalizeCategory(e.cat)] += 1;
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

/** Categories with fewer events than this stay out of the visible filter UI (their events still show under every other filter). */
export const MIN_CATEGORY_COUNT = 2;

/** `shownCategories`, minus the nearly empty ones; a selected category always stays so it can be un-selected. */
export function primaryCategories(counts: Record<Category, number>, selected: ReadonlySet<Category>, min = MIN_CATEGORY_COUNT): Set<Category> {
  return new Set(CATEGORIES.map((c) => c.id).filter((id) => counts[id] >= min || selected.has(id)));
}

/**
 * What the page opens on: "hoy" when something is still on today, otherwise the next day that has events,
 * otherwise "todos". `events` should already be the live ones (see liveEvents).
 */
export function defaultDay(events: Filterable[], now: Date, timeZone: string): DayFilter {
  const today = localDateKey(now, timeZone);
  const days = events.map((e) => e.day).filter((d) => d >= today).sort();
  if (days.length === 0) return 'todos';
  return days[0] === today ? 'hoy' : (days[0] as DateKey);
}

/** The first day after `after` (YYYY-MM-DD, exclusive) with an event, or null. */
export function nextDayWithEvents(events: Filterable[], after: string): DateKey | null {
  const days = events.map((e) => e.day).filter((d) => d > after).sort();
  return (days[0] as DateKey | undefined) ?? null;
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
