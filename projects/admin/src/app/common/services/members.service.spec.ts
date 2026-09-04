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
});