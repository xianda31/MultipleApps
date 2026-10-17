import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

interface ConfirmationAction {
  label: string;
  buttonClass: string;
  result: boolean;
}

@Component({
  selector: 'app-get-confirmation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">{{ title }}</h5>
    </div>
    <div class="modal-body">
      <p *ngIf="subtitle" class="mb-2">{{ subtitle }}</p>
      <p *ngIf="message" class="mb-0">{{ message }}</p>
    </div>
    <div class="modal-footer">
      <button *ngFor="let action of actions" type="button"
        class="btn" [ngClass]="action.buttonClass" (click)="respond(action.result)">
        {{ action.label }}
      </button>
    </div>
  `
})
export class GetConfirmationComponent {
  @Input() title = 'Confirmation';
  @Input() subtitle = '';
  @Input() message = 'Confirmez-vous cette action ?';
  @Input() confirmLabel = 'Oui';
  @Input() cancelLabel = 'Non';
  @Input() confirmButtonClass = 'btn-primary';
  @Input() cancelButtonClass = 'btn-primary';
  @Input() confirmFirst = true;

  constructor(public activeModal: NgbActiveModal) {}

  get actions(): ConfirmationAction[] {
    const confirm: ConfirmationAction = {
      label: this.confirmLabel,
      buttonClass: this.confirmButtonClass,
      result: true,
    };
    const cancel: ConfirmationAction = {
      label: this.cancelLabel,
      buttonClass: this.cancelButtonClass,
      result: false,
    };
    return this.confirmFirst ? [confirm, cancel] : [cancel, confirm];
  }

  respond(answer: boolean): void {
    this.activeModal.close(answer);
  }
}
