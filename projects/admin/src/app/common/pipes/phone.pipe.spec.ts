import { formatPhoneNumber, normalizeFrenchPhoneNumber } from './phone.pipe';

describe('French phone formatting', () => {
  it('formats domestic numbers by pairs', () => {
    expect(normalizeFrenchPhoneNumber('0511223344')).toBe('05 11 22 33 44');
    expect(normalizeFrenchPhoneNumber('05-11-22-33-44')).toBe('05 11 22 33 44');
  });

  it('converts French international prefixes to domestic format', () => {
    expect(normalizeFrenchPhoneNumber('+33 5 11 22 33 44')).toBe('05 11 22 33 44');
    expect(normalizeFrenchPhoneNumber('0033511223344')).toBe('05 11 22 33 44');
    expect(normalizeFrenchPhoneNumber('33511223344')).toBe('05 11 22 33 44');
  });

  it('keeps unsupported values unchanged', () => {
    expect(normalizeFrenchPhoneNumber('+44 20 1234 5678')).toBe('+44 20 1234 5678');
  });

  it('uses non-breaking spaces when rendered by the pipe helper', () => {
    expect(formatPhoneNumber('0511223344')).toBe('05\u00a011\u00a022\u00a033\u00a044');
  });
});
