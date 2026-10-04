import { formatVenue } from './format';

/** A day with this many events (or more) at one venue shows them as a single expandable card. */
export const DEFAULT_GROUP_MIN = 4;

/** The threshold from the GROUP_MIN_EVENTS environment variable; anything that is not an integer >= 2 means the default. */
export function groupMinFromEnv(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 2 ? n : DEFAULT_GROUP_MIN;
}

export type DayItem<T> = { kind: 'event'; event: T } | { kind: 'group'; venue: string; events: T[] };

/**
 * Collapse the events of ONE day that share a venue when there are `min` or more of them.
 * The venue is compared as it is displayed (see formatVenue), events without a venue are never grouped, a group
 * sits where its first event would, and the order inside a group and between items stays chronological.
 */
export function groupDay<T extends { venue: string | null; start: string }>(events: T[], min: number = DEFAULT_GROUP_MIN): DayItem<T>[] {
  const ordered = [...events].sort((a, b) => a.start.localeCompare(b.start));
  const byVenue = new Map<string, T[]>();
  for (const event of ordered) {
    if (event.venue === null) continue;
    const key = formatVenue(event.venue);
    byVenue.set(key, [...(byVenue.get(key) ?? []), event]);
  }
  const items: DayItem<T>[] = [];
  const done = new Set<string>();
  for (const event of ordered) {
    const key = event.venue === null ? null : formatVenue(event.venue);
    const members = key === null ? undefined : byVenue.get(key);
    if (key !== null && members && members.length >= min) {
      if (!done.has(key)) {
        done.add(key);
        items.push({ kind: 'group', venue: key, events: members });
      }
    } else {
      items.push({ kind: 'event', event });
    }
  }
  return items;
}

/** The `source` name the export gives to the Cineteca; only its screenings are "funciones". */
export const CINETECA_SOURCE = 'Cineteca Nuevo León';

export type GroupKind = 'funcion' | 'actividad';

/** "funcion" only when EVERY item comes from the Cineteca source, otherwise the neutral "actividad". */
export function groupKind(events: { source: string }[]): GroupKind {
  return events.length > 0 && events.every((e) => e.source === CINETECA_SOURCE) ? 'funcion' : 'actividad';
}

/** The label after the count: "función"/"funciones" or "actividad"/"actividades". */
export function groupNoun(kind: GroupKind, n: number): string {
  const singular = kind === 'funcion' ? 'función' : 'actividad';
  return n === 1 ? singular : kind === 'funcion' ? 'funciones' : 'actividades';
}

/** Where grouped rows sit inside a day: after the single events (true) or in time order among them (false). */
export const GROUPS_AFTER_SINGLES = true;

/** Single events first (time order kept), then the groups (time order kept), when `groupsLast`. */
export function placeGroups<T>(items: DayItem<T>[], groupsLast: boolean = GROUPS_AFTER_SINGLES): DayItem<T>[] {
  if (!groupsLast) return items;
  return [...items.filter((i) => i.kind === 'event'), ...items.filter((i) => i.kind === 'group')];
}

/** The most common category among the events (the first one on a tie), for the row's colour bar. */
export function dominantCategory<C extends string>(events: { category: C }[]): C | undefined {
  const counts = new Map<C, number>();
  for (const e of events) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  let best: C | undefined;
  for (const [c, n] of counts) if (best === undefined || n > counts.get(best)!) best = c;
  return best;
}

/** "14:00–20:45", "14:00" for one time, or null; takes zero-padded 24 h "HH:MM" strings. */
export function timeRange(times: string[]): string | null {
  if (times.length === 0) return null;
  const sorted = [...times].sort();
  const [first, last] = [sorted[0], sorted[sorted.length - 1]];
  return first === last ? first : `${first}–${last}`;
}
