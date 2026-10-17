import { signal } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { Member } from '../../../common/interfaces/member.interface';
import { CartComponent } from './cart.component';
import { Cart, PaymentMode } from './cart.interface';

describe('CartComponent', () => {
  function createComponent() {
    const cart: Cart = {
      items: [],
      debt: null,
      asset_available: null,
      asset_used: null,
      buyer_name: '',
      take_asset: true,
      take_debt: true,
    };
    const cartSubject = new BehaviorSubject(cart);
    const cartService = jasmine.createSpyObj('CartService', ['getCartAmount'], {
      cart$: cartSubject.asObservable(),
    });
    cartService.getCartAmount.and.returnValue(0);
    const productService = jasmine.createSpyObj('ProductService', ['listProducts']);
    productService.listProducts.and.returnValue(of([]));
    const systemDataService = jasmine.createSpyObj('SystemDataService', ['get_configuration']);
    systemDataService.get_configuration.and.returnValue(of({ banks: [] }));

    return {
      component: new CartComponent(cartService, productService, systemDataService),
      cart,
      cartSubject,
      cartService,
    };
  }

  it('allows an online checkout when the amount rounds to zero cents', () => {
    const { component } = createComponent();
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
    const { component } = createComponent();
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

  it('does not preselect cash before a 65 euro TPE sale', () => {
    const { component, cart, cartSubject, cartService } = createComponent();
    component.ngOnInit();

    expect(component.selected_payment.mode).toBeFalsy();

    cartService.getCartAmount.and.returnValue(65);
    cart.items.push({
      product_id: 'card-product',
      product_account: 'CAR',
      payee: { id: 'member-1' } as Member,
      payee_name: 'TEST Jean',
      paied: 65,
    });
    cartSubject.next(cart);

    expect(component.selected_payment.mode).toBeFalsy();

    const tpePayment = spyOn(component.tpePayment, 'emit');
    const complete = spyOn(component.complete, 'emit');
    component.selected_payment.mode = PaymentMode.CARD;
    component.payment_mode_change();
    component.validate_sale();

    expect(cartService.payment.mode).toBe(PaymentMode.CARD);
    expect(tpePayment).toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it('selects cash for a non-empty checkout whose balance rounds to zero', () => {
    const { component, cart, cartSubject, cartService } = createComponent();
    component.ngOnInit();

    cartService.getCartAmount.and.returnValue(0.004);
    cart.items.push({
      product_id: 'covered-product',
      product_account: 'CAR',
      payee: { id: 'member-1' } as Member,
      payee_name: 'TEST Jean',
      paied: 65,
    });
    cartSubject.next(cart);

    expect(component.selected_payment.mode).toBe(PaymentMode.CASH);
    expect(cartService.payment.mode).toBe(PaymentMode.CASH);
  });
});
