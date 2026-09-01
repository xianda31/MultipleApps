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
    const bookService = jasmine.createSpyObj('BookService', ['create_book_entry']);
    bookService.create_book_entry.and.resolveTo(sale);
    const productService = jasmine.createSpyObj('ProductService', ['getProduct']);
    productService.getProduct.and.returnValue({ productCode: '' });
    const gameCardService = jasmine.createSpyObj('GameCardService', ['createCard']);
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
    const savePromise = service.save_sale({ season: sale.season, date: sale.date })
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
});