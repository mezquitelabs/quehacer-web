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
