import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { GroupService } from '../authentification/group.service';
import { Group_priorities } from '../authentification/group.interface';
import { NfcWorkspaceService } from '../services/nfc-workspace.service';
import { cardLabel, REQUEST_LABELS } from '../../back/nfc/nfc-labels';
import type { CardRequest, NfcCard } from '../../back/nfc/nfc-domain';

@Component({
  selector: 'app-nfc-member-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (allowed || error) {
      <section class="settings-section my-3" aria-labelledby="member-nfc-title">
        <h6 id="member-nfc-title">Cartes NFC</h6>
        @if (error) { <p class="text-danger" role="alert">{{ error }}</p> }
        @if (loading) { <p role="status">Chargement du résumé NFC…</p> }
        @if (loaded) {
          @for (card of cards; track card.uid) { <p class="mb-1">{{ cardLabel(card) }} — <code>{{ card.uid }}</code></p> }
          @empty { <p>Aucune carte attribuée.</p> }
          @if (request) { <p>Carte définitive : {{ labels[request.stage] }}</p> }
        }
        @if (allowed) {
          <button type="button" class="btn btn-sm btn-outline-primary" (click)="open.emit()">Gérer dans l’espace NFC</button>
        }
      </section>
    }
  `,
})
export class NfcMemberSummaryComponent implements OnInit {
  @Input({ required: true }) licenseNumber!: string;
  @Output() open = new EventEmitter<void>();
  readonly cardLabel = cardLabel;
  readonly labels = REQUEST_LABELS;
  allowed = false;
  loading = false;
  loaded = false;
  error = '';
  cards: NfcCard[] = [];
  request: CardRequest | null = null;
  constructor(private groups: GroupService, private nfc: NfcWorkspaceService) {}
  async ngOnInit(): Promise<void> {
    try {
      this.allowed = (await this.groups.getUserAccreditation()).level >= Group_priorities.Administrateur;
      if (!this.allowed) return;
      this.loading = true;
      const summary = await this.nfc.summary(this.licenseNumber);
      this.cards = summary.cards;
      this.request = summary.request;
      this.loaded = true;
    } catch (error) {
      console.error('[Résumé NFC]', error);
      this.error = 'Résumé NFC indisponible : vérifiez vos droits et la connexion.';
    } finally { this.loading = false; }
  }
}
