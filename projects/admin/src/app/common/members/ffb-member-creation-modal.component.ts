import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ClubMember } from '../ffb/interface/club-member.interface';
import { PersonV2 } from '../ffb/interface/person-v2.interface';
import { normalizeMemberEmail, requiredMemberEmailValidator } from '../services/member-email.util';

export interface FfbMemberCreationDecision {
  email: string;
  acceptMailing: boolean;
}

@Component({
  selector: 'app-ffb-member-creation-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">Ajouter une personne connue de la FFB</h5>
      <button type="button" class="btn-close" aria-label="Fermer" (click)="cancel()"></button>
    </div>
    <div class="modal-body">
      <dl class="row small mb-3">
        <dt class="col-sm-4">Nom</dt>
        <dd class="col-sm-8">{{ clubMember.firstName }} {{ clubMember.lastName }}</dd>
        <dt class="col-sm-4">Licence</dt>
        <dd class="col-sm-8">{{ clubMember.license_number }}</dd>
        <dt class="col-sm-4">Ville</dt>
        <dd class="col-sm-8">{{ person?.city || '—' }}</dd>
      </dl>

      <form [formGroup]="form">
        <div class="mb-3">
          <label for="ffbMemberEmail" class="form-label">Email</label>
          <input id="ffbMemberEmail" type="email" class="form-control" formControlName="email" required>
          <div class="form-text">
            Cette adresse permettra à la personne de créer son compte et d’acheter en ligne.
          </div>
        </div>
        <div class="form-check">
          <input id="ffbMemberAcceptMailing" type="checkbox" class="form-check-input"
            formControlName="acceptMailing">
          <label for="ffbMemberAcceptMailing" class="form-check-label">
            La personne accepte de recevoir les communications du club
          </label>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" (click)="cancel()">Annuler</button>
      <button type="button" class="btn btn-primary" [disabled]="form.invalid" (click)="confirm()">
        Ajouter au répertoire
      </button>
    </div>
  `,
})
export class FfbMemberCreationModalComponent implements OnInit {
  @Input({ required: true }) clubMember!: ClubMember;
  @Input() person: PersonV2 | null = null;

  readonly form: FormGroup;

  constructor(
    private readonly activeModal: NgbActiveModal,
    private readonly formBuilder: FormBuilder,
  ) {
    this.form = this.formBuilder.group({
      email: ['', [requiredMemberEmailValidator]],
      acceptMailing: [false],
    });
  }

  ngOnInit(): void {
    this.form.patchValue({
      email: normalizeMemberEmail(this.person?.email),
    });
  }

  confirm(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.activeModal.close({
      email: normalizeMemberEmail(value.email),
      acceptMailing: value.acceptMailing ?? false,
    } satisfies FfbMemberCreationDecision);
  }

  cancel(): void {
    this.activeModal.close(null);
  }
}
