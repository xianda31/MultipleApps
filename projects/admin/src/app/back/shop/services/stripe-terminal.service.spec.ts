import { StripeTerminalService } from './stripe-terminal.service';
import { TestBed } from '@angular/core/testing';
import { StripeTerminal } from '@capacitor-community/stripe-terminal';
import { AppComponent } from '../../../../../../pptpe/src/app/app.component';
import { NfcTagReaderService } from '../../../../../../pptpe/src/app/nfc/nfc-tag-reader.service';
import { AcrBleReaderService } from '../../../../../../pptpe/src/app/nfc/acr-ble-reader.service';
import { NfcRelayService } from '../../../../../../pptpe/src/app/nfc/nfc-relay.service';
import { SHARED_TPE_REQUEST_ID } from '../../../../../../common/tpe-shared';
import { environment as ppTpeEnvironment } from '../../../../../../pptpe/src/environments/environment';
import { environment as ppTpeDevelopmentEnvironment } from '../../../../../../pptpe/src/environments/environment.development';
import { environment as adminProductionEnvironment } from '../../../../environments/environment.production';
import { Subject } from 'rxjs';

describe('StripeTerminalService', () => {
  it('cancels the PaymentIntent and deletes the pending BookEntry', async () => {
    const service = new StripeTerminalService();
    spyOnProperty(service, 'sharedTpeEnabled').and.returnValue(true);
    spyOn(service, 'cancelPaymentIntent').and.resolveTo();
    const deleteBookEntry = spyOn<any>(service, 'deletePendingBookEntry').and.resolveTo();
    const client = {};

    const result = await (service as any)._cleanupFailedPayment(
      client,
      'payment-intent-1',
      'book-entry-1',
    );

    expect(service.cancelPaymentIntent).toHaveBeenCalledOnceWith('payment-intent-1');
    expect(deleteBookEntry).toHaveBeenCalledOnceWith('book-entry-1', 'payment-intent-1');
    expect(result).toBeTrue();
  });

  describe('ppTPE request claim', () => {
    it('does not collect a cancelled request and serializes simultaneous deliveries', async () => {
      TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [
          { provide: NfcTagReaderService, useValue: { stop() {} } },
          { provide: AcrBleReaderService, useValue: { stop() {} } },
          { provide: NfcRelayService, useValue: { detach() {} } },
        ],
      });
      const fixture = TestBed.createComponent(AppComponent);
      const app = fixture.componentInstance as any;
      app.state = 'connected';
      spyOn(app.cdr, 'detectChanges');
      let finish!: (value: any) => void;
      const update = jasmine.createSpy().and.returnValue(new Promise(resolve => { finish = resolve; }));
      app.client = { models: { PaymentRequest: { update } } };
      const collect = spyOn(StripeTerminal, 'collectPaymentMethod');

      const first = app.handlePaymentRequest({ id: SHARED_TPE_REQUEST_ID, reservationId: 'one', clientSecret: 'secret' });
      await app.handlePaymentRequest({ id: SHARED_TPE_REQUEST_ID, reservationId: 'two', clientSecret: 'other' });
      expect(update).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(
        { id: SHARED_TPE_REQUEST_ID, status: 'processing' },
        { condition: { and: [{ status: { eq: 'pending' } }, { reservationId: { eq: 'one' } }] } },
      );
      finish({ errors: [{ message: 'condition failed' }] });
      await first;
      expect(collect).not.toHaveBeenCalled();
      fixture.destroy();
    });

    it('does not report failure when publishing an accepted payment fails', async () => {
      TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [
          { provide: NfcTagReaderService, useValue: { stop() {} } },
          { provide: AcrBleReaderService, useValue: { stop() {} } },
          { provide: NfcRelayService, useValue: { detach() {} } },
        ],
      });
      const fixture = TestBed.createComponent(AppComponent);
      const app = fixture.componentInstance as any;
      app.state = 'connected';
      spyOn(app.cdr, 'detectChanges');
      spyOn(app, 'collectAndConfirmPayment').and.resolveTo();
      spyOn(console, 'warn');
      spyOn(console, 'error');
      const update = jasmine.createSpy('update').and.returnValues(
        Promise.resolve({ data: { id: SHARED_TPE_REQUEST_ID } }),
        Promise.reject(new Error('network')),
      );
      app.client = { models: { PaymentRequest: { update } } };

      await app.handlePaymentRequest({ id: SHARED_TPE_REQUEST_ID, reservationId: 'one', clientSecret: 'secret' });

      expect(update).toHaveBeenCalledTimes(2);
      expect(update.calls.mostRecent().args[0]).toEqual({ id: SHARED_TPE_REQUEST_ID, status: 'success' });
      fixture.destroy();
    });

    it('accepts a legacy shop request when ppTPE uses classic mode', () => {
      TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [
          { provide: NfcTagReaderService, useValue: { stop() {} } },
          { provide: AcrBleReaderService, useValue: { stop() {} } },
          { provide: NfcRelayService, useValue: { detach() {} } },
        ],
      });
      const fixture = TestBed.createComponent(AppComponent);
      const app = fixture.componentInstance as any;
      const previous = ppTpeEnvironment.tpe_shared_enabled;
      ppTpeEnvironment.tpe_shared_enabled = false;
      try {
        app.state = 'connected';
        const handle = spyOn(app, 'handlePaymentRequest').and.resolveTo();
        const request = { id: 'legacy', status: 'pending' };
        app.latestPaymentRequests = [request];

        app.processNextPaymentRequest();

        expect(handle).toHaveBeenCalledOnceWith(request);
      } finally {
        ppTpeEnvironment.tpe_shared_enabled = previous;
        fixture.destroy();
      }
    });

    it('accepts the shared request with the ppTPE development configuration', () => {
      TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [
          { provide: NfcTagReaderService, useValue: { stop() {} } },
          { provide: AcrBleReaderService, useValue: { stop() {} } },
          { provide: NfcRelayService, useValue: { detach() {} } },
        ],
      });
      const fixture = TestBed.createComponent(AppComponent);
      const app = fixture.componentInstance as any;
      const previous = ppTpeEnvironment.tpe_shared_enabled;
      ppTpeEnvironment.tpe_shared_enabled = ppTpeDevelopmentEnvironment.tpe_shared_enabled;
      try {
        app.state = 'connected';
        const handle = spyOn(app, 'handlePaymentRequest').and.resolveTo();
        const request = { id: SHARED_TPE_REQUEST_ID, status: 'pending', reservationId: 'test' };
        app.latestPaymentRequests = [{ id: 'legacy', status: 'pending' }, request];

        app.processNextPaymentRequest();

        expect(handle).toHaveBeenCalledOnceWith(request);
      } finally {
        ppTpeEnvironment.tpe_shared_enabled = previous;
        fixture.destroy();
      }
    });

    it('accepts shared requests with aligned admin and ppTPE production configuration', () => {
      TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [
          { provide: NfcTagReaderService, useValue: { stop() {} } },
          { provide: AcrBleReaderService, useValue: { stop() {} } },
          { provide: NfcRelayService, useValue: { detach() {} } },
        ],
      });
      const fixture = TestBed.createComponent(AppComponent);
      const app = fixture.componentInstance as any;
      app.state = 'connected';
      const handle = spyOn(app, 'handlePaymentRequest').and.resolveTo();
      const request = { id: SHARED_TPE_REQUEST_ID, status: 'pending', reservationId: 'test' };
      app.latestPaymentRequests = [{ id: 'legacy', status: 'pending' }, request];

      expect(adminProductionEnvironment.quick_sale_tpe_enabled).toBeTrue();
      expect(adminProductionEnvironment.tpe_shared_enabled).toBe(ppTpeEnvironment.tpe_shared_enabled);
      app.processNextPaymentRequest();
      expect(handle).toHaveBeenCalledOnceWith(request);
      fixture.destroy();
    });

    it('only claims the current shared reservation, including after the slot is reused', async () => {
      TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [
          { provide: NfcTagReaderService, useValue: { stop() {} } },
          { provide: AcrBleReaderService, useValue: { stop() {} } },
          { provide: NfcRelayService, useValue: { detach() {} } },
        ],
      });
      const fixture = TestBed.createComponent(AppComponent);
      const app = fixture.componentInstance as any;
      const previous = ppTpeEnvironment.tpe_shared_enabled;
      ppTpeEnvironment.tpe_shared_enabled = true;
      try {
        app.state = 'connected';
        const handle = spyOn(app, 'handlePaymentRequest').and.resolveTo();
        app.latestPaymentRequests = [
          { id: 'legacy', status: 'pending' },
          { id: SHARED_TPE_REQUEST_ID, status: 'pending', reservationId: 'one' },
        ];
        app.processNextPaymentRequest();
        expect(handle).toHaveBeenCalledOnceWith(jasmine.objectContaining({ reservationId: 'one' }));
        app.processedPaymentIds.add(`${SHARED_TPE_REQUEST_ID}:one`);
        app.latestPaymentRequests[1] = { id: SHARED_TPE_REQUEST_ID, status: 'pending', reservationId: 'two' };
        app.processNextPaymentRequest();
        expect(handle.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ reservationId: 'two' }));
      } finally {
        ppTpeEnvironment.tpe_shared_enabled = previous;
        fixture.destroy();
      }
    });
  });

  it('does not delete the BookEntry when PaymentIntent cancellation fails', async () => {
    const service = new StripeTerminalService();
    spyOnProperty(service, 'sharedTpeEnabled').and.returnValue(true);
    spyOn(service, 'cancelPaymentIntent').and.rejectWith(new Error('Stripe unavailable'));
    const deleteBookEntry = spyOn<any>(service, 'deletePendingBookEntry');
    const client = {};
    spyOn(console, 'error');

    const result = await (service as any)._cleanupFailedPayment(
      client,
      'payment-intent-1',
      'book-entry-1',
    );

    expect(deleteBookEntry).not.toHaveBeenCalled();
    expect(result).toBeFalse();
  });

  it('still cancels the intent and deletes the entry through AppSync in legacy mode', async () => {
    const service = new StripeTerminalService();
    spyOnProperty(service, 'sharedTpeEnabled').and.returnValue(false);
    spyOn(service, 'cancelPaymentIntent').and.resolveTo();
    const remove = jasmine.createSpy().and.resolveTo({ data: { id: 'entry' } });
    const client = { models: { BookEntry: { delete: remove } } };
    expect(await (service as any)._cleanupFailedPayment(client, 'pi_1', 'entry')).toBeTrue();
    expect(service.cancelPaymentIntent).toHaveBeenCalledOnceWith('pi_1');
    expect(remove).toHaveBeenCalledOnceWith({ id: 'entry' });
  });

  it('clears every identifier when a remote payment finishes', () => {
    const service = new StripeTerminalService();
    (service as any)._pendingPaymentRequestId = 'request-1';
    (service as any)._pendingPaymentIntentId = 'intent-1';
    (service as any)._pendingBookEntryId = 'book-entry-1';

    (service as any)._cleanupPaymentSub();

    expect((service as any)._pendingPaymentRequestId).toBeNull();
    expect((service as any)._pendingPaymentIntentId).toBeNull();
    expect((service as any)._pendingBookEntryId).toBeNull();
  });

  it('does not treat an already processed intent as a confirmed cancellation', () => {
    const service = new StripeTerminalService() as any;
    expect(() => service._assertCancellationConfirmed('canceled')).not.toThrow();
    expect(() => service._assertCancellationConfirmed('already_processed')).toThrow();
    expect(() => service._assertCancellationConfirmed(undefined)).toThrow();
  });

  it('only cancels a request that is still pending', async () => {
    const service = new StripeTerminalService() as any;
    const update = jasmine.createSpy().and.resolveTo({ errors: [{ message: 'condition failed' }] });
    await expectAsync(service._cancelPendingRequest({ models: { PaymentRequest: { update } } }, 'r1'))
      .toBeRejected();
    expect(update).toHaveBeenCalledOnceWith(
      { id: 'r1', status: 'cancelled' },
      { condition: { status: { eq: 'pending' } } },
    );
  });

  it('reports an uncertain PaymentIntent creation without throwing to legacy cleanup callers', async () => {
    const service = new StripeTerminalService();
    spyOn(service, 'createPaymentIntent').and.rejectWith(new Error('network'));
    const callbacks = {
      onSuccess: jasmine.createSpy(), onFailed: jasmine.createSpy(),
      onCancelled: jasmine.createSpy(), onTimeout: jasmine.createSpy(), onError: jasmine.createSpy(),
    };
    await service.startRemotePayment({
      amountCents: 100, memberName: 'Test', season: '2026', date: '2026-01-01', bookEntryId: 'entry',
    }, callbacks);
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(service.remotePaymentUncertainty?.bookEntryId).toBe('entry');
    await expectAsync(service.cancelRemotePayment()).toBeRejected();
  });

  it('retains the request id and accounting entry when request creation times out', async () => {
    const service = new StripeTerminalService();
    spyOn(service, 'createPaymentIntent').and.resolveTo({
      clientSecret: 'pi_secret', paymentIntentId: 'pi_1', stripeTag: 'stripe:1',
    });
    const create = jasmine.createSpy().and.rejectWith(new Error('network'));
    spyOn<any>(service, '_createRemoteClient').and.returnValue({
      models: { PaymentRequest: { create } },
    });
    const callbacks = {
      onSuccess: jasmine.createSpy(), onFailed: jasmine.createSpy(),
      onCancelled: jasmine.createSpy(), onTimeout: jasmine.createSpy(), onError: jasmine.createSpy(),
    };
    await service.startRemotePayment({
      amountCents: 100, memberName: 'Test', season: '2026', date: '2026-01-01', bookEntryId: 'entry',
    }, callbacks);
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(service.remotePaymentUncertainty).toEqual(jasmine.objectContaining({
      paymentRequestId: create.calls.mostRecent().args[0].id,
      paymentIntentId: 'pi_1',
      bookEntryId: 'entry',
    }));
    await expectAsync(service.cancelRemotePayment()).toBeRejected();
  });

  it('reserves the shared TPE before creating an intent and rejects a competing post', async () => {
    const first = new StripeTerminalService();
    const second = new StripeTerminalService();
    spyOnProperty(first, 'sharedTpeEnabled').and.returnValue(true);
    spyOnProperty(second, 'sharedTpeEnabled').and.returnValue(true);
    const conflict = { errors: [{ errorType: 'DynamoDB:ConditionalCheckFailedException' }] };
    let reserved = false;
    const create = jasmine.createSpy().and.callFake(async (request: any) => {
      if (reserved) return conflict;
      reserved = true;
      return { data: request };
    });
    const update = jasmine.createSpy().and.resolveTo(conflict);
    const client = { models: { PaymentRequest: { create, update } } };
    spyOn<any>(first, '_createRemoteClient').and.returnValue(client);
    spyOn<any>(second, '_createRemoteClient').and.returnValue(client);
    spyOn<any>(second, '_cleanupFailedPayment').and.resolveTo(true);
    let rejectIntent!: (error: Error) => void;
    spyOn(first, 'createPaymentIntent').and.returnValue(new Promise((_resolve, reject) => rejectIntent = reject));
    const competingIntent = spyOn(second, 'createPaymentIntent');
    const callbacks = () => ({
      onSuccess: jasmine.createSpy(), onFailed: jasmine.createSpy(),
      onCancelled: jasmine.createSpy(), onTimeout: jasmine.createSpy(), onError: jasmine.createSpy(),
    });
    const firstCallbacks = callbacks();
    const secondCallbacks = callbacks();
    const params = { amountCents: 100, memberName: 'Test', season: '2026', date: '2026-01-01', bookEntryId: 'entry' };

    const inFlight = first.startRemotePayment(params, firstCallbacks);
    await Promise.resolve();
    await second.startRemotePayment(params, secondCallbacks);
    expect(competingIntent).not.toHaveBeenCalled();
    expect(secondCallbacks.onFailed).toHaveBeenCalledOnceWith('TPE déjà utilisé par un autre poste.', true);
    expect(update).toHaveBeenCalledWith(
      jasmine.objectContaining({ id: SHARED_TPE_REQUEST_ID }),
      { condition: { status: { eq: 'available' } } },
    );
    rejectIntent(new Error('network'));
    await inFlight;
    expect(firstCallbacks.onError).toHaveBeenCalled();
    expect(first.remotePaymentUncertainty?.bookEntryId).toBe('entry');
  });

  it('releases the reserved slot after a confirmed payment, once only', async () => {
    const service = new StripeTerminalService();
    spyOnProperty(service, 'sharedTpeEnabled').and.returnValue(true);
    const updates = new Subject<{ items: any[] }>();
    const results = new Subject<{ items: any[] }>();
    let reservationId = '';
    const create = jasmine.createSpy().and.callFake(async (record: any) => {
      reservationId = record.reservationId;
      return { data: record };
    });
    const update = jasmine.createSpy().and.callFake(async (record: any) => ({ data: record }));
    const get = jasmine.createSpy().and.callFake(async () => ({
      data: { id: SHARED_TPE_REQUEST_ID, reservationId, status: 'success',
        paymentIntentId: 'pi_1', bookEntryId: 'entry', origin: 'shop' },
    }));
    const archive = jasmine.createSpy().and.callFake(async (record: any) => ({ data: record }));
    spyOn<any>(service, '_createRemoteClient').and.returnValue({
      models: {
        PaymentRequest: { create, update, get, observeQuery: () => updates },
        TPEPaymentResult: { create: archive, observeQuery: () => results },
      },
    });
    spyOn(service, 'createPaymentIntent').and.resolveTo({
      clientSecret: 'secret', paymentIntentId: 'pi_1', stripeTag: 'stripe:1',
    });
    const callbacks = {
      onSuccess: jasmine.createSpy(), onFailed: jasmine.createSpy(),
      onCancelled: jasmine.createSpy(), onTimeout: jasmine.createSpy(), onError: jasmine.createSpy(),
    };
    const params = { amountCents: 100, memberName: 'Test', season: '2026', date: '2026-01-01' };
    const token = await service.reserveForSale(params);
    await service.startRemotePayment({ ...params, reservationId: token!, bookEntryId: 'entry' }, callbacks);
    updates.next({ items: [{ id: SHARED_TPE_REQUEST_ID, reservationId, status: 'success' }] });
    updates.next({ items: [{ id: SHARED_TPE_REQUEST_ID, reservationId, status: 'success' }] });
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    expect(callbacks.onSuccess).toHaveBeenCalledOnceWith('pi_1', 'stripe:1');
    expect(update.calls.mostRecent().args).toEqual([
      jasmine.objectContaining({ id: SHARED_TPE_REQUEST_ID, status: 'available' }),
      { condition: { and: [{ reservationId: { eq: reservationId } }, { status: { eq: 'success' } }] } },
    ]);
  });

  it('recovers the original post from the archived result if another post released the slot', async () => {
    const service = new StripeTerminalService();
    spyOnProperty(service, 'sharedTpeEnabled').and.returnValue(true);
    const updates = new Subject<{ items: any[] }>();
    const results = new Subject<{ items: any[] }>();
    const create = jasmine.createSpy().and.callFake(async (record: any) => ({ data: record }));
    const update = jasmine.createSpy().and.callFake(async (record: any) => ({ data: record }));
    spyOn<any>(service, '_createRemoteClient').and.returnValue({
      models: {
        PaymentRequest: { create, update, observeQuery: () => updates },
        TPEPaymentResult: { observeQuery: () => results },
      },
    });
    spyOn(service, 'createPaymentIntent').and.resolveTo({
      clientSecret: 'secret', paymentIntentId: 'pi_1', stripeTag: 'stripe:1',
    });
    const callbacks = {
      onSuccess: jasmine.createSpy(), onFailed: jasmine.createSpy(),
      onCancelled: jasmine.createSpy(), onTimeout: jasmine.createSpy(), onError: jasmine.createSpy(),
    };
    const params = { amountCents: 100, memberName: 'Test', season: '2026', date: '2026-01-01' };
    const reservationId = await service.reserveForSale(params);
    await service.startRemotePayment({ ...params, reservationId: reservationId!, bookEntryId: 'entry' }, callbacks);
    results.next({ items: [{ id: reservationId, status: 'success', paymentIntentId: 'pi_1' }] });
    results.next({ items: [{ id: reservationId, status: 'success', paymentIntentId: 'pi_1' }] });
    expect(callbacks.onSuccess).toHaveBeenCalledOnceWith('pi_1', 'stripe:1');
  });

  it('does not release an in-flight payment during recovery', async () => {
    const service = new StripeTerminalService();
    spyOnProperty(service, 'sharedTpeEnabled').and.returnValue(true);
    const get = jasmine.createSpy().and.resolveTo({
      data: { id: SHARED_TPE_REQUEST_ID, reservationId: 'owner', status: 'processing', paymentIntentId: 'pi_1' },
    });
    const update = jasmine.createSpy();
    spyOn<any>(service, '_createRemoteClient').and.returnValue({ models: { PaymentRequest: { get, update } } });
    await expectAsync(service.reconcileSharedTpe()).toBeRejected();
    expect(update).not.toHaveBeenCalled();
  });

  it('does not cancel Stripe when the pending request was claimed concurrently', async () => {
    const service = new StripeTerminalService();
    spyOnProperty(service, 'sharedTpeEnabled').and.returnValue(true);
    const get = jasmine.createSpy().and.resolveTo({
      data: { id: SHARED_TPE_REQUEST_ID, reservationId: 'owner', status: 'pending', paymentIntentId: 'pi_1' },
    });
    const update = jasmine.createSpy().and.resolveTo({ errors: [{ errorType: 'DynamoDB:ConditionalCheckFailedException' }] });
    spyOn<any>(service, '_createRemoteClient').and.returnValue({ models: { PaymentRequest: { get, update } } });
    const cancelIntent = spyOn(service, 'cancelPaymentIntent');
    await expectAsync(service.reconcileSharedTpe(true)).toBeRejected();
    expect(cancelIntent).not.toHaveBeenCalled();
  });

  it('does not release a failed payment when Stripe cancellation is unconfirmed', async () => {
    const service = new StripeTerminalService();
    spyOnProperty(service, 'sharedTpeEnabled').and.returnValue(true);
    const get = jasmine.createSpy().and.resolveTo({
      data: { id: SHARED_TPE_REQUEST_ID, reservationId: 'owner', status: 'failed', paymentIntentId: 'pi_1' },
    });
    const update = jasmine.createSpy();
    spyOn<any>(service, '_createRemoteClient').and.returnValue({ models: { PaymentRequest: { get, update } } });
    spyOn(service, 'cancelPaymentIntent').and.rejectWith(new Error('network'));
    spyOn(console, 'error');
    await expectAsync(service.reconcileSharedTpe()).toBeRejected();
    expect(update).not.toHaveBeenCalled();
  });

  it('releases a recovered success only if its reservation and outcome still match', async () => {
    const service = new StripeTerminalService();
    spyOnProperty(service, 'sharedTpeEnabled').and.returnValue(true);
    const get = jasmine.createSpy().and.resolveTo({
      data: { id: SHARED_TPE_REQUEST_ID, reservationId: 'owner', status: 'success', paymentIntentId: 'pi_1' },
    });
    const update = jasmine.createSpy().and.resolveTo({ data: { id: SHARED_TPE_REQUEST_ID } });
    const archive = jasmine.createSpy().and.callFake(async (record: any) => ({ data: record }));
    spyOn<any>(service, '_createRemoteClient').and.returnValue({
      models: { PaymentRequest: { get, update }, TPEPaymentResult: { create: archive } },
    });
    expect(await service.reconcileSharedTpe()).toBe('success');
    expect(update).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ id: SHARED_TPE_REQUEST_ID, status: 'available' }),
      { condition: { and: [{ reservationId: { eq: 'owner' } }, { status: { eq: 'success' } }] } },
    );
  });
});