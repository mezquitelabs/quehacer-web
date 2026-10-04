import { describe, expect, it } from 'vitest';
import { formatVenue, shortVenue } from './format';

describe('formatVenue', () => {
  it('keeps only the text before " | "', () => {
    expect(formatVenue('Cinema Demo "Sala Azul" - Centro Ejemplo | EJEMPLO')).toBe('Cinema Demo "Sala Azul" - Centro Ejemplo');
    expect(formatVenue('Sala Uno, Centro Ejemplo | EJEMPLO')).toBe('Sala Uno, Centro Ejemplo');
    expect(formatVenue('A | B | C')).toBe('A');
  });
  it('replaces " I " with " · "', () => {
    expect(formatVenue('Teatro Demo I Sala Grande')).toBe('Teatro Demo · Sala Grande');
    expect(formatVenue('Teatro Demo I Sala Chica')).toBe('Teatro Demo · Sala Chica');
  });
  it('applies both, in that order', () => {
    expect(formatVenue('Teatro I Sala 2 | CONARTE')).toBe('Teatro · Sala 2');
  });
  it('leaves ordinary venues alone, including an "I" inside a word or at an edge', () => {
    expect(formatVenue('Arena Monterrey')).toBe('Arena Monterrey');
    expect(formatVenue('Auditorio Demo')).toBe('Auditorio Demo');
    expect(formatVenue('Isla I')).toBe('Isla I'); // no spaces on both sides: not a separator
  });
});

describe('shortVenue', () => {
  it('drops quoted text and turns " - " into " · "', () => {
    expect(shortVenue('Cineteca "Alejandra Rangel Hinojosa" - Centro de las Artes | CONARTE')).toBe('Cineteca · Centro de las Artes');
    expect(shortVenue('Cinema Demo "Sala Azul" - Centro Ejemplo')).toBe('Cinema Demo · Centro Ejemplo');
    expect(shortVenue('Teatro “Grande” Norte')).toBe('Teatro Norte');
  });
  it('keeps the CONARTE " I " separator rule and plain venues', () => {
    expect(shortVenue('Teatro de la Ciudad I Sala Grande')).toBe('Teatro de la Ciudad · Sala Grande');
    expect(shortVenue('Arena Monterrey')).toBe('Arena Monterrey');
  });
  it('never returns an empty string', () => {
    expect(shortVenue('"Solo comillas"')).toBe('"Solo comillas"');
  });
});
