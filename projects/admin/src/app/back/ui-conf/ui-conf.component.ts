import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';
import { FileService } from '../../common/services/files.service';
// No continuous form subscriptions needed — preview/save are manual
import { UIConfiguration } from '../../common/interfaces/system-conf.interface';

@Component({
  selector: 'app-ui-conf',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './ui-conf.component.html',
  styleUrls: ['./ui-conf.component.scss']
})
export class UiConfComponent implements OnInit {
  uiForm!: FormGroup;
  loaded = false;
  export_file_url: any;
  logoPreviewUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private systemDataService: SystemDataService,
    private toastService: ToastService,
    private fileService: FileService
  ) {
    this.uiForm = this.fb.group({
      template: this.fb.group({
        logo_path: [''],
        background_color: ['#ffffff']
      }),
      tournaments_row_cols: this.fb.group({
        SM: [null, [Validators.min(1), Validators.max(6)]],
        MD: [4, [Validators.min(1), Validators.max(6)]],
        LG: [null, [Validators.min(1), Validators.max(6)]],
        XL: [null, [Validators.min(1), Validators.max(6)]]
      }, { validators: this.breakpointsOrderValidator }),
      news_row_cols: this.fb.group({
        SM: [null, [Validators.min(1), Validators.max(6)]],
        MD: [4, [Validators.min(1), Validators.max(6)]],
        LG: [null, [Validators.min(1), Validators.max(6)]],
        XL: [null, [Validators.min(1), Validators.max(6)]]
      }, { validators: this.breakpointsOrderValidator }),
      homepage: this.fb.group({
        tournamentsEnabled: [true],
        newsEnabled: [true]
      }),
      frontBannerEnabled: [false],
      homepage_intro: ['']
    });
  }

  // Validator to ensure breakpoints are non-decreasing: SM <= MD <= LG <= XL
  breakpointsOrderValidator = (group: AbstractControl): ValidationErrors | null => {
    const v = group?.value || {};
    const toNum = (x: any) => (x === null || x === undefined || x === '') ? null : Number(x);
    const sm = toNum(v.SM);
    const md = toNum(v.MD);
    const lg = toNum(v.LG);
    const xl = toNum(v.XL);
    if (sm !== null && md !== null && sm > md) return { breakpointsOrder: true };
    if (md !== null && lg !== null && md > lg) return { breakpointsOrder: true };
    if (lg !== null && xl !== null && lg > xl) return { breakpointsOrder: true };
    return null;
  }

  ngOnInit(): void {
    // Load UI settings: prefer cached in-memory preview if present,
    // fall back to remote fetch when not available.
    this.systemDataService.get_ui_settings().subscribe({
      next: (ui) => {
        this.loadDataInForm(ui || {});
        this.export_file_url = this.fileService.json_to_blob(ui || {});
        const logoPath = ui?.template?.logo_path;
        if (logoPath) {
          this.fileService.getPresignedUrl$(logoPath).subscribe({ next: (url) => this.logoPreviewUrl = url, error: () => this.logoPreviewUrl = null });
        }
        this.loaded = true;
      },
      error: (err) => {
        this.toastService.showErrorToast('UI settings', 'Erreur chargement des paramètres UI');
      }
    });

    // No continuous form subscription — export/preview/save are manual actions.
  }


  loadDataInForm(ui: any) {
    // Patch form with defaults (expect `tournaments_row_cols` in the UI file)
    const tournaments = ui?.tournaments_row_cols || {};
    const news = ui?.news_row_cols || {};
    const template = ui?.template || {};
    const homepage = ui?.homepage || {};
    this.uiForm.patchValue({
      template: {
        logo_path: template.logo_path ?? '',
        background_color: template.background_color ?? '#ffffff'
      },
      tournaments_row_cols: {
        SM: tournaments.SM ?? 1,
        MD: tournaments.MD ?? 2,
        LG: tournaments.LG ?? 4,
        XL: tournaments.XL ?? 6
      },
      news_row_cols: {
        SM: news.SM ?? 1,
        MD: news.MD ?? 2,
        LG: news.LG ?? 4,
        XL: news.XL ?? 6
      },
      homepage: {
        tournamentsEnabled: homepage.tournamentsEnabled ?? true,
        newsEnabled: homepage.newsEnabled ?? true
      },
      frontBannerEnabled: ui?.frontBannerEnabled ?? false,
      homepage_intro: ui?.homepage_intro ?? ''
    });
  }

  async onLogoFileSelected(event: any) {
    const file: File = event.target.files?.[0];
    if (!file) return;
    const filename = `ui/logo_${Date.now()}_${file.name}`;
    try {
      await this.fileService.upload_file(file, 'ui/');
      // store path relative to bucket
      const path = filename; // consistent with upload_file usage
      this.uiForm.get('template.logo_path')?.setValue(path);
      // fetch presigned url
      this.fileService.getPresignedUrl$(path).subscribe({ next: (url) => this.logoPreviewUrl = url, error: () => this.logoPreviewUrl = null });
      this.toastService.showSuccess('UI settings', 'Logo uploaded');
    } catch (e: any) {
      this.toastService.showErrorToast('UI settings', 'Erreur upload du logo');
    }
  }

  async onImportFile(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      this.loadDataInForm(json);
      this.toastService.showSuccess('UI settings', 'Fichier chargé avec succès');
    } catch (e: any) {
      this.toastService.showErrorToast('UI settings', 'Erreur lecture du fichier');
    }
  }

  async saveSettings() {
    try {
      // Save UI settings into dedicated file and publish immediately
      await this.systemDataService.save_ui_settings(this.uiForm.value || {});
      // Refresh export blob so "Exporter" downloads the most recent saved state
      this.export_file_url = this.fileService.json_to_blob(this.uiForm.value || {});
      this.toastService.showSuccess('UI settings', 'Paramètres UI sauvegardés');
    } catch (e: any) {
      this.toastService.showErrorToast('UI settings', e?.message || 'Erreur sauvegarde');
    }
  }

  previewSettings() {
    try {
      this.systemDataService.patchUiSettings(this.uiForm.value || {});
      // Update export blob to reflect the previewed state
      this.export_file_url = this.fileService.json_to_blob(this.uiForm.value || {});
      this.toastService.showInfo('UI settings', 'Aperçu appliqué');
    } catch (e: any) {
      this.toastService.showErrorToast('UI settings', 'Erreur affichage de l\'aperçu');
    }
  }

}
