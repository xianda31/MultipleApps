import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';
import { FileService, S3_ROOT_FOLDERS } from '../../common/services/files.service';
import { map, Observable, first, catchError, of, Subscription } from 'rxjs';

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
 thumbnails$ !: Observable<string[]>;
  // cache of presigned preview URLs for tournaments_type entries keyed by the mapping key
  previewMap: { [key: string]: string | null } = {};
  private defaultImageSub?: Subscription;
  constructor(
    private fb: FormBuilder,
    private systemDataService: SystemDataService,
    private toastService: ToastService,
    public fileService: FileService
  ) {

    this.thumbnails$ = this.fileService.list_files(S3_ROOT_FOLDERS.IMAGES + '/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );


    this.uiForm = this.fb.group({
      template: this.fb.group({
        logo_path: [''],
        background_color: ['#ffffff']
      }),
      thumbnail: this.fb.group({
        width: [300],
        height: [200],
        ratio: [1.78]
      }),
      tournaments_row_cols: this.fb.group({
        SM: [1, [Validators.min(1), Validators.max(6)]],
        MD: [2, [Validators.min(1), Validators.max(6)]],
        LG: [4, [Validators.min(1), Validators.max(6)]],
        XL: [6, [Validators.min(1), Validators.max(6)]]
      }, { validators: this.breakpointsOrderValidator }),
      news_row_cols: this.fb.group({
        SM: [1, [Validators.min(1), Validators.max(6)]],
        MD: [2, [Validators.min(1), Validators.max(6)]],
        LG: [4, [Validators.min(1), Validators.max(6)]],
        XL: [6, [Validators.min(1), Validators.max(6)]]
      }, { validators: this.breakpointsOrderValidator }),
      // number of lines shown before showing a Read More link
      read_more_lines: [3, [Validators.min(0), Validators.max(20)]],
      // whether hovering unfolds the card entirely
      unfold_on_hover: [false],
      // hover delay in milliseconds before unfolding
      hover_unfold_delay_ms: [500, [Validators.min(0), Validators.max(10000)]],
      // hover unfold animation duration (ms)
      hover_unfold_duration_ms: [300, [Validators.min(0), Validators.max(10000)]],
      // homepage layout ratio: 1 = 6/6, 2 = 8/4
      home_layout_ratio: [2, [Validators.min(1), Validators.max(2)]],
      tournaments_type: this.fb.array([]),
      default_tournament_image: [''],
      // `homepage` booleans removed from UI config; breakpoints stay editable at top-level form groups
      frontBannerEnabled: [false],
      homepage_intro: ['']
    });
    // attach FormArray-level validator to enforce keys non-empty and unique
    const tt = this.uiForm.get('tournaments_type') as FormArray;
    tt.setValidators(this.tournamentsTypeArrayValidator);
  }

  // convenience getter used by the template to know if unfold-on-hover is enabled
  get unfoldOnHover(): boolean {
    return !!this.uiForm?.get('unfold_on_hover')?.value;
  }

  get tournaments_type(): FormArray {
    return this.uiForm.get('tournaments_type') as FormArray;
  }

  addTournamentType(key: string = '', image: string = '') {
    const group = this.fb.group({ key: [key, Validators.required], image: [image] });
    this.tournaments_type.push(group);
    const idx = this.tournaments_type.length - 1;
    // use key value as unique id for this mapping
    const keyControl = group.get('key');
    const imageControl = group.get('image');
    const initialKey = keyControl?.value || '';
    if (initialKey) {
      this.loadPreviewForKey(initialKey, image);
    }

    // when image changes, refresh preview for the current key
    if (imageControl) {
      imageControl.valueChanges.subscribe((val) => {
        const curKey = keyControl?.value;
        if (curKey) this.loadPreviewForKey(curKey, val);
      });
    }

    // when key changes, move preview entry to the new key and load preview for it
    if (keyControl) {
      let prevKey = initialKey;
      keyControl.valueChanges.subscribe((newKey: string | null) => {
        const curImage = imageControl?.value;
        if (prevKey && prevKey !== newKey) {
          delete this.previewMap[prevKey];
        }
        if (newKey) {
          this.loadPreviewForKey(newKey, curImage);
        }
        prevKey = newKey || '';
      });
    }
    // re-evaluate array-level validators after adding
    this.tournaments_type.updateValueAndValidity();
  }

  removeTournamentType(i: number) {
    const grp = this.tournaments_type.at(i);
    const key = grp?.get('key')?.value;
    if (key) delete this.previewMap[key];
    this.tournaments_type.removeAt(i);
    this.tournaments_type.updateValueAndValidity();
  }

  // Validator for tournaments_type FormArray: keys must be non-empty and unique
  tournamentsTypeArrayValidator = (control: AbstractControl): ValidationErrors | null => {
    try {
      const arr = control as FormArray;
      const keys = arr.controls.map(c => (c.get('key')?.value ?? '').toString().trim());
      // empty keys
      const hasEmpty = keys.some(k => !k);
      if (hasEmpty) return { emptyKey: true };
      // duplicates
      const counts: { [k: string]: number } = {};
      const dupes: string[] = [];
      for (const k of keys) {
        if (!k) continue;
        counts[k] = (counts[k] || 0) + 1;
        if (counts[k] === 2) dupes.push(k);
      }
      if (dupes.length) return { duplicateKeys: dupes };
      return null;
    } catch (e) {
      return null;
    }
  }

  private loadPreviewForKey(key: string, image: string | null | undefined) {
    if (!key) return;
    if (!image) {
      this.previewMap[key] = null;
      return;
    }
    // request presigned URL once, ignore errors and store null on failure
    this.fileService.getPresignedUrl$(image)
      .pipe(
        first(),
        catchError(() => of(null))
      )
      .subscribe((url: string | null) => {
        this.previewMap[key] = url;
      }, () => {
        this.previewMap[key] = null;
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
    // Patch form with defaults (support both legacy top-level keys and new `homepage` nesting)
    // homepage and breakpoints are required in the interface; use defaults if absent
    const tournaments = (ui && ui.homepage && ui.homepage.tournaments_row_cols)
      ? ui.homepage.tournaments_row_cols
      : { SM: 1, MD: 2, LG: 4, XL: 6 };
    const news = (ui && ui.homepage && ui.homepage.news_row_cols)
      ? ui.homepage.news_row_cols
      : { SM: 1, MD: 2, LG: 4, XL: 6 };
    const template = ui?.template || {};
    const tournamentsType = ui?.tournaments_type || {};
    const homepage = ui?.homepage || {};
    // Support legacy/default stored in tournaments_type under several possible keys
    const defaultKeys = ['defaut', 'défaut', 'default', '__default__', 'fallback'];
    let inferredDefault: string | undefined = ui?.default_tournament_image;
    for (const dk of defaultKeys) {
      if (!inferredDefault && tournamentsType && (tournamentsType as any)[dk]) {
        inferredDefault = (tournamentsType as any)[dk];
        // remove from mapping so it doesn't appear as a regular mapping row
        delete (tournamentsType as any)[dk];
      }
    }
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
      read_more_lines: homepage.read_more_lines ?? ui?.read_more_lines ?? 3,
      unfold_on_hover: homepage.unfold_on_hover ?? ui?.unfold_on_hover ?? false,
      hover_unfold_delay_ms: homepage.hover_unfold_delay_ms ?? ui?.hover_unfold_delay_ms ?? 500,
      hover_unfold_duration_ms: homepage.hover_unfold_duration_ms ?? ui?.hover_unfold_duration_ms ?? 300,
      home_layout_ratio: homepage.home_layout_ratio ?? ui?.home_layout_ratio ?? 2,
      tournaments_type: [] as any,
      // homepage booleans removed; breakpoints are patched/handled separately
      thumbnail: {
        width: ui?.thumbnail?.width ?? 300,
        height: ui?.thumbnail?.height ?? 200,
        ratio: ui?.thumbnail?.ratio ?? 1.78
      },
      default_tournament_image: inferredDefault ?? (ui?.default_tournament_image ?? ''),
      // no homepage booleans
      frontBannerEnabled: ui?.frontBannerEnabled ?? false,
      homepage_intro: ui?.homepage_intro ?? ''
    });

    // populate tournaments_type form array
    this.tournaments_type.clear();
    // reset preview cache
    this.previewMap = {};
    Object.keys(tournamentsType).forEach((k) => {
      this.addTournamentType(k, tournamentsType[k]);
    });

    // Ensure default preview is loaded and kept in previewMap under key 'defaut'
    // Unsubscribe previous subscription if any to avoid duplicates
    try { this.defaultImageSub?.unsubscribe(); } catch (e) { /* ignore */ }
    const defaultCtrl = this.uiForm.get('default_tournament_image');
    if (defaultCtrl) {
      // when the default image control changes, refresh the preview
      this.defaultImageSub = defaultCtrl.valueChanges.subscribe((val) => {
        this.loadPreviewForKey('defaut', val);
      });
    }
    // load initial preview for default if present
    const initialDefault = this.uiForm.get('default_tournament_image')?.value;
    if (initialDefault) this.loadPreviewForKey('defaut', initialDefault);
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
      // Build payload ensuring tournaments/news breakpoints are nested under `homepage`
      const formVal: any = this.uiForm.value || {};
      const payload: any = { ...formVal };
      // Convert tournaments_type FormArray (array [{key,image},...]) into mapping { key: image }
      if (Array.isArray(payload.tournaments_type)) {
        const map: { [k: string]: string } = {};
        payload.tournaments_type.forEach((entry: any) => {
          if (entry && entry.key) map[entry.key] = entry.image || '';
        });
        // If default_tournament_image is set, store it under the forced key 'defaut'
        if (payload.default_tournament_image) {
          map['defaut'] = payload.default_tournament_image;
        }
        payload.tournaments_type = map;
      } else {
        // ensure we still include default if tournaments_type absent
        payload.tournaments_type = {};
        if (payload.default_tournament_image) payload.tournaments_type['defaut'] = payload.default_tournament_image;
      }
      payload.homepage = { ...(formVal.homepage || {}) };
      payload.homepage.tournaments_row_cols = formVal.tournaments_row_cols;
      payload.homepage.news_row_cols = formVal.news_row_cols;
      // persist read_more_lines, unfold_on_hover and hover_unfold_delay_ms if present in the form
      if (formVal.read_more_lines !== undefined) payload.homepage.read_more_lines = formVal.read_more_lines;
      if (formVal.unfold_on_hover !== undefined) payload.homepage.unfold_on_hover = !!formVal.unfold_on_hover;
      if (formVal.hover_unfold_delay_ms !== undefined) payload.homepage.hover_unfold_delay_ms = Number(formVal.hover_unfold_delay_ms);
      if (formVal.hover_unfold_duration_ms !== undefined) payload.homepage.hover_unfold_duration_ms = Number(formVal.hover_unfold_duration_ms);
      if (formVal.home_layout_ratio !== undefined) payload.homepage.home_layout_ratio = Number(formVal.home_layout_ratio);

      // Save UI settings into dedicated file and publish immediately
      // Debug: log tournaments_type payload to help diagnose persistence issues
      // debug log removed
      await this.systemDataService.save_ui_settings(payload);
      // Refresh export blob so "Exporter" downloads the most recent saved state
      this.export_file_url = this.fileService.json_to_blob(payload);
      this.toastService.showSuccess('UI settings', 'Paramètres UI sauvegardés');
    } catch (e: any) {
      this.toastService.showErrorToast('UI settings', e?.message || 'Erreur sauvegarde');
    }
  }

  previewSettings() {
    try {
      const formVal: any = this.uiForm.value || {};
      const preview: any = { ...formVal };
      // Convert tournaments_type for preview as well
      if (Array.isArray(preview.tournaments_type)) {
        const map: { [k: string]: string } = {};
        preview.tournaments_type.forEach((entry: any) => {
          if (entry && entry.key) map[entry.key] = entry.image || '';
        });
        if (preview.default_tournament_image) map['defaut'] = preview.default_tournament_image;
        preview.tournaments_type = map;
      } else {
        preview.tournaments_type = {};
        if (preview.default_tournament_image) preview.tournaments_type['defaut'] = preview.default_tournament_image;
      }
      preview.homepage = { ...(formVal.homepage || {}) };
      preview.homepage.tournaments_row_cols = formVal.tournaments_row_cols;
      preview.homepage.news_row_cols = formVal.news_row_cols;
      if (formVal.read_more_lines !== undefined) preview.homepage.read_more_lines = formVal.read_more_lines;
      if (formVal.unfold_on_hover !== undefined) preview.homepage.unfold_on_hover = !!formVal.unfold_on_hover;
      if (formVal.hover_unfold_delay_ms !== undefined) preview.homepage.hover_unfold_delay_ms = Number(formVal.hover_unfold_delay_ms);
      if (formVal.hover_unfold_duration_ms !== undefined) preview.homepage.hover_unfold_duration_ms = Number(formVal.hover_unfold_duration_ms);
      if (formVal.home_layout_ratio !== undefined) preview.homepage.home_layout_ratio = Number(formVal.home_layout_ratio);
      this.systemDataService.patchUiSettings(preview);
      // Update export blob to reflect the previewed state
      this.export_file_url = this.fileService.json_to_blob(preview);
      this.toastService.showInfo('UI settings', 'Aperçu appliqué');
    } catch (e: any) {
      this.toastService.showErrorToast('UI settings', 'Erreur affichage de l\'aperçu');
    }
  }

}
