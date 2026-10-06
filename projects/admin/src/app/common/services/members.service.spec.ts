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
});