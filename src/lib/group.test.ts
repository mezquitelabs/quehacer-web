import { describe, expect, it } from 'vitest';
import fixture from './fixtures/busy-day.json'; // synthetic: 10 invented screenings at one venue plus 3 events elsewhere
import { CINETECA_SOURCE, DEFAULT_GROUP_MIN, groupDay, groupKind, groupMinFromEnv, groupNoun } from './group';

type Ev = { id: string; venue: string | null; start: string };
const ev = (id: string, hour: number, venue: string | null = 'Sala A'): Ev => ({ id, venue, start: `2026-10-10T${String(hour).padStart(2, '0')}:00:00-06:00` });
const ids = (items: ReturnType<typeof groupDay<Ev>>) => items.map((i) => (i.kind === 'event' ? i.event.id : `[${i.events.map((e) => e.id).join(',')}]`));

describe('a busy day at one venue (synthetic fixture)', () => {
  const screenings = fixture.busy_venue_day as Ev[];
  it('has enough screenings to need grouping', () => {
    expect(screenings.length).toBeGreaterThanOrEqual(DEFAULT_GROUP_MIN);
  });
  it('collapses them into one card with every screening, in time order', () => {
    const items = groupDay(screenings);
    expect(items).toHaveLength(1);
    const group = items[0];
    expect(group.kind).toBe('group');
    if (group.kind !== 'group') return;
    expect(group.venue).toBe('Cinema Demo "Sala Azul" - Centro Ejemplo'); // the displayed venue, no " | EJEMPLO"
    expect(group.events).toHaveLength(screenings.length);
    expect(group.events.map((e) => e.start)).toEqual([...screenings.map((e) => e.start)].sort());
  });
  it('keeps unrelated events of that day as separate cards, around the group', () => {
    const mixed = [...(fixture.other_events_same_day as Ev[]), ...screenings];
    const items = groupDay(mixed);
    expect(items.filter((i) => i.kind === 'group')).toHaveLength(1);
    expect(items.filter((i) => i.kind === 'event')).toHaveLength(fixture.other_events_same_day.length);
    const starts = items.map((i) => (i.kind === 'event' ? i.event.start : i.events[0].start));
    expect(starts).toEqual([...starts].sort()); // items stay chronological
  });
});

describe('threshold', () => {
  it('groups at 4 or more, not at 3', () => {
    expect(ids(groupDay([ev('a', 10), ev('b', 11), ev('c', 12)]))).toEqual(['a', 'b', 'c']);
    expect(ids(groupDay([ev('a', 10), ev('b', 11), ev('c', 12), ev('d', 13)]))).toEqual(['[a,b,c,d]']);
  });
  it('is configurable', () => {
    const three = [ev('a', 10), ev('b', 11), ev('c', 12)];
    expect(ids(groupDay(three, 3))).toEqual(['[a,b,c]']);
    expect(ids(groupDay([...three, ev('d', 13)], 5))).toEqual(['a', 'b', 'c', 'd']);
  });
  it('reads GROUP_MIN_EVENTS, falling back to 4 for anything unusable', () => {
    expect(groupMinFromEnv(undefined)).toBe(4);
    expect(groupMinFromEnv('6')).toBe(6);
    expect(groupMinFromEnv('2')).toBe(2);
    for (const bad of ['', 'abc', '1', '0', '-3', '2.5', ' ']) expect(groupMinFromEnv(bad)).toBe(4);
  });
});

describe('what is and is not grouped', () => {
  it('never groups events without a venue, however many there are', () => {
    const nulls = [ev('a', 10, null), ev('b', 11, null), ev('c', 12, null), ev('d', 13, null), ev('e', 14, null)];
    expect(ids(groupDay(nulls))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('groups only events of the same venue', () => {
    const items = groupDay([ev('a', 10), ev('x', 10, 'Sala B'), ev('b', 11), ev('c', 12), ev('d', 13), ev('y', 15, 'Sala B')]);
    expect(ids(items)).toEqual(['[a,b,c,d]', 'x', 'y']);
  });
  it('compares venues as displayed, so spelling variants of one place group together', () => {
    const items = groupDay([ev('a', 10, 'Cinema X | EJEMPLO'), ev('b', 11, 'Cinema X'), ev('c', 12, 'Cinema X | EJEMPLO'), ev('d', 13, 'Cinema X')]);
    expect(ids(items)).toEqual(['[a,b,c,d]']);
  });
  it('places the group where its first event is and keeps chronological order', () => {
    const items = groupDay([ev('late', 20, 'Otra'), ev('a', 12), ev('early', 9, 'Otra'), ev('b', 13), ev('c', 14), ev('d', 15)]);
    expect(ids(items)).toEqual(['early', '[a,b,c,d]', 'late']);
  });
  it('does not change its input', () => {
    const input = [ev('b', 11), ev('a', 10), ev('c', 12), ev('d', 13)];
    const copy = JSON.stringify(input);
    groupDay(input);
    expect(JSON.stringify(input)).toBe(copy);
  });
  it('returns nothing for an empty day', () => {
    expect(groupDay([])).toEqual([]);
  });
});

describe('group noun: "funciones" only for the Cineteca', () => {
  const cine = { source: CINETECA_SOURCE };
  const other = { source: 'Ticketmaster' };
  it('is "funcion" when every item comes from the Cineteca', () => {
    expect(groupKind([cine, cine, cine, cine])).toBe('funcion');
    expect(groupNoun('funcion', 4)).toBe('funciones');
    expect(groupNoun('funcion', 1)).toBe('función');
  });
  it('is "actividad" as soon as one item comes from anywhere else', () => {
    expect(groupKind([cine, cine, cine, other])).toBe('actividad');
    expect(groupKind([other, other, other, other])).toBe('actividad');
    expect(groupNoun('actividad', 4)).toBe('actividades');
    expect(groupNoun('actividad', 1)).toBe('actividad');
  });
  it('an empty list is never "funcion"', () => {
    expect(groupKind([])).toBe('actividad');
  });
});
