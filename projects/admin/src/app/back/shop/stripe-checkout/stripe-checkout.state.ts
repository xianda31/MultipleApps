/**
 * StripeCheckout State Management
 * Centralise l'état du flux Stripe pour éviter les flags dispersés
 */

export type CheckoutPhase = 
  | { phase: 'idle' }
  | { phase: 'redirect_pending'; sessionId: string }
  | { phase: 'saving'; sessionId: string }
  | { phase: 'success'; sessionId: string; receiptUrl?: string }
  | { phase: 'error'; message: string };

export interface StripeCheckoutState {
  checkoutPhase: CheckoutPhase;
  isSaving: boolean;
  error: string | null;
}

export const initialCheckoutState: StripeCheckoutState = {
  checkoutPhase: { phase: 'idle' },
  isSaving: false,
  error: null,
};

/**
 * Actions (dispatched par les composants, gérées par la facade)
 */
export enum StripeCheckoutAction {
  REDIRECT_FROM_STRIPE = 'REDIRECT_FROM_STRIPE',
  COMPLETE_CHECKOUT = 'COMPLETE_CHECKOUT',
  COMPLETION_SUCCESS = 'COMPLETION_SUCCESS',
  COMPLETION_ERROR = 'COMPLETION_ERROR',
  RESET = 'RESET',
}

/**
 * Selectors (calculent l'état visible)
 */
export const checkoutSelectors = {
  isProcessing: (state: StripeCheckoutState) => 
    state.checkoutPhase.phase === 'saving' || state.isSaving,
  
  isSuccess: (state: StripeCheckoutState) => 
    state.checkoutPhase.phase === 'success',
  
  receiptUrl: (state: StripeCheckoutState) => 
    state.checkoutPhase.phase === 'success' ? state.checkoutPhase.receiptUrl : null,
  
  shouldShowSpinner: (state: StripeCheckoutState) =>
    state.checkoutPhase.phase === 'redirect_pending' && !state.isSaving,
  
  shouldShowSuccess: (state: StripeCheckoutState) =>
    state.checkoutPhase.phase === 'success',
  
  hasError: (state: StripeCheckoutState) =>
    state.error !== null || state.checkoutPhase.phase === 'error',
};
