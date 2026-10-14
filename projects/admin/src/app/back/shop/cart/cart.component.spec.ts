import { signal } from '@angular/core';
import { Member } from '../../../common/interfaces/member.interface';
import { CartComponent } from './cart.component';

describe('CartComponent', () => {
  function createComponent(): CartComponent {
    return new CartComponent(
      jasmine.createSpyObj('CartService', ['getCartAmount']),
      jasmine.createSpyObj('ProductService', ['listProducts']),
      jasmine.createSpyObj('SystemDataService', ['get_configuration']),
    );
  }

  it('allows an online checkout when the amount rounds to zero cents', () => {
    const component = createComponent();
    component.cart.items = [{
      product_id: 'card-product',
      product_account: 'CAR',
      payee: { id: 'member-1' } as Member,
      payee_name: 'TEST Jean',
      paied: 30,
    }];
    component.total_amount = signal(0.004);

    expect(component.isZeroTotal()).toBeTrue();
    expect(component.stripe_checkout_not_ready()).toBeFalse();
  });

  it('rejects an online checkout with a negative amount of at least one cent', () => {
    const component = createComponent();
    component.cart.items = [{
      product_id: 'card-product',
      product_account: 'CAR',
      payee: { id: 'member-1' } as Member,
      payee_name: 'TEST Jean',
      paied: 30,
    }];
    component.total_amount = signal(-0.01);

    expect(component.isZeroTotal()).toBeFalse();
    expect(component.stripe_checkout_not_ready()).toBeTrue();
  });
});
