import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Member } from '../interfaces/member.interface';

@Component({
  selector: 'app-manual-member-duplicate-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">Homonymie à confirmer</h5>
    </div>
    <div class="modal-body">
      <p>
        Une ou plusieurs fiches portent déjà les nom et prénom
        <strong>{{ firstName }} {{ lastName }}</strong>.
      </p>
      <div class="alert alert-warning">
        Vérifiez qu’il ne s’agit pas d’une personne déjà enregistrée.
      </div>
      <ul class="list-group">
        <li *ngFor="let member of candidates" class="list-group-item">
          <strong>{{ member.firstname }} {{ member.lastname }}</strong>
          <span class="d-block small text-muted">
            Licence {{ member.license_number || '—' }} ·
            {{ member.email || 'sans email' }} ·
            naissance {{ member.birthdate || 'inconnue' }}
          </span>
        </li>
      </ul>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" (click)="cancel()">Annuler</button>
      <button type="button" class="btn btn-primary" (click)="createDistinct()">
        Créer une personne distincte
      </button>
    </div>
  `,
})
export class ManualMemberDuplicateModalComponent {
  @Input({ required: true }) firstName = '';
  @Input({ required: true }) lastName = '';
  @Input({ required: true }) candidates: Member[] = [];

  constructor(private readonly activeModal: NgbActiveModal) {}

  createDistinct(): void {
    this.activeModal.close(true);
  }

  cancel(): void {
    this.activeModal.close(false);
  }
}
