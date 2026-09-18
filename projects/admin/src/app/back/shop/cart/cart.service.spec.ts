import { Member } from '../../../common/interfaces/member.interface';
import { CartService } from './cart.service';
import { PaymentMode } from './cart.interface';

describe('CartService', () => {
  it('waits for both game cards before completing a two-card sale', async () => {
    const sale = {
      id: '0382e17b-70af-47a0-b380-8aa09002f313',
      season: '2026/2027',
      date: '2026-08-31',
    };
    const member = {
      id: 'member-1',
      firstname: 'Jean',
      lastname: 'ABÉLANET',
      license_number: '00000001',
    } as Member;
    const bookService = jasmine.createSpyObj('BookService', ['create_book_entry', 'process_book_entry_actions']);
    bookService.create_book_entry.and.resolveTo(sale);
    const productService = jasmine.createSpyObj('ProductService', ['getProduct']);
    productService.getProduct.and.returnValue({ productCode: '' });
    const gameCardService = jasmine.createSpyObj('GameCardService', ['createCard', 'refreshCards']);
    gameCardService.refreshCards.and.resolveTo();
    let resolveFirstCard!: () => void;
    let resolveSecondCard!: () => void;
    gameCardService.createCard.and.returnValues(
      new Promise<void>((resolve) => { resolveFirstCard = resolve; }),
      new Promise<void>((resolve) => { resolveSecondCard = resolve; }),
    );
    const service = new CartService(bookService, productService, gameCardService);
    service.setSeller('en ligne');
    service.payment = {
      mode: PaymentMode.CARD,
      amount: 60,
      payer_id: member.id,
      bank: '',
      cheque_no: '',
    };
    service.addToCart({
      product_id: 'card-product',
      product_account: 'CAR',
      payee: member,
      payee_name: 'ABÉLANET Jean',
      paied: 30,
    });
    service.addToCart({
      product_id: 'card-product',
      product_account: 'CAR',
      payee: member,
      payee_name: 'ABÉLANET Jean',
      paied: 30,
    });

    let saleCompleted = false;
    const savePromise = service.save_sale({ season: sale.season, date: sale.date }, undefined, 'frontend')
      .then(() => { saleCompleted = true; });
    await Promise.resolve();
    await Promise.resolve();

    expect(gameCardService.createCard).toHaveBeenCalledTimes(1);
    expect(saleCompleted).toBeFalse();

    resolveFirstCard();
    await Promise.resolve();
    await Promise.resolve();

    expect(gameCardService.createCard).toHaveBeenCalledTimes(2);
    expect(gameCardService.createCard.calls.allArgs()).toEqual([
      [[member], undefined, undefined, false, sale.id],
      [[member], undefined, undefined, false, sale.id],
    ]);
    expect(saleCompleted).toBeFalse();

    resolveSecondCard();
    await savePromise;

    expect(saleCompleted).toBeTrue();
  });

  it('processes a confirmed present sale through the backend', async () => {
    const sale = { id: 'book-entry-1', season: '2026/2027', date: '2026-09-16' };
    const member = {
      id: 'member-1',
      firstname: 'Jean',
      lastname: 'TEST',
      license_number: '00000001',
    } as Member;
    const bookService = jasmine.createSpyObj('BookService', ['create_book_entry', 'process_book_entry_actions']);
    bookService.create_book_entry.and.resolveTo(sale);
    bookService.process_book_entry_actions.and.resolveTo({ completed: 1, failed: 0 });
    const productService = jasmine.createSpyObj('ProductService', ['getProduct']);
    productService.getProduct.and.returnValue({ productCode: 'CAR12', fulfillmentAction: 'CREATE_PLAYBOOK' });
    const gameCardService = jasmine.createSpyObj('GameCardService', ['createCard', 'refreshCards']);
    gameCardService.refreshCards.and.resolveTo();
    const service = new CartService(bookService, productService, gameCardService);
    service.payment = { mode: PaymentMode.CASH, amount: 30, payer_id: member.id, bank: '', cheque_no: '' };
    service.addToCart({
      product_id: 'card-product',
      product_account: 'CAR',
      payee: member,
      payee_name: 'TEST Jean',
      paied: 30,
    });

    await service.save_sale({ season: sale.season, date: sale.date });

    expect(bookService.create_book_entry).toHaveBeenCalledWith(jasmine.objectContaining({
      status: 'confirmed',
      purchasedItems: [{ productId: 'card-product', beneficiaryMemberIds: ['member-1'], quantity: 1 }],
    }));
    expect(bookService.process_book_entry_actions).toHaveBeenCalledOnceWith(sale.id);
    expect(gameCardService.refreshCards).toHaveBeenCalledTimes(1);
    expect(gameCardService.createCard).not.toHaveBeenCalled();
  });

  it('keeps the cart while preparing a deferred terminal sale', async () => {
    const sale = { id: 'pending-book-entry', season: '2026/2027', date: '2026-09-17' };
    const member = {
      id: 'member-1', firstname: 'Jean', lastname: 'TEST', license_number: '00000001',
    } as Member;
    const bookService = jasmine.createSpyObj('BookService', ['create_book_entry', 'process_book_entry_actions']);
    bookService.create_book_entry.and.resolveTo(sale);
    const productService = jasmine.createSpyObj('ProductService', ['getProduct']);
    productService.getProduct.and.returnValue({ fulfillmentAction: 'CREATE_PLAYBOOK' });
    const gameCardService = jasmine.createSpyObj('GameCardService', ['createCard', 'refreshCards']);
    const service = new CartService(bookService, productService, gameCardService);
    service.payment = { mode: PaymentMode.CARD, amount: 30, payer_id: member.id, bank: '', cheque_no: '' };
    service.addToCart({
      product_id: 'card-product', product_account: 'CAR', payee: member, payee_name: 'TEST Jean', paied: 30,
    });

    await service.save_sale({ season: sale.season, date: sale.date }, member, 'deferred', false);

    expect(bookService.create_book_entry).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'pending' }));
    expect(service.getCartItems().length).toBe(1);
    expect(bookService.process_book_entry_actions).not.toHaveBeenCalled();
  });

  it('rejects a PlayBook sale before creating the BookEntry when a beneficiary has no license', async () => {
    const member = {
      id: 'member-1',
      firstname: 'Débutant',
      lastname: 'TEST',
      license_number: '',
    } as Member;
    const bookService = jasmine.createSpyObj('BookService', ['create_book_entry', 'process_book_entry_actions']);
    const productService = jasmine.createSpyObj('ProductService', ['getProduct']);
    productService.getProduct.and.returnValue({ productCode: 'CAR12', fulfillmentAction: 'CREATE_PLAYBOOK' });
    const gameCardService = jasmine.createSpyObj('GameCardService', ['createCard', 'refreshCards']);
    const service = new CartService(bookService, productService, gameCardService);
    service.payment = { mode: PaymentMode.CASH, amount: 30, payer_id: member.id, bank: '', cheque_no: '' };
    service.addToCart({
      product_id: 'card-product',
      product_account: 'CAR',
      payee: member,
      payee_name: 'TEST Débutant',
      paied: 30,
    });

    await expectAsync(service.save_sale({ season: '2026/2027', date: '2026-09-16' }))
      .toBeRejectedWithError(/licence manquante/);
    expect(bookService.create_book_entry).not.toHaveBeenCalled();
  });
});