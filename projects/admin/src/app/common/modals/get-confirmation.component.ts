import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-get-confirmation',
  standalone: true,
  template: `
    <div class="modal-header">
      <h5 class="modal-title">{{ title || 'Confirmation' }}</h5>
    </div>
    <div class="modal-body">
      <p>{{ subtitle || 'Voulez-vous vraiment supprimer ce dossier et tout son contenu ?' }}</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-danger" (click)="confirm()">Supprimer</button>
      <button type="button" class="btn btn-secondary" (click)="cancel()">Annuler</button>
    </div>
  `
})
export class GetConfirmationComponent {
  title?: string;
  subtitle?: string;
  constructor(public activeModal: NgbActiveModal) {}
  confirm() { this.activeModal.close(true); }
  cancel() { this.activeModal.dismiss(false); }
}
