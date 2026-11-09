import { firstValueFrom, Subject, take } from 'rxjs';
import { Member } from '../interfaces/member.interface';
import { MembersService } from './members.service';

describe('MembersService', () => {
  function createService(memberLoad$: Subject<Member[]>) {
    const dbHandler = jasmine.createSpyObj('DBhandler', ['listMembers', 'createMember', 'updateMember']);
    dbHandler.listMembers.and.returnValue(memberLoad$.asObservable());

    const service = new MembersService(
      jasmine.createSpyObj('ToastService', ['showError', 'showWarning', 'showSuccess']),
      dbHandler,
      {} as any,
    );

    return { service, dbHandler };
  }

  it('shares one initial database load between concurrent consumers', async () => {
    const memberLoad$ = new Subject<Member[]>();
    const { service, dbHandler } = createService(memberLoad$);
    const firstLoad = firstValueFrom(service.listMembers().pipe(take(1)));
    const secondLoad = firstValueFrom(service.listMembers().pipe(take(1)));
    const members = [{ id: 'member-1', lastname: 'DUPONT' } as Member];

    expect(dbHandler.listMembers).toHaveBeenCalledTimes(1);
    memberLoad$.next(members);
    memberLoad$.complete();

    await expectAsync(firstLoad).toBeResolvedTo(members);
    await expectAsync(secondLoad).toBeResolvedTo(members);
  });

  it('propagates an initial database load failure', async () => {
    const memberLoad$ = new Subject<Member[]>();
    const { service } = createService(memberLoad$);
    const load = firstValueFrom(service.listMembers().pipe(take(1)));

    memberLoad$.error(new Error('Member database unavailable'));

    await expectAsync(load).toBeRejectedWithError('Member database unavailable');
  });

  it('refreshes a loaded cache and shares the refresh between concurrent consumers', async () => {
    const initialLoad$ = new Subject<Member[]>();
    const { service, dbHandler } = createService(initialLoad$);
    const initialLoad = firstValueFrom(service.listMembers());
    initialLoad$.next([]);
    initialLoad$.complete();
    await initialLoad;
    const refreshedLoad$ = new Subject<Member[]>();
    dbHandler.listMembers.and.returnValue(refreshedLoad$.asObservable());

    const firstRefresh = firstValueFrom(service.listMembers(true));
    const secondRefresh = firstValueFrom(service.listMembers(true));
    const members = [{ id: 'created-in-another-session', lastname: 'EXAMPLE' } as Member];
    refreshedLoad$.next(members);
    refreshedLoad$.complete();

    await expectAsync(firstRefresh).toBeResolvedTo(members);
    await expectAsync(secondRefresh).toBeResolvedTo(members);
    await expectAsync(firstValueFrom(service.listMembers())).toBeResolvedTo(members);
    expect(dbHandler.listMembers).toHaveBeenCalledTimes(2);
  });

  it('does not fall back to stale members when refreshing fails', async () => {
    const initialLoad$ = new Subject<Member[]>();
    const { service, dbHandler } = createService(initialLoad$);
    const initialLoad = firstValueFrom(service.listMembers());
    initialLoad$.next([{ id: 'cached-member', lastname: 'EXAMPLE' } as Member]);
    initialLoad$.complete();
    await initialLoad;
    const refreshedLoad$ = new Subject<Member[]>();
    dbHandler.listMembers.and.returnValue(refreshedLoad$.asObservable());
    const refresh = firstValueFrom(service.listMembers(true));
    refreshedLoad$.error(new Error('Member database unavailable'));

    await expectAsync(refresh).toBeRejectedWithError('Member database unavailable');
  });

  it('rejects members without a persisted lifecycle status', () => {
    const { service } = createService(new Subject<Member[]>());
    const member = { id: 'legacy-member' } as Member;

    spyOn(console, 'error');
    expect(() => service.getLifecycleStatus(member)).toThrowError(/Statut du membre absent/);
    expect(service.canLogin(member)).toBeFalse();
    expect(service.canPurchase(member)).toBeFalse();
  });

  it('allows active members to log in and purchase independently of their FFB license', () => {
    const { service } = createService(new Subject<Member[]>());
    const member = { id: 'outside-ffb', lifecycleStatus: 'ACTIVE', license_status: 'unregistered' } as Member;
    expect(service.canLogin(member)).toBeTrue();
    expect(service.canPurchase(member)).toBeTrue();
  });

  it('rejects null and invalid lifecycle statuses', () => {
    const { service } = createService(new Subject<Member[]>());
    spyOn(console, 'error');
    for (const lifecycleStatus of [null, '', 'UNKNOWN']) {
      const member: Member = JSON.parse(JSON.stringify({ id: 'invalid', lifecycleStatus }));
      expect(service.canLogin(member)).toBeFalse();
      expect(service.canPurchase(member)).toBeFalse();
      expect(() => service.getLifecycleStatus(member)).toThrowError(/Statut du membre absent/);
    }
  });

  it('does not create or update members without an explicit valid lifecycle status', async () => {
    const { service, dbHandler } = createService(new Subject<Member[]>());
    const member = { id: 'missing-status' } as Member;
    spyOn(console, 'error');

    await expectAsync(service.createMember(member)).toBeRejected();
    await expectAsync(service.updateMember(member)).toBeRejected();

    expect(dbHandler.createMember).not.toHaveBeenCalled();
    expect(dbHandler.updateMember).not.toHaveBeenCalled();
  });

  it('blocks archived and banned members from login and purchases', () => {
    const { service } = createService(new Subject<Member[]>());
    const archived = { id: 'archived', lifecycleStatus: 'ARCHIVED' } as Member;
    const banned = { id: 'banned', lifecycleStatus: 'BANNED' } as Member;

    expect(service.canLogin(archived)).toBeFalse();
    expect(service.canPurchase(archived)).toBeFalse();
    expect(service.canLogin(banned)).toBeFalse();
    expect(service.canPurchase(banned)).toBeFalse();
  });

  it('classifies a paid club member absent from the club FFB base without assuming their license status', () => {
    const { service } = createService(new Subject<Member[]>());
    spyOn(service, 'hasPaidMembership').and.returnValue(true);
    const member = {
      id: 'paid-unlicensed',
      license_number: '00604521',
      license_status: 'unregistered',
      memberStatus: 'NON_ADHERENT',
      person_id: 123,
    } as Member;

    expect(service.resolveMemberStatus(member)).toBe('OUTSIDE_FFB_CLUB');
  });
});