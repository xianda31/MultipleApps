import { SondageResultatsComponent } from './sondage-resultats.component';

describe('SondageResultatsComponent CSV', () => {
  const component = new SondageResultatsComponent(
    null as any, null as any, null as any, null as any, null as any,
  );
  const toCsvCell = (value: unknown) => (component as any).toCsvCell(value);

  it('doubles inner quotes so a free comment cannot break the row', () => {
    expect(toCsvCell('en "violet" cela irait')).toBe('"en ""violet"" cela irait"');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(toCsvCell('=SUM(A1:A9)')).toBe('"\'=SUM(A1:A9)"');
    expect(toCsvCell('+33 6 12 34 56 78')).toBe('"\'+33 6 12 34 56 78"');
    expect(toCsvCell('-5 étoiles')).toBe('"\'-5 étoiles"');
    expect(toCsvCell('@canal')).toBe('"\'@canal"');
  });

  it('flattens line breaks to keep one row per response', () => {
    expect(toCsvCell('ligne 1\nligne 2\r\nligne 3')).toBe('"ligne 1 ligne 2 ligne 3"');
  });

  it('keeps the separator inside a quoted cell and handles empty values', () => {
    expect(toCsvCell('a; b')).toBe('"a; b"');
    expect(toCsvCell(undefined)).toBe('""');
    expect(toCsvCell(null)).toBe('""');
  });
});
