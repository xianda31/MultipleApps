import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { InputPlayerComponent } from '../ffb/input-licensee/input-player.component';
import { ClubMember } from '../ffb/interface/club-member.interface';
import { PersonV2 } from '../ffb/interface/person-v2.interface';
import { FFB_proxyService } from '../ffb/services/ffb.service';
import { NewMemberFormValue } from '../modals/get-newbee/get-newbee.component';
import { normalizeMemberEmail, requiredMemberEmailValidator } from '../services/member-email.util';

export type AddDirectoryPersonResult =
  | {
    kind: 'ffb';
    player: ClubMember;
    person: PersonV2 | null;
    email: string;
    acceptMailing: boolean;
  }
  | {
    kind: 'manual';
    member: NewMemberFormValue;
  };

@Component({
  selector: 'app-add-directory-person-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputPlayerComponent],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">Ajouter une personne au répertoire</h5>
      <button type="button" class="btn-close" aria-label="Fermer" (click)="cancel()"></button>
    </div>

    <div class="modal-body">
      <div class="btn-group w-100 mb-4" role="group" aria-label="Origine de la personne">
        <button type="button" class="btn"
          [class.btn-primary]="mode === 'ffb'"
          [class.btn-outline-primary]="mode !== 'ffb'"
          (click)="mode = 'ffb'">
          <i class="bi bi-search me-1" aria-hidden="true"></i>Répertoriée à la FFB
        </button>
        <button type="button" class="btn"
          [class.btn-primary]="mode === 'manual'"
          [class.btn-outline-primary]="mode !== 'manual'"
          (click)="mode = 'manual'">
          <i class="bi bi-person-fill-add me-1" aria-hidden="true"></i>Absente de la FFB
        </button>
      </div>

      @if (mode === 'ffb') {
        <div class="mb-3">
          <label class="form-label fw-semibold">Rechercher dans la base FFB</label>
          <app-input-player
            placeholder="Nom ou prénom (sélection dans la liste)"
            [(ngModel)]="ffbPlayer"
            [ngModelOptions]="{ standalone: true }"
            (ngModelChange)="onFfbPlayerChange($event)">
          </app-input-player>
        </div>

        @if (ffbPlayer) {
          <dl class="row small mb-3">
            <dt class="col-sm-4">Licence</dt>
            <dd class="col-sm-8">{{ ffbPlayer.license_number }}</dd>
            <dt class="col-sm-4">Club</dt>
            <dd class="col-sm-8">{{ ffbPlayer.club.label || ffbPlayer.club.name || '—' }}</dd>
            <dt class="col-sm-4">Ville</dt>
            <dd class="col-sm-8">{{ ffbPerson?.city || '—' }}</dd>
          </dl>

          <form [formGroup]="ffbForm">
            <div class="mb-3">
              <label for="directoryFfbEmail" class="form-label">Email</label>
              <input id="directoryFfbEmail" type="email" class="form-control"
                formControlName="email" required>
              <div class="form-text">
                Cette adresse permettra à la personne de créer son compte et d’acheter en ligne.
              </div>
            </div>
            <div class="form-check">
              <input id="directoryFfbAcceptMailing" type="checkbox" class="form-check-input"
                formControlName="acceptMailing">
              <label for="directoryFfbAcceptMailing" class="form-check-label">
                La personne accepte de recevoir les communications du club
              </label>
            </div>
          </form>
        }
      } @else {
        <form [formGroup]="manualForm">
          <div class="mb-3">
            <div class="form-check form-check-inline">
              <input id="directoryMonsieur" class="form-check-input" type="radio"
                value="M" formControlName="gender">
              <label class="form-check-label" for="directoryMonsieur">M.</label>
            </div>
            <div class="form-check form-check-inline">
              <input id="directoryMadame" class="form-check-input" type="radio"
                value="F" formControlName="gender">
              <label class="form-check-label" for="directoryMadame">Mme</label>
            </div>
          </div>
          <div class="row g-3">
            <div class="col-sm-6">
              <label for="directoryFirstname" class="form-label">Prénom</label>
              <input id="directoryFirstname" type="text" class="form-control" formControlName="firstname">
            </div>
            <div class="col-sm-6">
              <label for="directoryLastname" class="form-label">Nom</label>
              <input id="directoryLastname" type="text" class="form-control" formControlName="lastname">
            </div>
            <div class="col-12">
              <label for="directoryEmail" class="form-label">Email</label>
              <input id="directoryEmail" type="email" class="form-control" formControlName="email" required>
              <div class="form-text">
                Cette adresse permettra à la personne de créer son compte et d’acheter en ligne.
              </div>
            </div>
            <div class="col-sm-6">
              <label for="directoryPhone" class="form-label">Téléphone</label>
              <input id="directoryPhone" type="tel" class="form-control" formControlName="phone">
            </div>
            <div class="col-sm-6">
              <label for="directoryCity" class="form-label">Ville</label>
              <input id="directoryCity" type="text" class="form-control" formControlName="city">
            </div>
            <div class="col-12">
              <div class="form-check">
                <input id="directoryAcceptMailing" class="form-check-input" type="checkbox"
                  formControlName="acceptMailing">
                <label class="form-check-label" for="directoryAcceptMailing">
                  La personne accepte de recevoir les communications du club
                </label>
              </div>
            </div>
          </div>
        </form>
      }
    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" (click)="cancel()">Annuler</button>
      <button type="button" class="btn btn-primary" [disabled]="!canConfirm" (click)="confirm()">
        Ajouter au répertoire
      </button>
    </div>
  `,
})
export class AddDirectoryPersonModalComponent {
  mode: 'ffb' | 'manual' = 'ffb';
  ffbPlayer: ClubMember | null = null;
  ffbPerson: PersonV2 | null = null;
  loadingFfbPerson = false;
  private ffbRequestId = 0;

  readonly ffbForm: FormGroup;
  readonly manualForm: FormGroup;

  constructor(
    private readonly activeModal: NgbActiveModal,
    private readonly formBuilder: FormBuilder,
    private readonly ffbService: FFB_proxyService,
  ) {
    this.ffbForm = this.formBuilder.group({
      email: ['', [requiredMemberEmailValidator]],
      acceptMailing: [false],
    });
    this.manualForm = this.formBuilder.group({
      gender: ['', Validators.required],
      firstname: ['', Validators.required],
      lastname: ['', Validators.required],
      email: ['', [requiredMemberEmailValidator]],
      phone: [''],
      city: [''],
      acceptMailing: [false],
    });
  }

  get canConfirm(): boolean {
    return this.mode === 'ffb'
      ? !!this.ffbPlayer && !this.loadingFfbPerson && this.ffbForm.valid
      : this.manualForm.valid;
  }

  async onFfbPlayerChange(player: ClubMember | null): Promise<void> {
    const requestId = ++this.ffbRequestId;
    this.ffbPlayer = player;
    this.ffbPerson = null;
    this.ffbForm.reset({ email: '', acceptMailing: false });
    if (!player) return;

    this.loadingFfbPerson = true;
    try {
      const person = await this.ffbService.getFFBPerson(player.id);
      if (requestId !== this.ffbRequestId) return;
      this.ffbPerson = person;
      this.ffbForm.patchValue({ email: normalizeMemberEmail(person?.email) });
    } catch (error) {
      if (requestId === this.ffbRequestId) {
        console.warn('[AddDirectoryPersonModal] Unable to load FFB person details', error);
      }
    } finally {
      if (requestId === this.ffbRequestId) {
        this.loadingFfbPerson = false;
      }
    }
  }

  confirm(): void {
    if (!this.canConfirm) return;

    if (this.mode === 'ffb' && this.ffbPlayer) {
      const value = this.ffbForm.getRawValue();
      this.activeModal.close({
        kind: 'ffb',
        player: this.ffbPlayer,
        person: this.ffbPerson,
        email: normalizeMemberEmail(value.email),
        acceptMailing: value.acceptMailing ?? false,
      } satisfies AddDirectoryPersonResult);
      return;
    }

    const value = this.manualForm.getRawValue() as NewMemberFormValue;
    this.activeModal.close({
      kind: 'manual',
      member: {
        ...value,
        email: normalizeMemberEmail(value.email),
      },
    } satisfies AddDirectoryPersonResult);
  }

  cancel(): void {
    this.activeModal.close(null);
  }
}
