import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { MemberNfcCardService, NfcReaderStatus } from '../../common/services/member-nfc-card.service';
import { NfcWorkspaceService } from '../../common/services/nfc-workspace.service';
import {
  type CardAction, type CardRequest, type ImportBatch, type ImportCheck, type ImportRow,
  type NfcCard, type NfcHistory, type NfcMember,
} from './nfc-domain';
import type { NfcSnapshot } from '../../../../../common/nfc-contract';
import { cardLabel, REQUEST_LABELS } from './nfc-labels';
import { csvReport, readImportFile } from './nfc-import';
import { MembersService } from '../../common/services/members.service';
import { MemberSettingsService } from '../../common/services/member-settings.service';

@Component({
  selector: 'app-nfc-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nfc-workspace.component.html',
})
export class NfcWorkspaceComponent implements OnInit, OnDestroy {
  readonly tabs = ['Cartes', 'Stock et prêts', 'Commandes', 'Imports', 'Poste de lecture'];
  readonly labels = REQUEST_LABELS;
  readonly cardLabel = cardLabel;
  tab = 'Cartes';
  data: NfcSnapshot = { cards: [], members: [], requests: [], batches: [] };
  loaded = false;
  busy = false;
  acquiring = false;
  importing = false;
  stopImport = false;
  error = '';
  notice = '';
  query = '';
  license = '';
  selectedUid = '';
  identified = false;
  history: NfcHistory[] = [];
  reader: NfcReaderStatus | null = null;
  bridgeError = '';
  orderReference = '';
  orderQuantity = 10;
  requestUids: Record<string, string> = {};
  filename = '';
  fileRows: ImportRow[] = [];
  expected = 0;
  checks: ImportCheck[] = [];
  reportBatch: ImportBatch | null = null;
  private abort?: AbortController;
  private routeSubscription?: Subscription;
  private destroyed = false;

  constructor(
    private readonly service: NfcWorkspaceService,
    private readonly bridge: MemberNfcCardService,
    private readonly route: ActivatedRoute,
    private readonly membersService: MembersService,
    private readonly memberSettings: MemberSettingsService,
  ) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.queryParamMap.subscribe(params => {
      this.license = params.get('license') ?? '';
      this.query = this.license;
    });
    void this.refresh();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopImport = true;
    this.abort?.abort();
    this.routeSubscription?.unsubscribe();
  }

  get selectedCard(): NfcCard | undefined { return this.data.cards.find(card => card.uid === this.selectedUid); }
  get selectedMember(): NfcMember | undefined {
    return this.data.members.find(member => member.license_number === this.selectedCard?.licenseNumber);
  }
  get filteredCards(): NfcCard[] {
    const search = this.query.trim().toLocaleLowerCase('fr');
    return this.data.cards.filter(card =>
      (this.tab !== 'Stock et prêts' || card.kind === 'WHITE')
      && `${card.uid} ${card.licenseNumber ?? ''} ${this.owner(card.licenseNumber)}`.toLocaleLowerCase('fr').includes(search));
  }
  get activeMembers(): NfcMember[] { return this.data.members.filter(member => member.lifecycleStatus === 'ACTIVE'); }
  get canImport(): boolean {
    return this.checks.length > 0 && this.expected === this.checks.length && !this.checks.some(row => row.outcome === 'ERROR');
  }
  get pendingRequests(): number { return this.data.requests.filter(request => request.stage === 'REQUESTED').length; }
  get filteredRequests(): CardRequest[] {
    const search = this.query.trim().toLocaleLowerCase('fr');
    return this.data.requests.filter(request =>
      `${request.licenseNumber} ${this.owner(request.licenseNumber)}`.toLocaleLowerCase('fr').includes(search));
  }

  owner(license?: string | null): string {
    if (!license) return 'Sans titulaire';
    const matches = this.data.members.filter(member => member.license_number === license);
    if (matches.length !== 1) return matches.length ? 'Licence ambiguë' : 'Titulaire absent du répertoire';
    return `${matches[0].firstname ?? ''} ${matches[0].lastname ?? ''}`.trim();
  }

  stockCount(state: NfcCard['stockState']): number {
    return this.data.cards.filter(card => card.kind === 'WHITE' && card.stockState === state).length;
  }

  personalCards(license: string): NfcCard[] {
    return this.data.cards.filter(card => card.kind === 'PERSONAL' && card.status === 'ACTIVE' && card.licenseNumber === license);
  }

  async openMember(): Promise<void> {
    if (this.busy || !this.selectedMember) return;
    const id = this.selectedMember.id;
    await this.run(async () => {
      const members = await firstValueFrom(this.membersService.listMembers(true));
      const member = members.find(candidate => candidate.id === id);
      if (!member) throw new Error('Adhérent introuvable. Actualisez le répertoire.');
      await firstValueFrom(this.memberSettings.access_settings(member));
      await this.load();
    });
  }

  async refresh(): Promise<void> {
    if (this.busy) return;
    await this.run(async () => { await this.load(); });
  }

  private async load(): Promise<void> {
    this.loaded = false;
    this.data = await this.service.snapshot();
    this.loaded = true;
  }

  async selectCard(uid: string): Promise<void> {
    if (this.busy) return;
    this.selectedUid = uid;
    this.identified = true;
    this.history = [];
    await this.run(async () => { this.history = await this.service.history(`card:${uid}`); });
  }

  async readCard(): Promise<void> {
    if (this.busy) return;
    this.identified = false;
    this.selectedUid = '';
    this.history = [];
    this.acquiring = true;
    const abort = new AbortController();
    this.abort = abort;
    const timeout = window.setTimeout(() => abort.abort('timeout'), 35000);
    await this.run(async () => {
      const uid = await this.bridge.acquire(abort.signal);
      if (abort.signal.aborted || this.destroyed) return;
      await this.load();
      this.selectedUid = uid;
      this.identified = true;
      this.history = await this.service.history(`card:${uid}`);
      this.notice = 'Lecture terminée : aucun pointage ni changement d’attribution.';
    }, abort);
    window.clearTimeout(timeout);
    this.acquiring = false;
    this.abort = undefined;
  }

  cancelRead(): void { this.abort?.abort('cancelled'); }

  async checkBridge(): Promise<void> {
    if (this.busy) return;
    this.reader = null;
    this.bridgeError = '';
    const abort = new AbortController();
    this.abort = abort;
    const timeout = window.setTimeout(() => abort.abort('timeout'), 5000);
    await this.run(async () => {
      try { this.reader = await this.bridge.status(abort.signal); }
      catch (error) {
        this.bridgeError = 'Liaison non vérifiée. Contrôlez ppNFC, ses origines autorisées et la permission réseau local du navigateur.';
        throw error;
      }
    }, abort);
    window.clearTimeout(timeout);
    this.abort = undefined;
  }

  async cardAction(action: CardAction): Promise<void> {
    if (this.busy || !this.loaded) return;
    const description: Record<CardAction, string> = {
      REGISTER_WHITE: 'Enregistrer cette carte blanche dans le stock disponible',
      ASSIGN: `Activer cette carte pour ${this.owner(this.license)} (licence ${this.license})`,
      DISABLE: 'Désactiver cette carte sans la remettre en stock',
      RETURN: 'Confirmer la restitution physique, retirer le titulaire et remettre cette carte blanche en stock',
      LOST: 'Déclarer cette carte perdue et la désactiver',
      RETIRED: 'Mettre définitivement cette carte hors service',
      CLASSIFY_WHITE: 'Identifier cette carte existante comme carte blanche réutilisable',
      CLASSIFY_PERSONAL: 'Identifier cette carte existante comme carte définitive',
    };
    if (!window.confirm(`${description[action]} (${this.selectedUid}) ?`)) return;
    await this.run(async () => {
      await this.service.card(action, this.selectedUid, this.data, this.license);
      await this.load();
      this.history = await this.service.history(`card:${this.selectedUid}`);
      this.notice = 'Modification enregistrée.';
    });
  }

  async requestStage(license: string, stage: CardRequest['stage']): Promise<void> {
    if (this.busy || !this.loaded) return;
    if (!window.confirm(`${this.owner(license)} : passer à « ${this.labels[stage]} » ?`)) return;
    await this.run(async () => {
      const current = this.data.requests.find(request => request.licenseNumber === license);
      await this.service.request(license, stage, this.data, this.orderReference, this.orderQuantity,
        this.requestUids[license] || current?.uid || undefined);
      await this.load();
      this.notice = 'Suivi mis à jour. Le retour d’une carte blanche reste une opération distincte.';
    });
  }

  async readFile(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.[0] || this.busy) return;
    const file = input.files[0];
    this.fileRows = [];
    this.checks = [];
    this.reportBatch = null;
    this.filename = '';
    await this.run(async () => {
      this.fileRows = await readImportFile(file);
      this.filename = file.name;
      this.notice = `${this.fileRows.length} lignes chargées. Indiquez la quantité attendue puis prévalidez.`;
    });
  }

  async preview(): Promise<void> {
    if (this.busy) return;
    this.checks = [];
    await this.run(async () => {
      await this.load();
      this.checks = this.service.preview(this.fileRows, this.expected, this.data);
    });
  }

  async startImport(): Promise<void> {
    if (this.busy || !this.canImport || !window.confirm(`Importer les ${this.checks.length} lignes de ${this.filename} ?`)) return;
    await this.run(async () => {
      this.reportBatch = await this.service.createBatch(this.filename, this.fileRows, this.expected);
      await this.processImport(this.reportBatch);
    });
  }

  async resumeImport(batch: ImportBatch): Promise<void> {
    if (this.busy) return;
    await this.run(async () => {
      await this.load();
      const fresh = this.data.batches.find(candidate => candidate.id === batch.id);
      if (!fresh) throw new Error('Lot introuvable.');
      await this.processImport(fresh);
    });
  }

  private async processImport(batch: ImportBatch): Promise<void> {
    this.importing = true;
    this.stopImport = false;
    this.reportBatch = batch;
    try {
      await this.load();
      while (this.reportBatch.cursor < this.reportBatch.rows.length && !this.stopImport && !this.destroyed) {
        this.reportBatch = await this.service.importNext(this.reportBatch, this.data);
        const result = this.reportBatch.results[this.reportBatch.cursor - 1];
        if (result.outcome === 'CREATE') {
          // Reload after writes so subsequent checks include cards created by this import.
          await this.load();
        }
      }
      this.notice = this.stopImport ? 'Import suspendu. La progression est enregistrée.'
        : `Import terminé : ${this.reportBatch.results.filter(row => row.outcome === 'ERROR').length} erreur(s). Consultez le rapport.`;
      await this.load();
    } finally { this.importing = false; }
  }

  downloadReport(batch?: ImportBatch): void {
    const results = batch?.results ?? this.checks;
    const csv = csvReport([
      ['ligne', 'prenom', 'nom', 'licence', 'uid', 'resultat', 'detail'],
      ...results.map(row => [row.line, row.firstname, row.lastname, row.licenseNumber, row.uid, row.outcome, row.message]),
    ]);
    this.download(csv, `nfc-${batch?.id ?? 'prevalidation'}.csv`);
  }

  downloadTemplate(): void {
    this.download(csvReport([['prenom', 'nom', 'licence', 'uid']]), 'modele-cartes-nfc.csv');
  }

  private download(content: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private async run(operation: () => Promise<void>, abort?: AbortController): Promise<void> {
    this.busy = true;
    this.error = '';
    this.notice = '';
    try { await operation(); }
    catch (error) {
      if (abort?.signal.reason !== 'cancelled' && !this.destroyed) {
        console.error('[Espace NFC]', error);
        this.error = abort?.signal.reason === 'timeout' ? 'Délai dépassé. Vérifiez ppNFC et réessayez.'
          : error instanceof Error ? error.message : 'Opération NFC impossible.';
      }
    } finally { this.busy = false; }
  }
}
