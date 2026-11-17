import { MemberNfcCardService, normalizeNtag213Uid, NfcCaptureTimeoutError, NfcReaderStatus } from './member-nfc-card.service';

describe('MemberNfcCardService bridge', () => {
  const uid = '04E50142E37384';
  it('normalizes UIDs and rejects malformed cards', () => {
    expect(normalizeNtag213Uid(' 04e50142e37384 ')).toBe(uid);
    for (const value of ['', '04E50142', '04:E5:01:42:E3:73:84', '04E50142E3738Z']) {
      expect(() => normalizeNtag213Uid(value)).toThrowError();
    }
  });
  it('requests a fresh UID without credentials and propagates cancellation', async () => {
    const fetch = spyOn(globalThis, 'fetch').and.resolveTo(new Response(JSON.stringify({ uid })));
    const signal = new AbortController().signal;
    expect(await new MemberNfcCardService().acquire(signal)).toBe(uid);
    expect(fetch).toHaveBeenCalledOnceWith('http://127.0.0.1:17835/capture', jasmine.objectContaining({
      method: 'POST', headers: { 'X-ppNFC-Editor': '1' }, credentials: 'omit', signal,
    }));
  });
  it('reports bridge errors and rejects malformed success responses', async () => {
    const fetch = spyOn(globalThis, 'fetch').and.resolveTo(
      new Response(JSON.stringify({ message: 'Lecteur absent' }), { status: 503 }));
    const service = new MemberNfcCardService();
    await expectAsync(service.acquire(new AbortController().signal)).toBeRejectedWithError('Lecteur absent');
    fetch.and.resolveTo(new Response('{}'));
    await expectAsync(service.acquire(new AbortController().signal)).toBeRejectedWithError(/UID absent/);
    fetch.and.rejectWith(new TypeError('Failed to fetch'));
    await expectAsync(service.acquire(new AbortController().signal)).toBeRejectedWithError(/Liaison ppNFC impossible/);
  });
  it('checks the station without asking for a capture', async () => {
    const state: NfcReaderStatus = { version: '1.0', readerStatus: 'Disconnected', readerName: null, message: 'Absent', capturing: false };
    const fetch = spyOn(globalThis, 'fetch').and.resolveTo(new Response(JSON.stringify(state)));
    expect(await new MemberNfcCardService().status(new AbortController().signal)).toEqual(state);
    expect(fetch.calls.mostRecent().args[0]).toBe('http://127.0.0.1:17835/status');
    fetch.and.resolveTo(new Response('{}'));
    await expectAsync(new MemberNfcCardService().status(new AbortController().signal)).toBeRejected();
  });
  it('accepts a read-only ACS hardware probe in the status response', async () => {
    const state: NfcReaderStatus = {
      version: '1.0', readerStatus: 'Ready', readerName: 'ACR1555U', message: 'Ready', capturing: false,
      hardwareProbe: {
        state: 'Responsive', pcdPiccStatus: 1, message: 'Aucune carte',
        checkedAt: '2026-11-16T08:00:00Z',
      },
    };
    spyOn(globalThis, 'fetch').and.resolveTo(new Response(JSON.stringify(state)));
    await expectAsync(new MemberNfcCardService().status(new AbortController().signal)).toBeResolvedTo(state);
  });
  it('distinguishes an idle capture from a bridge failure', async () => {
    spyOn(globalThis, 'fetch').and.resolveTo(
      new Response(JSON.stringify({ message: 'Aucune nouvelle carte lue en 30 secondes.' }), { status: 408 }));
    await expectAsync(new MemberNfcCardService().acquire(new AbortController().signal))
      .toBeRejectedWithError(NfcCaptureTimeoutError, 'Aucune nouvelle carte lue en 30 secondes.');
  });
  it('does not turn failed UID lookups into unassigned cards', async () => {
    const service = new MemberNfcCardService();
    Object.defineProperty(service, 'client', { get: () => ({
      models: { MemberNfcCard: { get: async () => ({ errors: [{ message: 'Unauthorized' }] }) } },
    }) });
    await expectAsync(service.get(uid)).toBeRejectedWithError('Unauthorized');
  });

  it('explains an old ppNFC version and empty HTTP error responses', async () => {
    const fetch = spyOn(globalThis, 'fetch').and.resolveTo(new Response(null, { status: 404 }));
    const service = new MemberNfcCardService();
    await expectAsync(service.status(new AbortController().signal)).toBeRejectedWithError(/Mettez à jour puis relancez ppNFC/);
    fetch.and.resolveTo(new Response(null, { status: 403 }));
    await expectAsync(service.acquire(new AbortController().signal)).toBeRejectedWithError(/Erreur ppNFC \(403\)/);
    fetch.and.resolveTo(new Response('not JSON'));
    await expectAsync(service.acquire(new AbortController().signal)).toBeRejectedWithError(/contenu JSON attendu/);
  });
});
