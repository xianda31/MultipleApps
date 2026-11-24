import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { StripeTerminalService, SharedTpeRequest } from './services/stripe-terminal.service';

@Component({
  selector: 'app-shared-tpe-status',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="terminal.sharedTpeEnabled" class="small mt-1" role="status">
      <ng-container *ngIf="terminal.sharedRequest$ | async as request; else noReservation">
        <span *ngIf="request.status === 'available' && showAvailability">{{ connected ? 'TPE disponible' : 'TPE hors ligne' }}</span>
        <span *ngIf="request.status === 'reserved' || request.status === 'pending' || request.status === 'processing'">
          TPE occupé : {{ origin(request) }}.
        </span>
        <span *ngIf="request.status === 'success' || request.status === 'failed' || request.status === 'cancelled'">
          Résultat TPE à vérifier : {{ origin(request) }}.
        </span>
        <button *ngIf="request.status === 'pending'" type="button" class="btn btn-sm btn-outline-secondary ms-2"
          [disabled]="working" (click)="reconcile(true)">Annuler la demande en attente</button>
        <button *ngIf="request.status === 'success' || request.status === 'failed' || request.status === 'cancelled'"
          type="button" class="btn btn-sm btn-outline-secondary ms-2"
          [disabled]="working" (click)="reconcile(false)">Vérifier et libérer</button>
        <span *ngIf="request.status === 'reserved' || request.status === 'processing'">
          Si le paiement ne progresse plus, contactez un responsable.
        </span>
      </ng-container>
      <ng-template #noReservation>
        <span *ngIf="terminal.sharedRequest$.value === undefined">État du TPE non vérifié</span>
        <span *ngIf="terminal.sharedRequest$.value === null && showAvailability">
          {{ connected ? 'TPE disponible' : 'TPE hors ligne' }}
        </span>
        <button *ngIf="terminal.sharedRequest$.value === undefined" type="button"
          class="btn btn-sm btn-outline-secondary ms-2" (click)="terminal.retrySharedTpeObservation()">
          Réessayer
        </button>
      </ng-template>
      <div *ngIf="message" class="text-warning" role="alert">{{ message }}</div>
    </div>
  `,
})
export class SharedTpeStatusComponent {
  @Input() connected = false;
  @Input() showAvailability = true;
  working = false;
  message = '';

  constructor(readonly terminal: StripeTerminalService) {}

  origin(request: SharedTpeRequest): string {
    return request.origin === 'pointage' ? 'pointage'
      : request.origin === 'ticketing' ? 'billetterie' : 'boutique';
  }

  async reconcile(cancelPending: boolean): Promise<void> {
    this.working = true;
    this.message = '';
    try {
      const result = await this.terminal.reconcileSharedTpe(cancelPending);
      this.message = result === 'success'
        ? 'Paiement accepté : vérifiez la vente avant de poursuivre.'
        : 'Demande annulée et TPE libéré.';
    } catch (error) {
      this.message = error instanceof Error ? error.message : 'Vérification TPE impossible.';
    } finally {
      this.working = false;
    }
  }
}
