import { MemberNfcCardService, normalizeNtag213Uid } from './member-nfc-card.service';

describe('MemberNfcCardService', () => {
  const uid = '04E50142E37384';
  it('normalizes UIDs and rejects malformed cards', () => {
    expect(normalizeNtag213Uid(' 04e50142e37384 ')).toBe(uid);
    for (const value of ['', '04E50142', '04:E5:01:42:E3:73:84', '04E50142E3738Z']) {
      expect(() => normalizeNtag213Uid(value)).toThrowError();
    }
  });
  it('does not turn failed UID lookups into unassigned cards', async () => {
    const service = new MemberNfcCardService();
    Object.defineProperty(service, 'client', { get: () => ({
      models: { MemberNfcCard: { get: async () => ({ errors: [{ message: 'Unauthorized' }] }) } },
    }) });
    await expectAsync(service.get(uid)).toBeRejectedWithError('Unauthorized');
  });
});
