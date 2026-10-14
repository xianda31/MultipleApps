import { Revenue } from '../../../common/interfaces/accounting.interface';
import { ShopInitializationService } from './shop-initialization.service';

describe('ShopInitializationService', () => {
  it('waits for book entries before exposing accounting operations', async () => {
    let finishLoading!: () => void;
    const loadingPromise = new Promise<void>((resolve) => {
      finishLoading = resolve;
    });
    const operations: Revenue[] = [{
      book_entry_id: 'entry-1',
      season: '2026/2027',
      date: '2026-10-14',
      label: 'avoir chargé',
      values: {},
    }];
    const bookService = jasmine.createSpyObj('BookService', [
      'whenBookEntriesLoaded',
      'get_operations',
    ]);
    bookService.whenBookEntriesLoaded.and.returnValue(loadingPromise);
    bookService.get_operations.and.returnValue(operations);
    const service = new ShopInitializationService(
      jasmine.createSpyObj('SystemDataService', ['get_season']),
      jasmine.createSpyObj('GroupService', ['getUserAccreditation']),
      bookService,
      jasmine.createSpyObj('ToastService', ['showInfo']),
      jasmine.createSpyObj('StripeTerminalService', [], { isNativeAndroid: false }),
    );

    let resolved = false;
    const resultPromise = service.loadOperations().then((result) => {
      resolved = true;
      return result;
    });
    await Promise.resolve();

    expect(resolved).toBeFalse();
    expect(bookService.get_operations).not.toHaveBeenCalled();

    finishLoading();
    const result = await resultPromise;

    expect(result).toBe(operations);
    expect(bookService.get_operations).toHaveBeenCalledTimes(1);
  });
});
