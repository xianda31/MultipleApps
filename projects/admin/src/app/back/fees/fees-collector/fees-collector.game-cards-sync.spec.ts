import { BehaviorSubject, of } from 'rxjs';
import { Member } from '../../../common/interfaces/member.interface';
import { FeesCollectorService } from './fees-collector.service';
import { GameCardService } from '../../services/game-card.service';
import { Game } from '../fees.interface';

describe('FeesCollectorService game-card synchronization', () => {
  it('updates credits when another client creates a card', () => {
    const member = {
      id: 'member-1',
      firstname: 'Jean',
      lastname: 'DUPONT',
      license_number: '00123456',
    } as Member;
    const playBooks$ = new BehaviorSubject<any[]>([]);
    const membersService = jasmine.createSpyObj('MembersService', [
      'listMembers',
      'getMemberbyLicense',
      'full_name',
    ]);
    membersService.listMembers.and.returnValue(of([member]));
    membersService.getMemberbyLicense.and.returnValue(member);
    membersService.full_name.and.returnValue('DUPONT Jean');

    const toastService = jasmine.createSpyObj('ToastService', [
      'showError',
      'showInfo',
      'showSuccess',
      'showWarning',
    ]);
    const dbHandler = jasmine.createSpyObj('DBhandler', ['queryPlayBooks']);
    dbHandler.queryPlayBooks.and.returnValue(playBooks$.asObservable());
    const bookService = jasmine.createSpyObj('BookService', [
      'find_member_acc_operations',
      'get_customers_assets',
      'get_debts',
    ]);
    bookService.find_member_acc_operations.and.returnValue([]);
    bookService.get_customers_assets.and.returnValue(new Map());
    bookService.get_debts.and.returnValue(new Map());

    const gameCardService = new GameCardService(
      membersService,
      toastService,
      jasmine.createSpyObj('MailingService', ['sendEmail']),
      dbHandler,
      bookService,
    );
    const systemDataService = jasmine.createSpyObj('SystemDataService', ['get_configuration']);
    systemDataService.get_configuration.and.returnValue(of({ season: '2026', fee_rates: [] }));
    const memberSettingsService = jasmine.createSpyObj('MemberSettingsService', ['getAvatarUrl']);
    memberSettingsService.getAvatarUrl.and.returnValue(null);
    const service = new FeesCollectorService(
      toastService,
      membersService,
      {} as any,
      systemDataService,
      gameCardService,
      bookService,
      memberSettingsService,
      dbHandler,
    );
    service.game = {
      gamers: [{
        license: member.license_number,
        firstname: member.firstname,
        lastname: member.lastname,
        is_member: true,
        game_credits: 0,
      }],
    } as Game;
    let emittedCredits = 0;
    service.game$.subscribe(game => {
      emittedCredits = game.gamers?.[0]?.game_credits ?? 0;
    });

    (service as any).update_members_assets();
    playBooks$.next([{
      id: 'remote-card',
      licenses: [member.license_number],
      initial_qty: 12,
      stamps: [],
      createdAt: '2026-10-03T10:00:00.000Z',
      updatedAt: '2026-10-03T10:00:00.000Z',
    }]);

    expect(service.game.gamers[0].game_credits).toBe(12);
    expect(emittedCredits).toBe(12);
  });
});