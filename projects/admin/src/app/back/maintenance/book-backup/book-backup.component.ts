import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BatchService } from '../SDK_v3.service';
import { ToastService } from '../../../common/services/toast.service';
import { environment } from '../../../../environments/environment';
import { switchMap, of, map } from 'rxjs';

interface BackupFile {
  version: number;          // format version (1)
  table: string;            // nom complet de la table source
  season: string;           // saison exportée
  exportedAt: string;       // ISO datetime
  count: number;            // nombre d'items
  items: any[];             // items en format DynamoDB natif
}

type Status = 'idle' | 'loading' | 'done' | 'error';

@Component({
  selector: 'app-book-backup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './book-backup.component.html',
  styleUrl: './book-backup.component.scss'
})
export class BookBackupComponent implements OnInit {

  // ── État table ──────────────────────────────────────────────────────
  bookEntryTableName: string = '';
  tableFound: boolean = false;
  currentApid: string = environment.production_apid;
  isSandbox: boolean = false;

  // ── Export ──────────────────────────────────────────────────────────
  exportSeason: string = '';
  exportStatus: Status = 'idle';
  exportCount: number = 0;
  availableSeasons: string[] = [];
  seasonsLoading: boolean = false;

  // ── Import / Restore ────────────────────────────────────────────────
  importFile: File | null = null;
  importData: BackupFile | null = null;
  importParseError: string = '';
  confirmSeasonInput: string = '';
  purgeBeforeImport: boolean = false;
  importStatus: Status = 'idle';
  importProgress: string = '';
  // ── Purge saison (sandbox uniquement) ───────────────────────────
  purgeSeasonTarget: string = '';
  purgeConfirmInput: string = '';
  purgeStatus: Status = 'idle';
  purgeCount: number = 0;
  constructor(
    private batchService: BatchService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    // Détecter si on est sur sandbox
    this.isSandbox = (environment as any).apid === environment.sandbox_apid
      || window.location.hostname.includes('sandbox')
      || window.location.hostname.includes('localhost');

    // Trouver la table BookEntry dans la liste des tables
    this.batchService.listTables().subscribe({
      next: (tables) => {
        const found = tables.find(t => t.startsWith('BookEntry-'));
        if (found) {
          this.bookEntryTableName = found;
          this.tableFound = true;
          this.loadAvailableSeasons();
        } else {
          this.toastService.showError('Book Backup', 'Table BookEntry introuvable');
        }
      },
      error: () => this.toastService.showError('Book Backup', 'Impossible de lister les tables DynamoDB')
    });
  }

  // ── Export ──────────────────────────────────────────────────────────

  private loadAvailableSeasons(): void {
    this.seasonsLoading = true;
    this.batchService.scanTable(this.bookEntryTableName, 0).subscribe({
      next: (allItems) => {
        const seasons = [...new Set(
          allItems.map(i => i['season']?.S ?? i['season']).filter(Boolean)
        )] as string[];
        this.availableSeasons = seasons.sort();
        this.seasonsLoading = false;
      },
      error: () => { this.seasonsLoading = false; }
    });
  }

  onExport(): void {
    if (!this.exportSeason.trim() || !this.tableFound) return;

    this.exportStatus = 'loading';
    this.exportCount = 0;

    const targetSeason = this.exportSeason.trim();
    this.batchService.scanTable(this.bookEntryTableName, 0).subscribe({
      next: (allItems) => {
        const items = allItems.filter(item => {
          const s = item['season']?.S ?? item['season'];
          return s === targetSeason;
        });

        this.exportCount = items.length;
        if (items.length === 0) {
          this.toastService.showError('Book Backup', `Aucun enregistrement pour "${targetSeason}"`);
          this.exportStatus = 'idle';
          return;
        }

        const backup: BackupFile = {
          version: 1,
          table: this.bookEntryTableName,
          season: this.exportSeason.trim(),
          exportedAt: new Date().toISOString(),
          count: items.length,
          items,
        };

        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const prefix = this.isSandbox ? 'sandbox_' : 'prod_';
        a.download = `${prefix}BookEntry_${this.exportSeason.trim()}_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.exportStatus = 'done';
        this.toastService.showSuccess('Book Backup', `${items.length} entrées exportées pour la saison ${this.exportSeason}`);
      },
      error: () => {
        this.exportStatus = 'error';
        this.toastService.showError('Book Backup', 'Erreur pendant l\'export');
      }
    });
  }

  // ── Import ──────────────────────────────────────────────────────────

  onFileSelect(event: Event): void {
    this.importData = null;
    this.importParseError = '';
    this.confirmSeasonInput = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as BackupFile;
        // Bloquer un fichier sandbox_ en production
        if (!this.isSandbox && file.name.startsWith('sandbox_')) {
          this.importParseError = 'Import bloqué : ce fichier provient de sandbox et ne peut pas être importé en production.';
          return;
        }
        // Validation minimale
        if (parsed.version !== 1 || !parsed.season || !Array.isArray(parsed.items)) {
          this.importParseError = 'Format de fichier invalide (version, season ou items manquants)';
          return;
        }
        // Vérifier cohérence __typename
        const allBookEntry = parsed.items.every(
          item => item['__typename']?.S === 'BookEntry'
        );
        if (!allBookEntry) {
          this.importParseError = 'Le fichier contient des entrées qui ne sont pas de type BookEntry';
          return;
        }
        this.importData = parsed;
      } catch {
        this.importParseError = 'Fichier JSON invalide ou corrompu';
      }
    };
    reader.readAsText(file);
  }

  get canImport(): boolean {
    return !!(
      this.importData &&
      this.confirmSeasonInput.trim() === this.importData.season &&
      this.tableFound &&
      this.importStatus !== 'loading'
    );
  }

  onImport(): void {
    if (!this.canImport || !this.importData) return;

    const targetTable = this.bookEntryTableName;
    const season = this.importData.season;
    const items = this.importData.items;

    this.importStatus = 'loading';
    this.importProgress = '';

    const doWrite = () => {
      this.importProgress = `Écriture de ${items.length} entrées...`;
      this.batchService.batchWriteItem(targetTable, items).subscribe({
        next: () => {
          this.toastService.showSuccess(
            'Book Backup',
            `${items.length} entrées restaurées pour la saison ${season}`
          );
          this.resetImport();
          this.loadAvailableSeasons();
        },
        error: () => {
          this.importStatus = 'error';
          this.importProgress = '';
          this.toastService.showError('Book Backup', 'Erreur pendant l\'import');
        }
      });
    };

    if (this.purgeBeforeImport) {
      this.importProgress = `Suppression des entrées existantes pour la saison ${season}...`;
      this.batchService.scanTable(targetTable, 0).pipe(
        map(allItems => allItems.filter(item => (item['season']?.S ?? item['season']) === season)),
        switchMap((existing) => {
          if (existing.length === 0) return of([]);
          return this.batchService.batchDeleteItem(targetTable, existing);
        })
      ).subscribe({
        next: () => doWrite(),
        error: () => {
          this.importStatus = 'error';
          this.toastService.showError('Book Backup', 'Erreur pendant la purge');
        }
      });
    } else {
      doWrite();
    }
  }

  resetImport(): void {
    this.importFile = null;
    this.importData = null;
    this.importParseError = '';
    this.confirmSeasonInput = '';
    this.purgeBeforeImport = false;
    this.importStatus = 'idle';
    this.importProgress = '';
  }

  // ── Purge saison (sandbox uniquement) ────────────────────────

  get canPurge(): boolean {
    return this.isSandbox
      && !!this.purgeSeasonTarget
      && this.purgeStatus !== 'loading';
  }

  onPurgeSeason(): void {
    if (!this.canPurge) return;
    const target = this.purgeSeasonTarget;
    this.purgeStatus = 'loading';
    this.purgeCount = 0;

    this.batchService.scanTable(this.bookEntryTableName, 0).pipe(
      map(allItems => allItems.filter(item => (item['season']?.S ?? item['season']) === target)),
      switchMap(items => {
        if (items.length === 0) return of(0);
        return this.batchService.batchDeleteItem(this.bookEntryTableName, items).pipe(map(() => items.length));
      })
    ).subscribe({
      next: (count) => {
        this.purgeCount = count as number;
        this.purgeStatus = 'done';
        this.purgeConfirmInput = '';
        if (count === 0) {
          this.toastService.showError('Book Backup', `Aucune entrée trouvée pour "${target}"`);
          this.purgeStatus = 'idle';
        } else {
          this.toastService.showSuccess('Book Backup', `${count} entrées supprimées pour la saison ${target}`);
          this.loadAvailableSeasons(); // rafraîchit les saisons
        }
      },
      error: () => {
        this.purgeStatus = 'error';
        this.toastService.showError('Book Backup', 'Erreur pendant la purge');
      }
    });
  }

  resetPurge(): void {
    this.purgeSeasonTarget = '';
    this.purgeConfirmInput = '';
    this.purgeStatus = 'idle';
    this.purgeCount = 0;
  }
}
