import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Member } from '../interfaces/member.interface';
import { MemberNfcCard, MemberNfcCardService } from '../services/member-nfc-card.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-member-nfc-cards-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">Cartes NFC — {{ member.firstname }} {{ member.lastname }}</h5>
      <button type="button" class="btn-close" aria-label="Fermer" [disabled]="saving" (click)="close()"></button>
    </div>
    <div class="modal-body">
      <p>Licence <strong>{{ member.license_number }}</strong></p>
      <div *ngIf="error" class="alert alert-danger" role="alert">{{ error }}</div>
      <p *ngIf="loading" role="status">Chargement des cartes…</p>
      <div *ngIf="!loaded && !loading" class="mb-3">
        <button type="button" class="btn btn-outline-secondary" (click)="load()">Réessayer</button>
      </div>
      <ng-container *ngIf="loaded">
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead><tr><th>UID</th><th>Statut</th><th>Attribution</th><th>Action</th></tr></thead>
            <tbody>
              <tr *ngFor="let card of cards">
                <td><code>{{ card.uid }}</code></td>
                <td>{{ card.status === 'ACTIVE' ? 'Active' : 'Désactivée' }}</td>
                <td>{{ card.assignedAt | date:'dd/MM/yyyy HH:mm' }}</td>
                <td>
                  <button *ngIf="card.status === 'ACTIVE'" type="button" class="btn btn-sm btn-outline-danger"
                    [disabled]="busy" (click)="deactivate(card)">Désactiver</button>
                  <button *ngIf="card.status === 'DISABLED' && member.lifecycleStatus === 'ACTIVE'"
                    type="button" class="btn btn-sm btn-outline-success"
                    [disabled]="busy" (click)="reactivate(card)">Réactiver</button>
                </td>
              </tr>
              <tr *ngIf="cards.length === 0"><td colspan="4">Aucune carte attribuée.</td></tr>
            </tbody>
          </table>
        </div>
        <div *ngIf="member.lifecycleStatus !== 'ACTIVE'" class="alert alert-warning">
          L’attribution et la réactivation sont réservées aux adhérents actifs.
        </div>
        <ng-container *ngIf="member.lifecycleStatus === 'ACTIVE'">
          <p class="small text-muted">
            ppNFC doit être lancé sur ce PC. Aucun pointage ni enregistrement automatique :
            vous confirmerez l’association après la lecture.
          </p>
          <button type="button" class="btn btn-primary" [disabled]="busy" (click)="acquire()">
            Lire une carte avec ppNFC
          </button>
          <div *ngIf="acquiring" class="alert alert-info mt-3" role="status" aria-live="polite">
            Présentez une carte au lecteur (30 secondes maximum).
            Si elle est déjà posée, retirez-la puis représentez-la.
            <button type="button" class="btn btn-sm btn-outline-secondary ms-2"
              (click)="cancelAcquisition()">Annuler la lecture</button>
          </div>
          <div *ngIf="scannedUid" class="border rounded p-3 mt-3">
            <p>UID lu : <code>{{ scannedUid }}</code></p>
            <p *ngIf="!existingCard">Cette carte n’est pas encore attribuée.</p>
            <p *ngIf="existingCard">
              Carte {{ existingCard.status === 'ACTIVE' ? 'active' : 'désactivée' }},
              attribuée à <strong>{{ ownerName(existingCard.licenseNumber) }}</strong>
              (licence {{ existingCard.licenseNumber }}).
            </p>
            <div *ngIf="transferBlocked" class="alert alert-warning">
              Désactivez d’abord cette carte depuis la fiche de son titulaire avant de la réattribuer.
            </div>
            <button type="button" class="btn btn-success"
              [disabled]="busy || transferBlocked || alreadyAssigned" (click)="assign()">
              {{ existingCard ? 'Confirmer la réactivation / réattribution' : 'Confirmer l’attribution' }}
            </button>
            <span *ngIf="alreadyAssigned" class="ms-2">Déjà active pour cet adhérent.</span>
          </div>
        </ng-container>
      </ng-container>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" [disabled]="saving" (click)="close()">Fermer</button>
    </div>
  `,
})
export class MemberNfcCardsModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) member!: Member;
  @Input() members: Member[] = [];
  cards: MemberNfcCard[] = [];
  loading = false;
  loaded = false;
  saving = false;
  acquiring = false;
  scannedUid = '';
  existingCard: MemberNfcCard | null = null;
  error = '';
  private acquisition?: AbortController;
  private destroyed = false;

  constructor(
    private readonly activeModal: NgbActiveModal,
    private readonly nfc: MemberNfcCardService,
    private readonly toast: ToastService,
  ) {}

  get busy(): boolean { return this.loading || this.saving || this.acquiring; }
  get transferBlocked(): boolean {
    return !!this.existingCard && this.existingCard.licenseNumber !== this.member.license_number
      && this.existingCard.status !== 'DISABLED';
  }
  get alreadyAssigned(): boolean {
    return this.existingCard?.licenseNumber === this.member.license_number && this.existingCard.status === 'ACTIVE';
  }

  ngOnInit(): void { void this.load(); }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.cancelAcquisition();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loaded = false;
    this.error = '';
    try {
      this.cards = await this.nfc.list(this.member.license_number);
      this.loaded = true;
    } catch (error) {
      this.report(error);
    } finally {
      this.loading = false;
    }
  }

  async acquire(): Promise<void> {
    if (this.busy || !this.loaded || this.member.lifecycleStatus !== 'ACTIVE') return;
    this.scannedUid = '';
    this.existingCard = null;
    this.error = '';
    this.acquiring = true;
    const acquisition = new AbortController();
    this.acquisition = acquisition;
    const timeout = window.setTimeout(() => acquisition.abort('timeout'), 35000);
    try {
      const uid = await this.nfc.acquire(acquisition.signal);
      if (acquisition.signal.aborted || this.destroyed) return;
      const existing = await this.nfc.get(uid);
      if (acquisition.signal.aborted || this.destroyed) return;
      this.existingCard = existing;
      this.scannedUid = uid;
    } catch (error) {
      if (!acquisition.signal.aborted) this.report(error);
      else if (acquisition.signal.reason === 'timeout') this.report(new Error('La lecture ppNFC a expiré. Réessayez.'));
    } finally {
      window.clearTimeout(timeout);
      if (this.acquisition === acquisition) {
        this.acquiring = false;
        this.acquisition = undefined;
      }
    }
  }

  cancelAcquisition(): void {
    this.acquisition?.abort();
  }

  async assign(): Promise<void> {
    if (this.busy || !this.scannedUid || this.transferBlocked || this.alreadyAssigned) return;
    const previous = this.existingCard;
    const message = previous && previous.licenseNumber !== this.member.license_number
      ? `Réattribuer la carte ${this.scannedUid} de ${this.ownerName(previous.licenseNumber)} à ${this.member.firstname} ${this.member.lastname} ?`
      : `Activer la carte ${this.scannedUid} pour ${this.member.firstname} ${this.member.lastname} ?`;
    if (!window.confirm(message)) return;
    await this.save(() => this.nfc.assign(this.scannedUid, this.member, previous));
  }

  async deactivate(card: MemberNfcCard): Promise<void> {
    if (this.busy || card.status !== 'ACTIVE') return;
    if (!window.confirm(`Désactiver la carte ${card.uid} ? Son association sera conservée.`)) return;
    await this.save(() => this.nfc.deactivate(card));
  }

  async reactivate(card: MemberNfcCard): Promise<void> {
    if (this.busy || card.status !== 'DISABLED' || this.member.lifecycleStatus !== 'ACTIVE') return;
    if (!window.confirm(`Réactiver la carte ${card.uid} pour cet adhérent ?`)) return;
    await this.save(() => this.nfc.assign(card.uid, this.member, card));
  }

  ownerName(licenseNumber: string): string {
    const owner = this.members.find(member => member.license_number === licenseNumber);
    return owner ? `${owner.firstname} ${owner.lastname}` : 'titulaire absent du répertoire';
  }

  close(): void {
    if (this.saving) return;
    this.cancelAcquisition();
    this.activeModal.close();
  }

  private async save(operation: () => Promise<MemberNfcCard>): Promise<void> {
    this.saving = true;
    this.error = '';
    try {
      const saved = await operation();
      this.cards = [...this.cards.filter(card => card.uid !== saved.uid), saved]
        .sort((left, right) => left.uid.localeCompare(right.uid));
      this.scannedUid = '';
      this.existingCard = null;
      this.toast.showSuccess('Cartes NFC', 'Modification enregistrée.');
    } catch (error) {
      this.scannedUid = '';
      this.existingCard = null;
      this.report(error);
      this.loaded = false;
    } finally {
      this.saving = false;
    }
  }

  private report(error: unknown): void {
    console.error('[Cartes NFC]', error);
    this.error = error instanceof Error ? error.message : 'Opération NFC impossible. Rechargez les cartes.';
  }
}
