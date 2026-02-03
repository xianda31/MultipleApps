import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';
import { FileService, S3_ROOT_FOLDERS } from '../../common/services/files.service';
import { map, Observable, first, catchError, of, Subscription } from 'rxjs';
import { CompetitionsUIConfig} from '../../common/interfaces/ui-conf.interface';
import { COMPETITION_DIVISION_LABELS, COMPETITION_DIVISIONS } from '../competitions/competitions.interface';

@Component({
  selector: 'app-ui-conf',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './ui-conf.component.html',
  styleUrls: ['./ui-conf.component.scss']
})
export class UiConfComponent implements OnInit {
  divisions = Object.values(COMPETITION_DIVISION_LABELS);
  // Subset Google Fonts populaires (label = affiché, css = valeur à injecter)
  googleFontsSubset = [
    { label: 'Amarante', css: 'Amarante, serif' },
    { label: 'Roboto', css: 'Roboto, sans-serif' },
    { label: 'Open Sans', css: 'Open Sans, sans-serif' },
    { label: 'Lato', css: 'Lato, sans-serif' },
    { label: 'Montserrat', css: 'Montserrat, sans-serif' },
    { label: 'Oswald', css: 'Oswald, sans-serif' },
    { label: 'Raleway', css: 'Raleway, sans-serif' },
    { label: 'Emblema One', css: 'Emblema One, cursive' },
    { label: 'Caveat', css: 'Caveat, cursive' },
    { label: 'Pacifico', css: 'Pacifico, cursive' },
    { label: 'Merriweather', css: 'Merriweather, serif' },
    { label: 'Playfair Display', css: 'Playfair Display, serif' },
    { label: 'Quicksand', css: 'Quicksand, sans-serif' },
    { label: 'Source Sans Pro', css: 'Source Sans Pro, sans-serif' },
    { label: 'Nunito', css: 'Nunito, sans-serif' },
    { label: 'Bebas Neue', css: 'Bebas Neue, cursive' },
    { label: 'Fira Sans', css: 'Fira Sans, sans-serif' },
    { label: 'Poppins', css: 'Poppins, sans-serif' },
    { label: 'Ubuntu', css: 'Ubuntu, sans-serif' },
    { label: 'Muli', css: 'Muli, sans-serif' }
  ];
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
      main_color: ['#3f493d'],
      secondary_color: ['#ffc107'],
      success_color: ['#198754'],
      danger_color: ['#dc3545'],
      warning_color: ['#ffc107'],
      info_color: ['#0dcaf0'],
      light_color: ['#f8f9fa'],
      dark_color: ['#212529'],
      brand_bg: ['#2e332d'],
      template: this.fb.group({
        logo_path: [''],
        background_color: ['#ffffff'],
        banner_bg: ['#2e332d'],
        banner_text_color: ['#ffffff'],
        banner_font: ['Emblema One, cursive'],
        navbar_bg: ['#3f493d'],
        navbar_text_color: ['#ffffff'],
        navbar_font: ['Amarante, serif'],
        content_bg: ['#ffffff'],
        content_text_color: ['#222222'],
        content_font: ['Amarante, serif']
      }),
      card_thumbnails: this.fb.array([]),
      album_thumbnail: this.fb.group({
        width: [600],
        height: [400],
        ratio: [1.5]
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

      read_more_lines: [3, [Validators.min(0), Validators.max(20)]],
      unfold_on_hover: [false],
      hover_unfold_delay_ms: [500, [Validators.min(0), Validators.max(10000)]],
      hover_unfold_duration_ms: [300, [Validators.min(0), Validators.max(10000)]],
      home_layout_ratio: [2, [Validators.min(0), Validators.max(2)]],

      tournaments_type: this.fb.array([]),
      default_tournament_image: [''],
      frontBannerEnabled: [false],
      homepage_intro: [''],
      email: this.fb.group({
        tagline: ['Votre club de bridge convivial et dynamique'],
        ccEmail: ['']
      }),
      album_carousel_interval_ms: [5000, [Validators.min(0), Validators.max(60000)]],
      competitions: this.fb.group({
        preferred_organizations: this.fb.group({
          ["comite"]: ['Comité des Pyrenees'],
          ["ligue"]: ['Ligue 06 LR-PY'],
          ["national"]: ['FFB']
        }),
        result_filter_thresholds: this.fb.group(
          Object.fromEntries((COMPETITION_DIVISIONS as string[]).map((d: string) => [d, [0]]))
        ),
        show_members_only: [false],
        one_year_back: [false],
        show_infos: [false],
        no_filter: [false]
      })
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
  get card_thumbnails(): FormArray {
    return this.uiForm.get('card_thumbnails') as FormArray;
  }

  addCardThumbnail(width: number = 300, height: number = 200, ratio: number = 1.78) {
    const group = this.fb.group({
      width: [width, [Validators.min(50), Validators.max(2000)]],
      height: [height, [Validators.min(50), Validators.max(2000)]],
      ratio: [{ value: ratio, disabled: true }, [Validators.min(0.1), Validators.max(10)]]
    });
    // Met à jour le ratio automatiquement quand width ou height change
    group.get('width')!.valueChanges.subscribe((w) => {
      const h = group.get('height')!.value;
      if (w != null && h != null && h > 0) {
        group.get('ratio')!.setValue(Number((w / h).toFixed(2)), { emitEvent: false });
      }
    });
    group.get('height')!.valueChanges.subscribe((h) => {
      const w = group.get('width')!.value;
      if (w != null && h != null && h > 0) {
        group.get('ratio')!.setValue(Number((w / h).toFixed(2)), { emitEvent: false });
      }
    });
    this.card_thumbnails.push(group);
  }

  removeCardThumbnail(i: number) {
    if (this.card_thumbnails.length > 1) {
      this.card_thumbnails.removeAt(i);
    }
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
    // Un seul subscribe à l'init
    this.systemDataService.get_ui_settings().subscribe({
      next: (ui) => {
        this.loadDataInForm(ui || {});
        this.export_file_url = this.fileService.json_to_blob(ui || {});
        const logoPath = ui?.template?.logo_path;
        if (logoPath) {
          this.fileService.getPresignedUrl$(logoPath).subscribe({ next: (url) => this.logoPreviewUrl = url, error: () => this.logoPreviewUrl = null });
        }
        this.loaded = true;
        // Appliquer le thème seulement après chargement effectif
        this.applyTheme();
      },
      error: (err) => {
        this.toastService.showErrorToast('UI settings', 'Erreur chargement des paramètres UI');
      }
    });

    // No continuous form subscription — export/preview/save are manual actions.
  }


  private loadDataInForm(ui: any) {
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
    // ...
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
        background_color: template.background_color ?? '#ffffff',
        banner_bg: template.banner_bg ?? ui?.banner_bg ?? ui?.header_bg ?? '#2e332d',
        banner_text_color: template.banner_text_color ?? ui?.banner_text_color ?? ui?.header_text_color ?? '#ffffff',
        banner_font: template.banner_font ?? ui?.banner_font ?? ui?.title_font ?? 'Emblema One, cursive',
        navbar_bg: template.navbar_bg ?? ui?.navbar_bg ?? '#3f493d',
        navbar_text_color: template.navbar_text_color ?? ui?.navbar_text_color ?? '#ffffff',
        navbar_font: template.navbar_font ?? ui?.navbar_font ?? ui?.main_font ?? 'Amarante, serif',
        content_bg: template.content_bg ?? ui?.content_bg ?? '#ffffff',
        content_text_color: template.content_text_color ?? ui?.content_text_color ?? '#222222',
        content_font: template.content_font ?? ui?.content_font ?? 'Amarante, serif'
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
      thumbnail: {
        width: ui?.thumbnail?.width ?? 300,
        height: ui?.thumbnail?.height ?? 200,
        ratio: ui?.thumbnail?.ratio ?? 1.78
      },
      default_tournament_image: inferredDefault ?? (ui?.default_tournament_image ?? ''),
      frontBannerEnabled: ui?.frontBannerEnabled ?? false,
      homepage_intro: ui?.homepage_intro ?? '',
      email: {
        tagline: ui?.email?.tagline ?? 'Votre club de bridge convivial et dynamique',
        ccEmail: ui?.email?.ccEmail ?? ''
      },
      competitions: {
        preferred_organizations: {
          ["comite"]: ui?.competitions?.preferred_organizations?.comite || 'Comité des Pyrénées',
          ["ligue"]: ui?.competitions?.preferred_organizations?.ligue || 'Ligue 06 LR-PY',
          ["national"]: ui?.competitions?.preferred_organizations?.national || 'FFB'
        },
        // Les autres champs sont patchés ci-dessous
        show_members_only: ui?.competitions?.show_members_only ?? false,
        one_year_back: ui?.competitions?.one_year_back ?? false,
        show_infos: ui?.competitions?.show_infos ?? false,
        no_filter: ui?.competitions?.no_filter ?? false
      } as CompetitionsUIConfig,
      brand_bg: ui?.brand_bg ?? '#2e332d',
    });

    // Patch result_filter_thresholds séparément pour garantir la synchro avec le FormGroup enfant
    const thresholds = (COMPETITION_DIVISIONS as string[]).reduce((acc: { [key: string]: number }, d: string) => {
      acc[d] = ui?.competitions?.result_filter_thresholds?.[d] ?? 0;
      return acc;
    }, {});
    const thresholdsGroup = this.uiForm.get(['competitions', 'result_filter_thresholds']) as FormGroup;
    if (thresholdsGroup) {
      thresholdsGroup.patchValue(thresholds);
    }

    // Patch card_thumbnails array
    const cardThumbs = Array.isArray(ui?.card_thumbnails) && ui.card_thumbnails.length
      ? ui.card_thumbnails
      : [{ width: 300, height: 200, ratio: 1.78 }];
    const cardThumbsArray = this.uiForm.get('card_thumbnails') as FormArray;
    cardThumbsArray.clear();
    cardThumbs.forEach((thumb: any) => {
      const width = Number(thumb.width) || 1;
      const height = Number(thumb.height) || 1;
      const ratio = Number((width / height).toFixed(2));
      this.addCardThumbnail(width, height, ratio);
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
      
      // template est déjà bien structuré dans formVal
      // Juste vérifier qu'on ne garde pas de champs legacy au niveau racine
      delete payload.header_bg;
      delete payload.header_text_color;
      delete payload.footer_bg;
      delete payload.footer_text_color;
      delete payload.main_font;
      delete payload.title_font;
      
      // Build payload ensuring tournaments/news breakpoints are nested under `homepage`
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
        payload.tournaments_type = {};
        if (payload.default_tournament_image) payload.tournaments_type['defaut'] = payload.default_tournament_image;
      }
      payload.homepage = { ...(formVal.homepage || {}) };
      payload.homepage.tournaments_row_cols = formVal.tournaments_row_cols;
      payload.homepage.news_row_cols = formVal.news_row_cols;
      if (formVal.read_more_lines !== undefined) payload.homepage.read_more_lines = formVal.read_more_lines;
      if (formVal.unfold_on_hover !== undefined) payload.homepage.unfold_on_hover = !!formVal.unfold_on_hover;
      if (formVal.hover_unfold_delay_ms !== undefined) payload.homepage.hover_unfold_delay_ms = Number(formVal.hover_unfold_delay_ms);
      if (formVal.hover_unfold_duration_ms !== undefined) payload.homepage.hover_unfold_duration_ms = Number(formVal.hover_unfold_duration_ms);
      if (formVal.home_layout_ratio !== undefined) payload.homepage.home_layout_ratio = Number(formVal.home_layout_ratio);

      // Préserver explicitement le champ email
      if (formVal.email !== undefined) {
        payload.email = formVal.email;
      }

      // Ajout des paramètres competitions dans le payload
      payload.competitions = {
        preferred_organizations: {
          ["comite"]: formVal.competitions?.preferred_organizations?.comite || 'Comité des Pyrenees',
          ["ligue"]: formVal.competitions?.preferred_organizations?.ligue || 'Ligue 06 LR-PY',
          ["national"]: formVal.competitions?.preferred_organizations?.national || 'FFB'
        },
        result_filter_thresholds: formVal.competitions?.result_filter_thresholds && typeof formVal.competitions.result_filter_thresholds.get === 'function'
          ? Object.fromEntries(Object.entries(formVal.competitions.result_filter_thresholds.controls).map(([k, v]: [string, any]) => [k, v.value]))
          : formVal.competitions?.result_filter_thresholds || {},
        show_members_only: formVal.competitions?.show_members_only ?? false,
        one_year_back: formVal.competitions?.one_year_back ?? false,
        show_infos: formVal.competitions?.show_infos ?? false,
        no_filter: formVal.competitions?.no_filter ?? false
      } as CompetitionsUIConfig;

      // Ajout brand_bg
      payload.brand_bg = formVal.brand_bg;

      // Save UI settings into dedicated file and publish immédiatement
      await this.systemDataService.save_ui_settings(payload);
      // Le subscribe initial à get_ui_settings() sera notifié et mettra à jour l'UI
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
      // Template est déjà bien structuré dans formVal
      preview.template = formVal.template || {};
      this.systemDataService.patchUiSettings(preview);
      // Update export blob to reflect the previewed state
      this.export_file_url = this.fileService.json_to_blob(preview);
      this.toastService.showInfo('UI settings', 'Aperçu appliqué');
    } catch (e: any) {
      this.toastService.showErrorToast('UI settings', 'Erreur affichage de l\'aperçu');
    }
  }



  applyTheme() {
    const bannerFont = this.uiForm.get('template.banner_font')?.value || 'Emblema One, cursive';
    const navbarFont = this.uiForm.get('template.navbar_font')?.value || 'Amarante, serif';
    const contentFont = this.uiForm.get('template.content_font')?.value || 'Amarante, serif';
    const contentBg = this.uiForm.get('template.content_bg')?.value || '#ffffff';
    const contentText = this.uiForm.get('template.content_text_color')?.value || '#222222';
    const main = this.uiForm.get('main_color')?.value || '#3f493d';
    const secondary = this.uiForm.get('secondary_color')?.value || '#ffc107';
    document.documentElement.style.setProperty('--primary', main);
    document.documentElement.style.setProperty('--secondary', secondary);
    document.documentElement.style.setProperty('--banner-font', bannerFont);
    document.documentElement.style.setProperty('--navbar-font', navbarFont);
    document.documentElement.style.setProperty('--content-font', contentFont);
    document.documentElement.style.setProperty('--content-bg', contentBg);
    document.documentElement.style.setProperty('--content-text', contentText);
  }

}


