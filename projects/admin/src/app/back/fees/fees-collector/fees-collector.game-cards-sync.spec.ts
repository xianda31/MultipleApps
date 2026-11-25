import { BehaviorSubject, of } from 'rxjs';
import { Member } from '../../../common/interfaces/member.interface';
import { FeesCollectorService } from './fees-collector.service';
import { GameCardService } from '../../services/game-card.service';
import { Game } from '../fees.interface';
import { PaymentMode } from '../../shop/cart/cart.interface';
import { CartService } from '../../shop/cart/cart.service';
import { BookService } from '../../services/book.service';
import { ProductService } from '../../../common/services/product.service';
import { CUSTOMER_ACCOUNT, FINANCIAL_ACCOUNT } from '../../../common/interfaces/accounting.interface';

describe('FeesCollectorService game-card synchronization', () => {
  it('records selected debt and asset with the card and links the resulting entry', async () => {
    const buyer = { id: 'buyer', firstname: 'Jean', lastname: 'TEST', license_number: '00000001' } as Member;
    const coBuyer = { id: 'co-buyer', firstname: 'Anne', lastname: 'TEST', license_number: '00000002' } as Member;
    const book = jasmine.createSpyObj<BookService>('BookService', ['create_book_entry', 'process_book_entry_actions']);
    book.create_book_entry.and.callFake(async entry => ({ ...entry, id: 'entry-1' }));
    book.process_book_entry_actions.and.resolveTo({});
    const cards = jasmine.createSpyObj<GameCardService>('GameCardService', ['refreshCards']);
    cards.refreshCards.and.resolveTo();
    const products = jasmine.createSpyObj<ProductService>('ProductService', ['getProduct']);
    products.getProduct.and.returnValue({ fulfillmentAction: 'CREATE_PLAYBOOK' } as never);
    const cart = new CartService(book, products, cards);
    cart.setBuyer('TEST Jean');
    cart.addToCart({ product_id: 'card-product', product_account: 'CAR', payee: buyer, payee_name: 'TEST Jean',
      paied: 30, paired_with: coBuyer, paired_name: 'TEST Anne' });
    cart.setDebt('TEST Jean', 20);
    cart.setAsset('TEST Jean', 10);
    const total = cart.getCartAmount();
    cart.payment = { mode: PaymentMode.CASH, amount: total, payer_id: buyer.id, bank: '', cheque_no: '' };
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    Object.assign(service, {
      BookService: book, gameCardService: cards,
      systemDataService: { get_season: () => '2026/2027' },
      update_members_debts: () => {}, update_members_credits: () => {},
    });

    await service.create_game_card_cart_sale([buyer, coBuyer], cart);
    const entry = book.create_book_entry.calls.mostRecent().args[0];
    expect(entry.amounts[FINANCIAL_ACCOUNT.CASHBOX_debit]).toBe(40);
    expect(entry.operations[0].values['CAR']).toBe(30);
    expect(entry.operations[0].values[CUSTOMER_ACCOUNT.DEBT_credit]).toBe(20);
    expect(entry.operations[0].values[CUSTOMER_ACCOUNT.ASSET_debit]).toBe(10);
    expect(entry.operations[1].values['CAR']).toBe(0);
    expect(entry.purchasedItems).toEqual([{ productId: 'card-product', beneficiaryMemberIds: ['buyer', 'co-buyer'], quantity: 1 }]);
    expect(book.process_book_entry_actions).toHaveBeenCalledOnceWith('entry-1');
    expect(cards.refreshCards).toHaveBeenCalled();
  });

  it('records an advance for the primary owner and links the shared card to the entry', async () => {
    const buyer = { id: 'buyer', firstname: 'Jean', lastname: 'TEST', license_number: '00000001' } as Member;
    const coBuyer = { id: 'co-buyer', firstname: 'Anne', lastname: 'TEST', license_number: '00000002' } as Member;
    const book = jasmine.createSpyObj('BookService', ['create_game_card_sale']);
    book.create_game_card_sale.and.resolveTo({ id: 'entry-1' });
    const cards = jasmine.createSpyObj('GameCardService', ['createCard']);
    cards.createCard.and.resolveTo({ id: 'card-1' });
    const service = Object.create(FeesCollectorService.prototype) as FeesCollectorService;
    Object.assign(service, {
      membersService: { full_name: (member: Member) => `${member.lastname} ${member.firstname}` },
      BookService: book,
      gameCardService: cards,
      update_members_debts: () => {},
      update_members_credits: () => {},
    });
    await service.create_game_card_advance([buyer, coBuyer], 30);
    expect(book.create_game_card_sale).toHaveBeenCalledOnceWith('TEST Jean', 30, PaymentMode.CREDIT, 'TEST Anne', undefined);
    expect(cards.createCard).toHaveBeenCalledOnceWith([buyer, coBuyer], undefined, undefined, false, 'entry-1');
    cards.createCard.and.rejectWith(new Error('network'));
    await expectAsync(service.create_game_card_advance([buyer], 30)).toBeRejectedWithError(/entry-1/);
  });

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
      'get_customers_assets',
      'get_debts',
    ]);
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
    memberSettingsService.getAvatarUrl.and.callFake(() => of('portrait-url'));
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
    const photo = service.game.gamers[0].photo_url$;
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
    expect(service.game.gamers[0].photo_url$).toBe(photo);
    expect(memberSettingsService.getAvatarUrl).toHaveBeenCalledTimes(1);
  });
});