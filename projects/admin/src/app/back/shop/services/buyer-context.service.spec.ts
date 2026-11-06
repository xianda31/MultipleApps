import { of } from 'rxjs';
import { Member } from '../../../common/interfaces/member.interface';
import { BookService } from '../../services/book.service';
import { BuyerContextService } from './buyer-context.service';
import { CartService } from '../cart/cart.service';
import { DBhandler } from '../../../common/services/graphQL.service';
import { MembersService } from '../../../common/services/members.service';
import { ToastService } from '../../../common/services/toast.service';
import { BookEntry, TRANSACTION_ID } from '../../../common/interfaces/accounting.interface';

describe('BuyerContextService balances', () => {
  const buyer = { id: 'buyer', firstname: 'Jean', lastname: 'TEST' } as Member;
  let books: jasmine.SpyObj<BookService>;
  let cart: jasmine.SpyObj<CartService>;
  let db: jasmine.SpyObj<DBhandler>;
  let service: BuyerContextService;

  beforeEach(() => {
    books = jasmine.createSpyObj<BookService>('BookService', [
      'whenBookEntriesLoaded', 'is_book_entries_loaded', 'find_member_debt', 'find_assets',
    ]);
    books.season = '2026/2027';
    books.whenBookEntriesLoaded.and.resolveTo([]);
    books.is_book_entries_loaded.and.returnValue(true);
    books.find_member_debt.and.returnValue(30);
    books.find_assets.and.returnValue(5);
    cart = jasmine.createSpyObj<CartService>('CartService', ['clearCart', 'setBuyer', 'setDebt', 'setAsset']);
    db = jasmine.createSpyObj<DBhandler>('DBhandler', ['listBookEntries']);
    service = new BuyerContextService(
      cart, books, jasmine.createSpyObj<MembersService>('MembersService', ['canPurchase']),
      jasmine.createSpyObj<ToastService>('ToastService', ['showWarning']), db,
    );
  });

  it('waits for accounting before publishing debt and assets', async () => {
    let resolveSync!: () => void;
    books.whenBookEntriesLoaded.and.returnValue(new Promise(resolve => {
      resolveSync = () => resolve([]);
    }));
    const setup = service.setupBuyer(buyer);
    expect(cart.setDebt).not.toHaveBeenCalled();
    expect(cart.setAsset).not.toHaveBeenCalled();
    resolveSync();
    await setup;
    expect(cart.setDebt).toHaveBeenCalledOnceWith('TEST Jean', 30);
    expect(cart.setAsset).toHaveBeenCalledOnceWith('TEST Jean', 5);
  });

  it('never interprets a synchronization timeout as a zero balance', async () => {
    books.is_book_entries_loaded.and.returnValue(false);
    await expectAsync(service.setupBuyer(buyer)).toBeRejectedWithError('La synchronisation comptable est indisponible.');
    expect(cart.setDebt).not.toHaveBeenCalled();
    expect(books.find_member_debt).not.toHaveBeenCalled();
  });

  it('reads fresh entries from the server before checkout using existing balance rules', async () => {
    const entries: BookEntry[] = [{
      id: 'credit', season: '2026/2027', date: '2026-11-04',
      transaction_id: TRANSACTION_ID.achat_adhérent_en_espèces, amounts: {}, operations: [{
        member: 'TEST Jean', label: '', values: { CAR: 30, creance_in: 30 },
      }],
    }];
    db.listBookEntries.and.returnValue(of(entries));
    await service.loadBalance(buyer, true);
    expect(db.listBookEntries).toHaveBeenCalledOnceWith('2026/2027');
    expect(books.find_member_debt).toHaveBeenCalledWith('TEST Jean', entries);
    expect(books.find_assets).toHaveBeenCalledWith('TEST Jean', entries);
  });

  it('does not apply a late result for an earlier buyer', async () => {
    let resolveFirst!: (state: { buyer: Member; debtAmount: number; assetAmount: number; message: string }) => void;
    const other = { ...buyer, id: 'other', firstname: 'Marie' };
    spyOn(service, 'loadBalance').and.callFake(member => member.id === buyer.id
      ? new Promise(resolve => { resolveFirst = resolve; })
      : Promise.resolve({ buyer: member, debtAmount: 10, assetAmount: 0, message: '' }));
    const first = service.setupBuyer(buyer);
    await service.setupBuyer(other);
    resolveFirst({ buyer, debtAmount: 30, assetAmount: 5, message: '' });
    await first;
    expect(cart.setDebt).toHaveBeenCalledOnceWith('TEST Marie', 10);
    expect(cart.setAsset).not.toHaveBeenCalled();
  });
});
