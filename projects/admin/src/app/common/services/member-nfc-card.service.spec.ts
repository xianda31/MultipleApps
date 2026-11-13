import { Amplify } from '@aws-amplify/core';
import { Member } from '../interfaces/member.interface';
import { MemberNfcCard, MemberNfcCardService, normalizeNtag213Uid } from './member-nfc-card.service';

describe('MemberNfcCardService', () => {
  const uid = '04E50142E37384';
  const card: MemberNfcCard = {
    uid, licenseNumber: '00123456', status: 'ACTIVE',
    assignedAt: '2026-11-11T10:00:00Z', assignedBy: 'operator',
    createdAt: '2026-11-11T10:00:00Z', updatedAt: '2026-11-11T10:00:00Z',
  };
  const member: Member = {
    id: 'member-1', firstname: 'Alex', lastname: 'EXAMPLE', gender: 'U',
    license_number: card.licenseNumber, lifecycleStatus: 'ACTIVE',
    birthdate: '', city: '', email: '', phone_one: '', license_taken_at: '',
    license_status: '', membership_date: '', accept_mailing: false,
  };

  it('normalizes lowercase UIDs without losing leading zeros', () => {
    expect(normalizeNtag213Uid(' 04e50142e37384 ')).toBe(uid);
  });

  it('rejects malformed, truncated and non-NTAG213 UIDs', () => {
    for (const value of ['', '04E50142', '04:E5:01:42:E3:73:84', '04E50142E3738Z', '04E50142E3738400']) {
      expect(() => normalizeNtag213Uid(value)).toThrowError();
    }
  });

  it('requests a fresh UID using the local bridge and propagates the cancellation signal', async () => {
    const fetch = spyOn(globalThis, 'fetch').and.resolveTo(new Response(JSON.stringify({ uid: uid.toLowerCase() })));
    const signal = new AbortController().signal;
    expect(await new MemberNfcCardService().acquire(signal)).toBe(uid);
    expect(fetch).toHaveBeenCalledOnceWith('http://127.0.0.1:17835/capture', jasmine.objectContaining({
      method: 'POST', headers: { 'X-ppNFC-Editor': '1' }, credentials: 'omit', signal,
    }));
  });

  it('reports bridge errors and invalid success responses', async () => {
    const fetch = spyOn(globalThis, 'fetch').and.resolveTo(
      new Response(JSON.stringify({ message: 'Lecteur absent' }), { status: 503 }),
    );
    const service = new MemberNfcCardService();
    await expectAsync(service.acquire(new AbortController().signal)).toBeRejectedWithError('Lecteur absent');
    fetch.and.resolveTo(new Response(JSON.stringify({ uid: 'invalid' })));
    await expectAsync(service.acquire(new AbortController().signal)).toBeRejected();
    fetch.and.resolveTo(new Response(JSON.stringify({})));
    await expectAsync(service.acquire(new AbortController().signal)).toBeRejectedWithError(/UID absent/);
  });

  it('explains unavailable ppNFC without swallowing cancellation', async () => {
    const fetch = spyOn(globalThis, 'fetch').and.rejectWith(new TypeError('Failed to fetch'));
    const service = new MemberNfcCardService();
    await expectAsync(service.acquire(new AbortController().signal)).toBeRejectedWithError(/Liaison ppNFC impossible/);
    const stop = new AbortController();
    stop.abort();
    const aborted = new DOMException('Aborted', 'AbortError');
    fetch.and.rejectWith(aborted);
    await expectAsync(service.acquire(stop.signal)).toBeRejectedWith(aborted);
  });

  it('paginates member cards using the licence index', async () => {
    const list = jasmine.createSpy().and.returnValues(
      Promise.resolve({ data: [card], nextToken: 'next' }),
      Promise.resolve({ data: [{ ...card, uid: '04E50142E37385' }], nextToken: null }),
    );
    const service = new MemberNfcCardService();
    Object.defineProperty(service, 'client', { get: () => ({ models: { MemberNfcCard: { memberNfcCardsByLicense: list } } }) });
    expect((await service.list(card.licenseNumber)).length).toBe(2);
    expect(list.calls.argsFor(1)).toEqual([{ licenseNumber: card.licenseNumber }, { nextToken: 'next' }]);
  });

  it('never treats a failed UID lookup as a free card', async () => {
    const get = jasmine.createSpy().and.resolveTo({ data: null, errors: [{ message: 'Unauthorized' }] });
    const service = new MemberNfcCardService();
    Object.defineProperty(service, 'client', { get: () => ({ models: { MemberNfcCard: { get } } }) });
    await expectAsync(service.get(uid)).toBeRejectedWithError('Unauthorized');
  });

  it('deactivates without deleting or changing attribution and protects against stale edits', async () => {
    const graphql = jasmine.createSpy().and.resolveTo({ data: { updateMemberNfcCard: { ...card, status: 'DISABLED' } } });
    const service = new MemberNfcCardService();
    Object.defineProperty(service, 'client', { get: () => ({ graphql }) });
    expect((await service.deactivate(card)).status).toBe('DISABLED');
    expect(graphql.calls.mostRecent().args[0].variables).toEqual({
      input: { uid, status: 'DISABLED' },
      condition: {
        licenseNumber: { eq: card.licenseNumber }, status: { eq: 'ACTIVE' }, updatedAt: { eq: card.updatedAt },
      },
    });
    graphql.and.rejectWith(new Error('ConditionalCheckFailed'));
    await expectAsync(service.deactivate(card)).toBeRejectedWithError('ConditionalCheckFailed');
  });

  it('refuses updates without a stored version and active transfers to another member', async () => {
    const service = new MemberNfcCardService();
    await expectAsync(service.deactivate({ ...card, updatedAt: '' })).toBeRejectedWithError(/Version/);
    await expectAsync(service.assign(uid, { ...member, license_number: '87654321' }, card))
      .toBeRejectedWithError(/Désactivez/);
  });

  it('refuses activation for inactive, unknown or ambiguous members before writing', async () => {
    const list = jasmine.createSpy().and.resolveTo({ data: [{ ...member, lifecycleStatus: 'ARCHIVED' }] });
    const service = new MemberNfcCardService();
    Object.defineProperty(service, 'client', { get: () => ({ models: { Member: { list } } }) });
    await expectAsync(service.assign(uid, member, null)).toBeRejectedWithError(/explicitement actif/);
    list.and.resolveTo({ data: [] });
    await expectAsync(service.assign(uid, member, null)).toBeRejectedWithError(/inconnue ou ambiguë/);
    list.and.resolveTo({ data: [member, { ...member, id: 'duplicate' }] });
    await expectAsync(service.assign(uid, member, null)).toBeRejectedWithError(/inconnue ou ambiguë/);
    list.and.resolveTo({ data: [{ ...member, lifecycleStatus: 'BANNED' }] });
    await expectAsync(service.assign(uid, member, null)).toBeRejectedWithError(/explicitement actif/);
  });

  it('assigns, reloads, deactivates and transfers a card without a reader', async () => {
    const otherMember = { ...member, id: 'member-2', license_number: '87654321' };
    const members = [member, otherMember];
    let stored: MemberNfcCard | null = null;
    let version = 0;
    spyOn(Amplify, 'getConfig').and.returnValue({
      Auth: { Cognito: { userPoolId: 'test-pool', userPoolClientId: 'test-client' } },
    });
    const token = { payload: { sub: 'operator', 'cognito:username': 'operator' }, toString: () => 'token' };
    spyOn(Amplify.Auth, 'getTokens').and.resolveTo({ accessToken: token, idToken: token });

    const create = jasmine.createSpy().and.callFake(async (input: Pick<MemberNfcCard,
      'uid' | 'licenseNumber' | 'status' | 'assignedAt' | 'assignedBy'>) => {
      if (stored) return { data: null, errors: [{ message: 'Card already exists' }] };
      stored = { ...input, createdAt: '2026-11-13T00:00:00Z', updatedAt: String(++version) };
      return { data: { ...stored } };
    });
    const graphql = jasmine.createSpy().and.callFake(async (request: {
      variables: {
        input: Partial<MemberNfcCard>;
        condition: { licenseNumber: { eq: string }; status: { eq: string }; updatedAt: { eq: string } };
      };
    }) => {
      const { input, condition } = request.variables;
      if (!stored || stored.uid !== input.uid || stored.licenseNumber !== condition.licenseNumber.eq
        || stored.status !== condition.status.eq || stored.updatedAt !== condition.updatedAt.eq) {
        throw new Error('ConditionalCheckFailed');
      }
      stored = { ...stored, ...input, updatedAt: String(++version) };
      return { data: { updateMemberNfcCard: { ...stored } } };
    });
    const service = new MemberNfcCardService();
    Object.defineProperty(service, 'client', { get: () => ({
      models: {
        Member: {
          list: async ({ filter }: { filter: { license_number: { eq: string } } }) => ({
            data: members.filter(candidate => candidate.license_number === filter.license_number.eq),
          }),
        },
        MemberNfcCard: {
          create,
          get: async ({ uid: requested }: { uid: string }) => ({
            data: stored?.uid === requested ? { ...stored } : null,
          }),
          memberNfcCardsByLicense: async ({ licenseNumber }: { licenseNumber: string }) => ({
            data: stored?.licenseNumber === licenseNumber ? [{ ...stored }] : [],
          }),
        },
      },
      graphql,
    }) });

    const assigned = await service.assign(uid.toLowerCase(), member, null);
    expect(assigned.assignedBy).toBe('operator');
    expect(await service.list(member.license_number)).toEqual([assigned]);
    await expectAsync(service.assign(uid, otherMember, assigned)).toBeRejectedWithError(/Désactivez/);
    const disabled = await service.deactivate(assigned);
    expect((await service.get(uid))?.status).toBe('DISABLED');
    await expectAsync(service.deactivate(assigned)).toBeRejectedWithError('ConditionalCheckFailed');
    const transferred = await service.assign(uid, otherMember, disabled);
    expect(transferred.licenseNumber).toBe(otherMember.license_number);
    expect(transferred.status).toBe('ACTIVE');
    expect(await service.list(member.license_number)).toEqual([]);
    expect(await service.list(otherMember.license_number)).toEqual([transferred]);
  });
});
