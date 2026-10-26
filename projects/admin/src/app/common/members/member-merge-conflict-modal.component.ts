import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Member } from '../interfaces/member.interface';
import { MemberMergeConflict } from '../services/member-sync.service';

export type MemberMergeDecision =
  | { action: 'merge'; memberId: string }
  | { action: 'create' }
  | { action: 'defer' };

@Component({
  selector: 'app-member-merge-conflict-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">Rapprochement fiche adhérent vs FFB</h5>
    </div>
    <div class="modal-body">
      <p>
        La FFB propose <strong>{{ conflict.clubMember.firstName }} {{ conflict.clubMember.lastName }}</strong>
        (licence {{ conflict.clubMember.license_number }}), mais
        <ng-container *ngIf="conflict.candidates.length === 1; else severalCandidates">
          une fiche adhérent porte déjà les mêmes nom et prénom.
        </ng-container>
        <ng-template #severalCandidates>
          plusieurs fiches adhérent portent déjà les mêmes nom et prénom.
        </ng-template>
      </p>
      <div class="alert alert-warning">
        Vérifiez qu’il s’agit de la même personne. Le nom seul ne permet pas d’exclure une homonymie.
      </div>

      <h6>Données proposées par la FFB</h6>
      <p class="small text-muted">
        Ces informations proviennent directement de la fiche transmise par la FFB.
      </p>
      <dl class="row small mb-3">
        <dt class="col-sm-4">Licence</dt><dd class="col-sm-8">{{ conflict.clubMember.license_number || '—' }}</dd>
        <dt class="col-sm-4">Date de naissance</dt>
        <dd class="col-sm-8">{{ formatBirthdate(conflict.clubMember.birthdate) }}</dd>
        <dt class="col-sm-4">Ville</dt><dd class="col-sm-8">{{ conflict.person?.city || '—' }}</dd>
        <dt class="col-sm-4">Email</dt><dd class="col-sm-8">{{ conflict.person?.email || '—' }}</dd>
        <dt class="col-sm-4">Téléphone</dt><dd class="col-sm-8">{{ conflict.person?.phone || '—' }}</dd>
      </dl>

      <h6>
        {{ conflict.candidates.length === 1
          ? 'Fiche adhérent existante'
          : 'Fiches adhérent existantes' }}
      </h6>
      <p class="small">
        Sélectionnez la fiche adhérent à conserver si vous choisissez de fusionner.
        Elle conservera son identifiant, son historique et ses références.
      </p>
      <label *ngFor="let member of conflict.candidates"
        class="d-block border rounded p-2 mb-2"
        [class.border-primary]="selectedMemberId === member.id">
        <input type="radio" name="memberCandidate" class="form-check-input me-2"
          [value]="member.id" [(ngModel)]="selectedMemberId">
        <strong>{{ member.firstname }} {{ member.lastname }}</strong>
        <span *ngIf="selectedMemberId === member.id" class="badge text-bg-primary ms-2">
          Fiche à conserver
        </span>
        <span class="d-block ms-4 small text-muted">
          Licence {{ member.license_number || '—' }} ·
          {{ member.email || 'sans email' }} ·
          {{ member.phone_one || 'sans téléphone' }} ·
          naissance {{ member.birthdate || 'inconnue' }}
        </span>
      </label>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" (click)="defer()">Reporter</button>
      <button type="button" class="btn btn-outline-primary" (click)="createDistinct()">
        Créer une personne distincte
      </button>
      <button type="button" class="btn btn-primary" [disabled]="!selectedMemberId" (click)="merge()">
        Fusionner et conserver la fiche sélectionnée
      </button>
    </div>
  `,
})
export class MemberMergeConflictModalComponent {
  @Input({ required: true }) conflict!: MemberMergeConflict;
  selectedMemberId = '';

  constructor(public activeModal: NgbActiveModal) {}

  formatBirthdate(value: string | undefined): string {
    if (!value) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
  }

  merge(): void {
    if (!this.selectedMemberId) return;
    this.activeModal.close({ action: 'merge', memberId: this.selectedMemberId } satisfies MemberMergeDecision);
  }

  createDistinct(): void {
    this.activeModal.close({ action: 'create' } satisfies MemberMergeDecision);
  }

  defer(): void {
    this.activeModal.close({ action: 'defer' } satisfies MemberMergeDecision);
  }
}
