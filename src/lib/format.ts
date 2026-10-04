// All formatting is done in the CITY's timezone, never the browser's or the build machine's.
const LOCALE = 'es-MX';

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

/** "sábado, 3 de octubre" for a YYYY-MM-DD key (a pure calendar date: no timezone involved). */
export function formatDayHeading(key: string, withYear = false): string {
  const date = new Date(`${key}T12:00:00Z`);
  return new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) }).format(date);
}

export function formatShortDate(iso: string, timeZone: string, withYear = false): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) }).format(new Date(iso));
}

/** "Del 18 sep al 1 ene 2027", "Desde el 1 jul (sin fecha de cierre)". */
export function formatRange(start: string, end: string | null, timeZone: string): string {
  const startYear = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' }).format(new Date(start));
  if (end === null) return `Desde el ${formatShortDate(start, timeZone)} (sin fecha de cierre)`;
  const endYear = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' }).format(new Date(end));
  const crossYear = startYear !== endYear;
  return `Del ${formatShortDate(start, timeZone, crossYear)} al ${formatShortDate(end, timeZone, crossYear)}`;
}

export function formatUpdated(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, dateStyle: 'long', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(iso));
}

/** "conarte.org.mx" from a URL, for link text when the data carries no source name. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * How a venue is SHOWN (the exported data is unchanged): only the text before " | " (CONARTE appends its own
 * name after it), and CONARTE's " I " separator becomes " · ".
 *   'Cinema Demo "X" - Centro Ejemplo | EJEMPLO'  ->  'Cinema Demo "X" - Centro Ejemplo'
 *   'Teatro Demo I Sala Grande'                    ->  'Teatro Demo · Sala Grande'
 */
export function formatVenue(venue: string): string {
  return venue.split(' | ')[0].replace(/ I /g, ' · ').trim();
}
