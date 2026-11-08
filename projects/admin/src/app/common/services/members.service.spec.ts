import { firstValueFrom, Subject, take } from 'rxjs';
import { Member } from '../interfaces/member.interface';
import { MembersService } from './members.service';

describe('MembersService', () => {
  function createService(memberLoad$: Subject<Member[]>) {
    const dbHandler = jasmine.createSpyObj('DBhandler', ['listMembers']);
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

  it('treats members without a persisted lifecycle status as active', () => {
    const { service } = createService(new Subject<Member[]>());
    const member = { id: 'legacy-member' } as Member;

    expect(service.getLifecycleStatus(member)).toBe('ACTIVE');
    expect(service.canLogin(member)).toBeTrue();
    expect(service.canPurchase(member)).toBeTrue();
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