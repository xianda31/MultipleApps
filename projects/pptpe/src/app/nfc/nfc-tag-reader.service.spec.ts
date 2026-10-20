import { normalizeNfcUid } from './nfc-tag-reader.service';

describe('normalizeNfcUid', () => {
  it('normalizes a seven-byte NTAG213 UID', () => {
    expect(normalizeNfcUid('04:E5:01:42:E3:73:84')).toBe('04E50142E37384');
  });

  it('accepts spaces and lowercase hexadecimal characters', () => {
    expect(normalizeNfcUid('04 e5 01 42 e3 73 84')).toBe('04E50142E37384');
  });

  it('rejects an empty or malformed UID', () => {
    expect(() => normalizeNfcUid('')).toThrowError(/UID NFC invalide/);
    expect(() => normalizeNfcUid('123')).toThrowError(/UID NFC invalide/);
  });
});
