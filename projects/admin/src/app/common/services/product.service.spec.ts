import { defer, firstValueFrom, of, throwError } from 'rxjs';
import { Product } from '../../back/products/product.interface';
import { DBhandler } from './graphQL.service';
import { ProductService } from './product.service';
import { SystemDataService } from './system-data.service';
import { ToastService } from './toast.service';

describe('ProductService catalogue refresh', () => {
  function product(id: string): Product {
    return {
      id, name: id, productCode: null, description: '', glyph: '', price: 15, account: 'PAF',
      paired: false, currency: 'EUR', stripeEnabled: false, active: true,
    };
  }

  function setup() {
    const db = jasmine.createSpyObj<DBhandler>('DBhandler', ['listProducts']);
    const systemData = jasmine.createSpyObj<SystemDataService>('SystemDataService', ['get_configuration']);
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['showError']);
    const service = new ProductService(systemData, toast, db);
    spyOn(service, 'sorted_products').and.callFake(products => of(products));
    return { service, db };
  }

  it('reloads a cloned catalogue and notifies existing subscribers instead of returning cached products', async () => {
    const { service, db } = setup();
    const beforeClone = product('sandbox-product');
    const afterClone = product('production-product');
    db.listProducts.and.returnValue(of([beforeClone]));
    await firstValueFrom(service.listProducts());

    const readCatalogue = jasmine.createSpy('readCatalogue');
    db.listProducts.and.returnValue(defer(() => {
      readCatalogue();
      return of([afterClone]);
    }));
    expect(await firstValueFrom(service.listProducts())).toEqual([beforeClone]);
    expect(readCatalogue).not.toHaveBeenCalled();

    const updates: Product[][] = [];
    const subscription = service.listProducts().subscribe(products => updates.push(products));
    const refresh = service.listProducts(true);
    expect(readCatalogue).not.toHaveBeenCalled();
    expect(await firstValueFrom(refresh)).toEqual([afterClone]);
    expect(updates).toEqual([[beforeClone], [afterClone]]);
    expect(readCatalogue).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });

  it('reports refresh failures rather than returning the old catalogue as a successful refresh', async () => {
    const { service, db } = setup();
    db.listProducts.and.returnValue(of([product('sandbox-product')]));
    await firstValueFrom(service.listProducts());
    db.listProducts.and.returnValue(throwError(() => new Error('Catalogue inaccessible')));

    await expectAsync(firstValueFrom(service.listProducts(true)))
      .toBeRejectedWithError('Catalogue inaccessible');
  });
});
