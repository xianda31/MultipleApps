import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal, NgbModalConfig } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { ProductService } from '../../common/services/product.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';
import { Product } from '../products/product.interface';
import { BookService } from '../services/book.service';
import { CardPaymentOrchestratorService } from '../services/card-payment-orchestrator.service';
import { PaymentMode } from '../shop/cart/cart.interface';
import { ShopInitializationService } from '../shop/services/shop-initialization.service';
import { StripeTerminalService } from '../shop/services/stripe-terminal.service';
import { SondageService } from '../sondage/sondage.service';
import { SurveyResultsService } from '../sondage/survey-results.service';
import { BilletterieComponent } from './collecte-vente.component';
import { TicketingPayment, TicketingService } from './ticketing.service';

describe('Billetterie checkout dialog', () => {
  const product: Product = {
    id: 'event', name: 'Test event', description: '', glyph: '', price: 15,
    account: 'EVENT', paired: false, currency: 'EUR', stripeEnabled: false, active: true,
  };
  const payment: TicketingPayment = {
    id: 'payment', productId: product.id, eventTitle: product.name, season: '2026',
    date: '2026-11-25', createdAt: '2026-11-25T10:00:00Z', updatedAt: '2026-11-25T10:00:00Z',
    status: 'active', paymentMode: 'cash', totalAmount: 30, reservationCount: 2,
  };
  let fixture: ComponentFixture<BilletterieComponent>;
  let component: BilletterieComponent;
  let ticketing: jasmine.SpyObj<TicketingService>;
  let card: jasmine.SpyObj<CardPaymentOrchestratorService>;
  let toast: jasmine.SpyObj<ToastService>;

  function reservation(id: string, name: string): BilletterieComponent['reservations'][number] {
    return {
      id, memberName: name, reservationKey: id, isMember: true, reservationStatus: 'reserved',
      expectedProductId: product.id, eventTitle: product.name, season: '2026', date: '2026-11-25',
      createdAt: payment.createdAt, updatedAt: payment.updatedAt, selected: false, price: 15, product,
    };
  }

  function openCheckout(): void {
    component.reservations.forEach(row => row.selected = true);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.selection-checkout button').click();
    TestBed.inject(ApplicationRef).tick();
  }

  beforeEach(async () => {
    registerLocaleData(localeFr);
    ticketing = jasmine.createSpyObj<TicketingService>('TicketingService', [
      'createPayment', 'markReservationsSold', 'listEventReservations', 'listEventPayments',
    ]);
    ticketing.createPayment.and.resolveTo(payment);
    ticketing.markReservationsSold.and.resolveTo();
    ticketing.listEventReservations.and.resolveTo([]);
    ticketing.listEventPayments.and.resolveTo([]);
    card = jasmine.createSpyObj<CardPaymentOrchestratorService>(
      'CardPaymentOrchestratorService', ['payByCard', 'cancelRemotePayment'], { isRemoteMode: true },
    );
    card.payByCard.and.resolveTo();
    card.cancelRemotePayment.and.resolveTo();
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['showError', 'showSuccess', 'showWarning']);
    await TestBed.configureTestingModule({
      imports: [BilletterieComponent],
      providers: [
        { provide: ProductService, useValue: { listProducts: () => of([]) } },
        { provide: TicketingService, useValue: ticketing },
        { provide: BookService, useValue: {} },
        { provide: ToastService, useValue: toast },
        { provide: SystemDataService, useValue: {
          get_season: () => '2026', get_configuration: () => of({ tpe_payment_active: true }),
        } },
        { provide: StripeTerminalService, useValue: { status$: of('idle'), isNativeAndroid: false } },
        { provide: ShopInitializationService, useValue: {
          initTPE: () => Promise.resolve(), tpeReaderConnected$: of(false),
          tpeReaderLabel$: of(''), tpeScanning$: of(false),
        } },
        { provide: CardPaymentOrchestratorService, useValue: card },
        { provide: SurveyResultsService, useValue: {} },
        { provide: SondageService, useValue: { listSurveys: () => Promise.resolve([]) } },
      ],
    }).compileComponents();
    TestBed.inject(NgbModalConfig).animation = false;
    fixture = TestBed.createComponent(BilletterieComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    component.eventProduct = product;
    component.reservations = [reservation('one', 'Alice Test'), reservation('two', 'Bruno Test')];
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('opens only on the explicit button and preserves filtered selections on dismissal', async () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('.reservation-row input');
    checkboxes[0].click();
    checkboxes[1].click();
    fixture.detectChanges();
    expect(document.querySelector('ngb-modal-window')).toBeNull();
    component.memberFilter = 'Alice';
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.selection-checkout button').click();
    TestBed.inject(ApplicationRef).tick();
    expect(document.querySelectorAll('.mini-cart-item').length).toBe(2);
    expect(document.querySelector('.checkout-total')?.textContent).toContain('30,00');
    expect(ticketing.createPayment).not.toHaveBeenCalled();
    expect(card.payByCard).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>('.modal-header .btn-close')!.click();
    await fixture.whenStable();
    expect(component.selectedCount).toBe(2);
    expect(component.checkoutOpen).toBeFalse();
    openCheckout();
    document.querySelector<HTMLElement>('ngb-modal-window')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
    expect(component.checkoutOpen).toBeFalse();
    expect(component.selectedCount).toBe(2);
  });

  it('locks dismissal and edits during persistence, then closes after successful recording', async () => {
    let finish!: () => void;
    ticketing.markReservationsSold.and.returnValue(new Promise<void>(resolve => finish = resolve));
    openCheckout();
    const saving = component.validateMiniCart();
    await Promise.resolve();
    TestBed.inject(NgbModal).dismissAll('attempt while saving');
    component.toggleReservationSelection('one');
    component.selectPaymentMode(PaymentMode.CHEQUE);
    expect(component.checkoutOpen).toBeTrue();
    expect(component.selectedCount).toBe(2);
    expect(component.selectedPaymentMode).toBe(PaymentMode.CASH);
    finish();
    await saving;
    await fixture.whenStable();
    expect(component.checkoutOpen).toBeFalse();
    expect(document.querySelector('ngb-modal-window')).toBeNull();
    expect(ticketing.markReservationsSold).toHaveBeenCalledWith(jasmine.objectContaining({
      reservationIds: ['one', 'two'], paymentId: payment.id, paymentMode: 'cash',
    }));
    expect(component.selectedCount).toBe(0);
  });

  it('keeps the dialog and selection on a recording failure and reports the error', async () => {
    ticketing.markReservationsSold.and.rejectWith(new Error('Recording failed'));
    openCheckout();
    await component.validateMiniCart();
    expect(component.checkoutOpen).toBeTrue();
    expect(component.selectedCount).toBe(2);
    expect(component.saleSubmitInProgress).toBeFalse();
    expect(toast.showError).toHaveBeenCalledWith('Billetterie', 'Recording failed');
  });

  it('keeps remote card checkout locked until actual success, not request initiation', async () => {
    openCheckout();
    component.tpeReaderConnected = true;
    component.selectPaymentMode(PaymentMode.CARD);
    await component.validateMiniCart();
    expect(component.checkoutOpen).toBeTrue();
    expect(component.saleSubmitInProgress).toBeTrue();
    expect(ticketing.createPayment).not.toHaveBeenCalled();
    TestBed.inject(NgbModal).dismissAll('attempt during card payment');
    expect(component.checkoutOpen).toBeTrue();
    await card.payByCard.calls.mostRecent().args[1].onSuccess({
      paymentIntentId: 'intent', stripeTag: 'stripe:test',
    });
    await fixture.whenStable();
    expect(component.checkoutOpen).toBeFalse();
    expect(ticketing.createPayment).toHaveBeenCalledWith(jasmine.objectContaining({ paymentMode: 'card' }));
  });

  it('keeps a failed remote payment open for correction without recording a receipt', async () => {
    openCheckout();
    component.tpeReaderConnected = true;
    component.selectPaymentMode(PaymentMode.CARD);
    await component.validateMiniCart();
    card.payByCard.calls.mostRecent().args[1].onFailed('Declined', true);
    expect(component.checkoutOpen).toBeTrue();
    expect(component.saleSubmitInProgress).toBeFalse();
    expect(ticketing.createPayment).not.toHaveBeenCalled();
    expect(toast.showError).toHaveBeenCalledWith('Paiement CB', 'Declined');
  });

  it('renders 150 reservations and receipts in responsive columns without horizontal scrolling', () => {
    fixture.nativeElement.style.width = '1440px';
    component.reservations = Array.from({ length: 150 }, (_, index) =>
      reservation(`reservation-${index}`, `Person ${String(index).padStart(3, '0')}`));
    component.payments = component.reservations.map((row, index) => ({
      ...payment, id: `payment-${index}`, reservationCount: 1, totalAmount: row.price,
    }));
    component.soldReservations = component.reservations.map((row, index) => ({
      ...row, id: `sold-${index}`, reservationStatus: 'sold', paymentId: `payment-${index}`,
    }));
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const columnCount = matchMedia('(max-width: 767.98px)').matches ? 1 : 2;
    for (const selector of ['.reservation-row', '.payment-row']) {
      const rows = root.querySelectorAll<HTMLElement>(selector);
      expect(rows.length).toBe(150);
      const first = rows[0].getBoundingClientRect();
      const last = rows[149].getBoundingClientRect();
      expect(new Set(Array.from(rows, row => Math.round(row.getBoundingClientRect().left))).size).toBe(columnCount);
      if (columnCount === 2) {
        expect(last.left).toBeGreaterThan(first.left);
        expect(Math.abs(rows[75].getBoundingClientRect().top - first.top)).toBeLessThan(2);
      } else {
        expect(last.top).toBeGreaterThan(first.top);
      }
    }
    for (const selector of ['.reservation-list', '.payment-history']) {
      const list = root.querySelector<HTMLElement>(selector)!;
      expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
    }
    component.paymentFilter = 'Person 149';
    fixture.detectChanges();
    expect(root.querySelectorAll('.payment-row').length).toBe(1);
    expect(root.querySelector('.payment-names')?.textContent).toBe('Person 149');
    component.paymentFilter = 'No match';
    fixture.detectChanges();
    expect(root.querySelectorAll('.payment-row').length).toBe(0);
    expect(root.querySelector('.payment-history')?.textContent).toContain('recherche');
  });

  it('removes its open dialog when the page is destroyed', () => {
    openCheckout();
    fixture.destroy();
    expect(document.querySelector('ngb-modal-window')).toBeNull();
  });
});
