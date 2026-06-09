import { CardPaymentOrchestratorService } from './card-payment-orchestrator.service';

describe('CardPaymentOrchestratorService', () => {
  const buildService = (isNativeAndroid: boolean) => {
    const stripeTerminal = {
      isNativeAndroid,
      startRemotePayment: jasmine.createSpy('startRemotePayment'),
      createPaymentIntent: jasmine.createSpy('createPaymentIntent'),
      collectAndProcess: jasmine.createSpy('collectAndProcess'),
      cancelRemotePayment: jasmine.createSpy('cancelRemotePayment'),
    } as any;

    const service = new CardPaymentOrchestratorService(stripeTerminal);
    return { service, stripeTerminal };
  };

  const params = {
    amountCents: 1234,
    memberName: 'Test Buyer',
    season: '2025/2026',
    date: '2026-06-08',
    buyerMemberId: 'member-1',
  };

  it('uses remote mode when running outside native Android', async () => {
    const { service, stripeTerminal } = buildService(false);
    const onPaymentIntentCreated = jasmine.createSpy('onPaymentIntentCreated');
    const onSuccess = jasmine.createSpy('onSuccess');

    stripeTerminal.startRemotePayment.and.callFake(async (_p: any, callbacks: any) => {
      callbacks.onPaymentIntentCreated?.('stripe:remote');
      callbacks.onSuccess('pi_remote', 'stripe:remote');
    });

    await service.payByCard(params, {
      onPaymentIntentCreated,
      onSuccess,
      onFailed: jasmine.createSpy('onFailed'),
      onCancelled: jasmine.createSpy('onCancelled'),
      onTimeout: jasmine.createSpy('onTimeout'),
      onError: jasmine.createSpy('onError'),
    });

    expect(service.isRemoteMode).toBeTrue();
    expect(stripeTerminal.startRemotePayment).toHaveBeenCalledWith(params, jasmine.any(Object));
    expect(stripeTerminal.createPaymentIntent).not.toHaveBeenCalled();
    expect(onPaymentIntentCreated).toHaveBeenCalledWith('stripe:remote');
    expect(onSuccess).toHaveBeenCalledWith({ paymentIntentId: 'pi_remote', stripeTag: 'stripe:remote' });
  });

  it('uses local mode and processes payment intent on native Android', async () => {
    const { service, stripeTerminal } = buildService(true);
    const onPaymentIntentCreated = jasmine.createSpy('onPaymentIntentCreated');
    const onSuccess = jasmine.createSpy('onSuccess');

    stripeTerminal.createPaymentIntent.and.resolveTo({
      clientSecret: 'pi_local_secret',
      paymentIntentId: 'pi_local',
      stripeTag: 'stripe:local',
    });
    stripeTerminal.collectAndProcess.and.resolveTo({
      paymentIntentId: 'pi_local',
      stripeTag: 'stripe:local',
    });

    await service.payByCard(params, {
      onPaymentIntentCreated,
      onSuccess,
      onFailed: jasmine.createSpy('onFailed'),
      onCancelled: jasmine.createSpy('onCancelled'),
      onTimeout: jasmine.createSpy('onTimeout'),
      onError: jasmine.createSpy('onError'),
    });

    expect(service.isRemoteMode).toBeFalse();
    expect(stripeTerminal.startRemotePayment).not.toHaveBeenCalled();
    expect(stripeTerminal.createPaymentIntent).toHaveBeenCalledWith(params);
    expect(stripeTerminal.collectAndProcess).toHaveBeenCalledWith('pi_local_secret');
    expect(onPaymentIntentCreated).toHaveBeenCalledWith('stripe:local');
    expect(onSuccess).toHaveBeenCalledWith({ paymentIntentId: 'pi_local', stripeTag: 'stripe:local' });
  });

  it('falls back to created intent identifiers if terminal result is empty', async () => {
    const { service, stripeTerminal } = buildService(true);
    const onSuccess = jasmine.createSpy('onSuccess');

    stripeTerminal.createPaymentIntent.and.resolveTo({
      clientSecret: 'pi_local_secret_2',
      paymentIntentId: 'pi_local_2',
      stripeTag: 'stripe:local_2',
    });
    stripeTerminal.collectAndProcess.and.resolveTo({} as any);

    await service.payByCard(params, {
      onPaymentIntentCreated: jasmine.createSpy('onPaymentIntentCreated'),
      onSuccess,
      onFailed: jasmine.createSpy('onFailed'),
      onCancelled: jasmine.createSpy('onCancelled'),
      onTimeout: jasmine.createSpy('onTimeout'),
      onError: jasmine.createSpy('onError'),
    });

    expect(onSuccess).toHaveBeenCalledWith({ paymentIntentId: 'pi_local_2', stripeTag: 'stripe:local_2' });
  });

  it('propagates local processing errors', async () => {
    const { service, stripeTerminal } = buildService(true);

    stripeTerminal.createPaymentIntent.and.resolveTo({
      clientSecret: 'pi_local_secret_3',
      paymentIntentId: 'pi_local_3',
      stripeTag: 'stripe:local_3',
    });
    stripeTerminal.collectAndProcess.and.rejectWith(new Error('collect failed'));

    await expectAsync(
      service.payByCard(params, {
        onPaymentIntentCreated: jasmine.createSpy('onPaymentIntentCreated'),
        onSuccess: jasmine.createSpy('onSuccess'),
        onFailed: jasmine.createSpy('onFailed'),
        onCancelled: jasmine.createSpy('onCancelled'),
        onTimeout: jasmine.createSpy('onTimeout'),
        onError: jasmine.createSpy('onError'),
      }),
    ).toBeRejectedWithError('collect failed');
  });

  it('delegates remote cancellation to StripeTerminalService', async () => {
    const { service, stripeTerminal } = buildService(false);
    stripeTerminal.cancelRemotePayment.and.resolveTo();

    await service.cancelRemotePayment();

    expect(stripeTerminal.cancelRemotePayment).toHaveBeenCalled();
  });
});
