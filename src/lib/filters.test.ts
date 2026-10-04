import { describe, expect, it } from 'vitest';
import {
  addDays,
  categoryCounts,
  dayRange,
  isFinished,
  liveEvents,
  STALE_HOURS,
  type Timed,
  localDateKey,
  matchesCategory,
  matchesDay,
  shownCategories,
  visibleIds,
  weekday,
  type Filterable,
} from './filters';

const TZ = 'America/Monterrey'; // UTC-6 all year
// Fixed "now" values, given as Monterrey wall-clock times with their offset.
const WED_NOON = new Date('2026-10-07T12:00:00-06:00'); // Wednesday
const SAT_MORNING = new Date('2026-10-10T09:00:00-06:00');
const SUN_EVENING = new Date('2026-10-11T20:00:00-06:00');

describe('local dates', () => {
  it('uses the city timezone, not UTC', () => {
    expect(localDateKey('2026-10-10T23:30:00-06:00', TZ)).toBe('2026-10-10'); // 05:30 UTC on the 11th
    expect(localDateKey('2026-10-11T00:30:00-06:00', TZ)).toBe('2026-10-11');
  });
  it('does not depend on the machine timezone', () => {
    const instant = new Date('2026-10-11T05:30:00Z');
    expect(localDateKey(instant, 'America/Monterrey')).toBe('2026-10-10');
    expect(localDateKey(instant, 'Asia/Tokyo')).toBe('2026-10-11'); // proves the zone argument is what decides
  });
  it('adds days across month ends and finds the weekday', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekday('2026-10-10')).toBe(6);
    expect(weekday('2026-10-11')).toBe(0);
  });
});

describe('day filters', () => {
  it('todos matches everything', () => {
    expect(dayRange('todos', WED_NOON, TZ)).toBeNull();
    expect(matchesDay('2030-01-01', 'todos', WED_NOON, TZ)).toBe(true);
  });
  it('hoy is the local calendar day', () => {
    expect(matchesDay('2026-10-07', 'hoy', WED_NOON, TZ)).toBe(true);
    expect(matchesDay('2026-10-08', 'hoy', WED_NOON, TZ)).toBe(false);
    expect(matchesDay('2026-10-06', 'hoy', WED_NOON, TZ)).toBe(false);
  });
  it('próximos 7 días is today plus six more', () => {
    expect(dayRange('7dias', WED_NOON, TZ)).toEqual({ from: '2026-10-07', to: '2026-10-13' });
    expect(matchesDay('2026-10-13', '7dias', WED_NOON, TZ)).toBe(true);
    expect(matchesDay('2026-10-14', '7dias', WED_NOON, TZ)).toBe(false);
    expect(matchesDay('2026-10-06', '7dias', WED_NOON, TZ)).toBe(false);
  });
  it('the weekend is the coming Saturday and Sunday on a weekday', () => {
    expect(dayRange('finde', WED_NOON, TZ)).toEqual({ from: '2026-10-10', to: '2026-10-11' });
  });
  it('on Saturday the weekend starts today; on Sunday only today is left', () => {
    expect(dayRange('finde', SAT_MORNING, TZ)).toEqual({ from: '2026-10-10', to: '2026-10-11' });
    expect(dayRange('finde', SUN_EVENING, TZ)).toEqual({ from: '2026-10-11', to: '2026-10-11' });
  });
});

describe('midnight edge', () => {
  // 23:30 in Monterrey on Saturday Oct 10 is already Sunday Oct 11 in UTC.
  const lateSaturday = new Date('2026-10-11T05:30:00Z');
  it('"hoy" at 23:30 local is still that local day', () => {
    expect(localDateKey(lateSaturday, TZ)).toBe('2026-10-10');
    expect(matchesDay('2026-10-10', 'hoy', lateSaturday, TZ)).toBe(true);
    expect(matchesDay('2026-10-11', 'hoy', lateSaturday, TZ)).toBe(false);
  });
  it('an event at 23:30 local is filed under its local day, and an hour later under the next', () => {
    expect(localDateKey('2026-10-10T23:30:00-06:00', TZ)).toBe('2026-10-10');
    expect(localDateKey('2026-10-10T00:30:00-06:00', TZ)).toBe('2026-10-10');
    expect(localDateKey('2026-10-10T23:59:59-06:00', TZ)).toBe('2026-10-10');
    expect(localDateKey('2026-10-11T00:00:00-06:00', TZ)).toBe('2026-10-11');
  });
  it('the weekend is judged by the local weekday at that moment', () => {
    // Friday 23:30 local = Saturday 05:30 UTC: still Friday here, so the weekend starts tomorrow
    const lateFriday = new Date('2026-10-10T05:30:00Z');
    expect(localDateKey(lateFriday, TZ)).toBe('2026-10-09');
    expect(dayRange('finde', lateFriday, TZ)).toEqual({ from: '2026-10-10', to: '2026-10-11' });
  });
});

describe('categories', () => {
  const events: Filterable[] = [
    { id: 'a', day: '2026-10-07', cat: 'music' },
    { id: 'b', day: '2026-10-07', cat: 'arts' },
    { id: 'c', day: '2026-10-10', cat: 'music' },
    { id: 'd', day: '2026-10-10', cat: 'other' },
    { id: 'e', day: '2026-10-20', cat: 'family' },
  ];
  const none = new Set<never>();
  it('none selected means all', () => {
    expect(matchesCategory('music', none)).toBe(true);
    expect(visibleIds(events, { day: 'todos', categories: none }, WED_NOON, TZ).size).toBe(5);
  });
  it('several selected chips combine with OR', () => {
    const ids = visibleIds(events, { day: 'todos', categories: new Set(['music', 'family'] as const) }, WED_NOON, TZ);
    expect([...ids].sort()).toEqual(['a', 'c', 'e']);
  });
  it('day and category combine with AND', () => {
    const ids = visibleIds(events, { day: '7dias', categories: new Set(['music'] as const) }, WED_NOON, TZ);
    expect([...ids].sort()).toEqual(['a', 'c']); // not 'e' (outside 7 days) and not 'b'/'d' (other categories)
    expect(visibleIds(events, { day: 'hoy', categories: new Set(['family'] as const) }, WED_NOON, TZ).size).toBe(0); // empty state
  });
  it('chip counts follow the day filter, not the other chips', () => {
    expect(categoryCounts(events, 'todos', WED_NOON, TZ)).toEqual({ music: 2, arts: 1, sports: 0, family: 1, community: 0, other: 1 });
    expect(categoryCounts(events, 'hoy', WED_NOON, TZ)).toEqual({ music: 1, arts: 1, sports: 0, family: 0, community: 0, other: 0 });
    expect(categoryCounts(events, '7dias', WED_NOON, TZ).music).toBe(2);
  });
});

describe('chip visibility', () => {
  const counts = { music: 3, arts: 0, sports: 0, family: 1, community: 0, other: 0 } as const;
  it('hides categories with no events', () => {
    expect([...shownCategories({ ...counts }, new Set())]).toEqual(['music', 'family']);
  });
  it('keeps order and shows everything that has events', () => {
    expect([...shownCategories({ music: 1, arts: 1, sports: 1, family: 1, community: 1, other: 1 }, new Set())]).toEqual(['music', 'arts', 'sports', 'family', 'community', 'other']);
  });
  it('keeps a selected chip visible even at count 0', () => {
    expect([...shownCategories({ ...counts }, new Set(['sports'] as const))]).toEqual(['music', 'sports', 'family']);
  });
  it('shows nothing when there are no events and nothing is selected', () => {
    expect(shownCategories({ music: 0, arts: 0, sports: 0, family: 0, community: 0, other: 0 }, new Set()).size).toBe(0);
  });
  it('follows the day filter (counts are recomputed per day)', () => {
    const events: Filterable[] = [
      { id: 'a', day: '2026-10-07', cat: 'music' },
      { id: 'b', day: '2026-10-20', cat: 'family' },
    ];
    expect([...shownCategories(categoryCounts(events, 'hoy', WED_NOON, TZ), new Set())]).toEqual(['music']);
    expect([...shownCategories(categoryCounts(events, 'todos', WED_NOON, TZ), new Set())]).toEqual(['music', 'family']);
  });
});

describe('finished events', () => {
  const NOW = new Date('2026-10-10T20:00:00-06:00'); // Saturday 20:00 in Monterrey
  const ev = (start: string, end: string | null = null, hasTime = true): Timed => ({ day: localDateKey(start, TZ), start, end, hasTime });

  it('uses a 3-hour window for events without an end', () => {
    expect(STALE_HOURS).toBe(3);
    expect(isFinished(ev('2026-10-10T17:01:00-06:00'), NOW, TZ)).toBe(false); // started 2 h 59 min ago
    expect(isFinished(ev('2026-10-10T17:00:00-06:00'), NOW, TZ)).toBe(false); // exactly 3 h: not "more than"
    expect(isFinished(ev('2026-10-10T16:59:00-06:00'), NOW, TZ)).toBe(true); // 3 h 01 min
    expect(isFinished(ev('2026-10-10T21:00:00-06:00'), NOW, TZ)).toBe(false); // in the future
  });
  it('an end time wins over the 3-hour window', () => {
    expect(isFinished(ev('2026-10-10T10:00:00-06:00', '2026-10-10T22:00:00-06:00'), NOW, TZ)).toBe(false); // started 10 h ago, still running
    expect(isFinished(ev('2026-10-10T19:00:00-06:00', '2026-10-10T19:30:00-06:00'), NOW, TZ)).toBe(true); // ended 30 min ago
    expect(isFinished(ev('2026-10-10T19:00:00-06:00', '2026-10-10T20:00:00-06:00'), NOW, TZ)).toBe(false); // ends exactly now
    expect(isFinished(ev('2026-10-10T19:00:00-06:00', '2026-10-10T19:59:59-06:00'), NOW, TZ)).toBe(true);
  });
  it('a multi-day event with an end stays until that end', () => {
    expect(isFinished(ev('2026-10-03T10:00:00-06:00', '2026-10-18T19:00:00-06:00'), NOW, TZ)).toBe(false);
  });
  it('a date-only event lasts the whole local day, not 3 hours', () => {
    const today = ev('2026-10-10T00:00:00-06:00', null, false);
    expect(isFinished(today, NOW, TZ)).toBe(false); // 20 hours after midnight: still today
    expect(isFinished(today, new Date('2026-10-10T23:59:00-06:00'), TZ)).toBe(false);
    expect(isFinished(today, new Date('2026-10-11T00:01:00-06:00'), TZ)).toBe(true); // the next local day
    expect(isFinished(ev('2026-10-09T00:00:00-06:00', null, false), NOW, TZ)).toBe(true); // yesterday
    expect(isFinished(ev('2026-10-12T00:00:00-06:00', null, false), NOW, TZ)).toBe(false);
  });
  it('judges the day in the city timezone near midnight', () => {
    // 23:30 local on the 10th is already the 11th in UTC; a date-only event of the 10th must still be shown
    const lateLocal = new Date('2026-10-11T05:30:00Z');
    expect(isFinished(ev('2026-10-10T00:00:00-06:00', null, false), lateLocal, TZ)).toBe(false);
    expect(isFinished(ev('2026-10-10T23:00:00-06:00', '2026-10-10T23:30:00-06:00'), new Date('2026-10-11T05:31:00Z'), TZ)).toBe(true);
    expect(isFinished(ev('2026-10-10T23:00:00-06:00', '2026-10-10T23:30:00-06:00'), new Date('2026-10-11T05:29:00Z'), TZ)).toBe(false);
  });
  it('liveEvents drops finished ones, and the chip counts and visible ids ignore them', () => {
    const items = [
      { id: 'over', cat: 'music', ...ev('2026-10-10T10:00:00-06:00', '2026-10-10T12:00:00-06:00') },
      { id: 'running', cat: 'music', ...ev('2026-10-10T18:00:00-06:00') },
      { id: 'later', cat: 'arts', ...ev('2026-10-10T22:00:00-06:00') },
      { id: 'tomorrow', cat: 'arts', ...ev('2026-10-11T12:00:00-06:00') },
    ] as (Filterable & Timed)[];
    const live = liveEvents(items, NOW, TZ);
    expect(live.map((e) => e.id)).toEqual(['running', 'later', 'tomorrow']);
    expect(categoryCounts(live, 'hoy', NOW, TZ)).toEqual({ music: 1, arts: 1, sports: 0, family: 0, community: 0, other: 0 });
    expect([...visibleIds(live, { day: 'todos', categories: new Set(['music'] as const) }, NOW, TZ)]).toEqual(['running']);
    expect(liveEvents(items, new Date('2026-10-12T12:00:00-06:00'), TZ)).toEqual([]); // everything over
  });
});
