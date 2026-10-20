import { describe, expect, it } from 'vitest';
import { CATEGORIES, defaultDay, dayRange, nextDayWithEvents, primaryCategories, visibleIds, categoryCounts } from './filters';
import { formatDayShort } from './format';
import { parseUrlState, serializeUrlState } from './url-state';

const TZ = 'America/Monterrey';
const NOW = new Date('2026-10-04T18:00:00Z'); // Sunday 4 Oct, noon in Monterrey

describe('URL state', () => {
  it('reads day, categories and gratis', () => {
    expect(parseUrlState('?cuando=finde&cat=musica,cine&gratis=1')).toEqual({ day: 'finde', categories: ['music', 'film'], sources: [], free: true });
    expect(parseUrlState('?cuando=2026-10-06').day).toBe('2026-10-06');
  });
  it('ignores junk', () => {
    expect(parseUrlState('?cuando=ayer&cat=zzz&gratis=0')).toEqual({ day: null, categories: [], sources: [], free: false });
    expect(parseUrlState('')).toEqual({ day: null, categories: [], sources: [], free: false });
  });
  it('round-trips and leaves the default day out', () => {
    const state = { day: 'finde' as const, categories: new Set(['film', 'music'] as const), free: true };
    expect(serializeUrlState(state, 'hoy')).toBe('?cuando=finde&cat=musica,cine&gratis=1');
    expect(serializeUrlState({ day: 'hoy', categories: new Set(), free: false }, 'hoy')).toBe('');
  });
});

describe('URL state: sources', () => {
  it('reads ?fuente= as slugs, in order, without repeats', () => {
    expect(parseUrlState('?fuente=ticketmaster,arema').sources).toEqual(['ticketmaster', 'arema']);
    expect(parseUrlState('?fuente=arema,arema,%20ARENA-monterrey').sources).toEqual(['arema', 'arena-monterrey']);
  });
  it('drops anything that is not a plain slug', () => {
    expect(parseUrlState('?fuente=<script>,a b,../x,ok-one,--,-a,').sources).toEqual(['ok-one']);
    expect(parseUrlState('?fuente=' + 'a'.repeat(61)).sources).toEqual([]);
  });
  it('keeps at most 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => `s${i}`).join(',');
    expect(parseUrlState('?fuente=' + many).sources).toHaveLength(20);
  });
  it('round-trips with the other filters, sources sorted so the URL is stable', () => {
    const state = { day: 'finde' as const, categories: new Set(['music'] as const), sources: new Set(['arema', 'ticketmaster']), free: true };
    const query = serializeUrlState(state, 'hoy');
    expect(query).toBe('?cuando=finde&cat=musica&fuente=arema,ticketmaster&gratis=1');
    expect(parseUrlState(query)).toEqual({ day: 'finde', categories: ['music'], sources: ['arema', 'ticketmaster'], free: true });
  });
  it('leaves ?fuente= out when no source is selected', () => {
    expect(serializeUrlState({ day: 'hoy', categories: new Set(), sources: new Set(), free: false }, 'hoy')).toBe('');
    expect(serializeUrlState({ day: 'hoy', categories: new Set(), free: false }, 'hoy')).toBe('');
  });
});

describe('today-first', () => {
  const ev = (id: string, day: string, cat = 'music' as const, free = false) => ({ id, day, cat, free });
  it('opens on hoy when today has events, else the next day with events', () => {
    expect(defaultDay([ev('a', '2026-10-04'), ev('b', '2026-10-06')], NOW, TZ)).toBe('hoy');
    expect(defaultDay([ev('b', '2026-10-06'), ev('c', '2026-10-05')], NOW, TZ)).toBe('2026-10-05');
    expect(defaultDay([], NOW, TZ)).toBe('todos');
  });
  it('finds the next day after a given one', () => {
    expect(nextDayWithEvents([ev('a', '2026-10-04'), ev('b', '2026-10-06')], '2026-10-05')).toBe('2026-10-06');
    expect(nextDayWithEvents([ev('a', '2026-10-04')], '2026-10-04')).toBeNull();
  });
  it('mañana and a single date are one-day ranges in the city timezone', () => {
    expect(dayRange('manana', NOW, TZ)).toEqual({ from: '2026-10-05', to: '2026-10-05' });
    expect(dayRange('2026-10-09', NOW, TZ)).toEqual({ from: '2026-10-09', to: '2026-10-09' });
    expect(dayRange('manana', new Date('2026-10-05T04:30:00Z'), TZ)).toEqual({ from: '2026-10-05', to: '2026-10-05' }); // 22:30 on the 4th locally
  });
  it('formats "martes 6"', () => {
    expect(formatDayShort('2026-10-06')).toBe('martes 6');
  });
});

describe('gratis and low-count categories', () => {
  const events = [
    { id: 'a', day: '2026-10-04', cat: 'music' as const, free: true },
    { id: 'b', day: '2026-10-04', cat: 'music' as const },
    { id: 'c', day: '2026-10-04', cat: 'film' as const, free: true },
  ];
  it('filters to known-free events only', () => {
    expect([...visibleIds(events, { day: 'todos', categories: new Set(), free: true }, NOW, TZ)]).toEqual(['a', 'c']);
  });
  it('counts under gratis', () => {
    expect(categoryCounts(events, 'todos', NOW, TZ, true).music).toBe(1);
  });
  it('hides categories with one event unless selected', () => {
    const counts = categoryCounts(events, 'todos', NOW, TZ);
    expect([...primaryCategories(counts, new Set())]).toEqual(['music']);
    expect([...primaryCategories(counts, new Set(['film'] as const))]).toEqual(['music', 'film']);
    expect(CATEGORIES.length).toBe(9);
  });
});
