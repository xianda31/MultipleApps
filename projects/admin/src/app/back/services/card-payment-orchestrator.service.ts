import { Injectable } from '@angular/core';

import {
  StripeTerminalService,
  TerminalPaymentResult,
} from '../shop/services/stripe-terminal.service';

export interface CardPaymentParams {
  amountCents: number;
  memberName: string;
  season: string;
  date: string;
  buyerMemberId?: string;
}

export interface CardPaymentCallbacks {
  onPaymentIntentCreated?: (stripeTag: string) => void;
  onSuccess: (result: TerminalPaymentResult) => void | Promise<void>;
  onFailed: (message: string) => void;
  onCancelled: () => void;
  onTimeout: () => void;
  onError: () => void;
}

/**
 * Orchestrateur partagé du paiement carte présentiel.
 * Centralise le switch distant (AppSync/ppTPE) vs local (SDK BLE Android).
 */
@Injectable({ providedIn: 'root' })
export class CardPaymentOrchestratorService {
  constructor(private stripeTerminal: StripeTerminalService) {}

  get isRemoteMode(): boolean {
    return !this.stripeTerminal.isNativeAndroid;
  }

  async payByCard(
    params: CardPaymentParams,
    callbacks: CardPaymentCallbacks,
  ): Promise<void> {
    if (this.isRemoteMode) {
      await this.stripeTerminal.startRemotePayment(
        params,
        {
          onPaymentIntentCreated: callbacks.onPaymentIntentCreated,
          onSuccess: (paymentIntentId, stripeTag) => {
            void Promise.resolve(callbacks.onSuccess({ paymentIntentId, stripeTag }));
          },
          onFailed: callbacks.onFailed,
          onCancelled: callbacks.onCancelled,
          onTimeout: callbacks.onTimeout,
          onError: callbacks.onError,
        },
      );
      return;
    }

    const { clientSecret, paymentIntentId, stripeTag } = await this.stripeTerminal.createPaymentIntent(params);
    callbacks.onPaymentIntentCreated?.(stripeTag);

    const result = await this.stripeTerminal.collectAndProcess(clientSecret);
    await Promise.resolve(
      callbacks.onSuccess({
        paymentIntentId: result.paymentIntentId || paymentIntentId,
        stripeTag: result.stripeTag || stripeTag,
      }),
    );
  }

  async cancelRemotePayment(): Promise<void> {
    await this.stripeTerminal.cancelRemotePayment();
  }
}