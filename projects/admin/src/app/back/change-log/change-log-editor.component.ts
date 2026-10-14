import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ChangeLogDataService } from './change-log-data.service';
import {
  CHANGE_LOG_KINDS,
  CHANGE_LOG_SITES,
  ChangeLogArea,
  ChangeLogEntry,
  ChangeLogKind,
  ChangeLogSite,
  changeLogAreasForSite,
  generateChangeLogId,
} from './change-log.model';

@Component({
  selector: 'app-change-log-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-log-editor.component.html',
  styleUrl: './change-log-editor.component.scss',
})
export class ChangeLogEditorComponent implements OnInit {
  readonly kinds = CHANGE_LOG_KINDS;
  readonly sites = CHANGE_LOG_SITES;
  readonly form = new FormGroup({
    publishedOn: new FormControl(this.today(), {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{4}-\d{2}-\d{2}$/)],
    }),
    site: new FormControl<ChangeLogSite>('BACK_OFFICE', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    area: new FormControl<ChangeLogArea>('GENERAL', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    kind: new FormControl<ChangeLogKind>('IMPROVEMENT', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    summary: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
  });

  entries: ChangeLogEntry[] = [];
  loading = true;
  saving = false;
  serviceAvailable = false;
  errorMessage = '';
  editingId: string | null = null;

  constructor(private changeLogData: ChangeLogDataService) {}

  ngOnInit(): void {
    this.reload();
  }

  get summaryLength(): number {
    return this.form.controls.summary.value.length;
  }

  get availableAreas() {
    return changeLogAreasForSite(this.form.controls.site.value);
  }

  get technicalTermsWarning(): string {
    const summary = this.form.controls.summary.value;
    const terms = ['API', 'BookEntry', 'Lambda', 'S3', 'backend', 'frontend', 'Stripe'];
    const found = terms.filter((term) => summary.toLocaleLowerCase('fr').includes(term.toLocaleLowerCase('fr')));
    return found.length > 0
      ? `Vérifier si ces termes techniques sont nécessaires : ${found.join(', ')}`
      : '';
  }

  get selectedAreaLabel(): string {
    return this.availableAreas.find((area) => area.value === this.form.controls.area.value)?.label ?? '';
  }

  get selectedSiteLabel(): string {
    return this.sites.find((site) => site.value === this.form.controls.site.value)?.label ?? '';
  }

  get selectedKindLabel(): string {
    return this.kinds.find((kind) => kind.value === this.form.controls.kind.value)?.label ?? '';
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = '';
    this.changeLogData.loadEditorEntries()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (entries) => {
          this.entries = entries;
          this.serviceAvailable = true;
        },
        error: (error: HttpErrorResponse) => {
          this.serviceAvailable = false;
          this.errorMessage = this.errorText(
            error,
            'Le service local d’édition n’est pas disponible. Relancez l’environnement avec npm start.',
          );
        },
      });
  }

  onSiteChange(): void {
    const currentArea = this.form.controls.area.value;
    if (!this.availableAreas.some((area) => area.value === currentArea)) {
      this.form.controls.area.setValue('GENERAL');
    }
  }

  newEntry(): void {
    this.editingId = null;
    this.form.reset({
      publishedOn: this.today(),
      site: 'BACK_OFFICE',
      area: 'GENERAL',
      kind: 'IMPROVEMENT',
      summary: '',
    });
  }

  editEntry(entry: ChangeLogEntry): void {
    this.editingId = entry.id;
    this.form.setValue({
      publishedOn: entry.publishedOn,
      site: entry.site,
      area: entry.area,
      kind: entry.kind,
      summary: entry.summary,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.newEntry();
  }

  saveEntry(): void {
    if (this.form.invalid || !this.serviceAvailable || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const retainedEntries = this.entries.filter((entry) => entry.id !== this.editingId);
    const id = this.editingId ?? generateChangeLogId(
      value.publishedOn,
      value.summary,
      new Set(retainedEntries.map((entry) => entry.id)),
    );
    const nextEntries = [
      ...retainedEntries,
      {
        id,
        publishedOn: value.publishedOn,
        site: value.site,
        area: value.area,
        kind: value.kind,
        summary: value.summary.trim(),
      },
    ];

    this.persist(nextEntries, 'L’entrée a été enregistrée dans le fichier versionné.');
  }

  deleteEntry(entry: ChangeLogEntry): void {
    if (!this.serviceAvailable || this.saving) return;
    if (!window.confirm(`Supprimer l’entrée « ${entry.summary} » ?`)) return;
    this.persist(
      this.entries.filter((candidate) => candidate.id !== entry.id),
      'L’entrée a été supprimée du fichier versionné.',
    );
  }

  areaLabel(entry: ChangeLogEntry): string {
    return changeLogAreasForSite(entry.site).find((area) => area.value === entry.area)?.label ?? entry.area;
  }

  kindLabel(entry: ChangeLogEntry): string {
    return this.kinds.find((kind) => kind.value === entry.kind)?.label ?? entry.kind;
  }

  siteLabel(entry: ChangeLogEntry): string {
    return this.sites.find((site) => site.value === entry.site)?.label ?? entry.site;
  }

  private persist(entries: ChangeLogEntry[], successMessage: string): void {
    this.saving = true;
    this.errorMessage = '';
    this.changeLogData.saveEditorEntries(entries)
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: (savedEntries) => {
          this.entries = savedEntries;
          this.newEntry();
          this.errorMessage = successMessage;
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage = this.errorText(error, 'Impossible d’enregistrer le change log.');
        },
      });
  }

  private errorText(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = typeof error.error?.error === 'string' ? error.error.error : '';
    return apiMessage || fallback;
  }

  private today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }
}
