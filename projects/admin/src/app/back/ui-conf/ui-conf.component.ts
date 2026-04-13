import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';
import { FileService, S3_ROOT_FOLDERS } from '../../common/services/files.service';
import { map, Observable, first, catchError, of, Subscription } from 'rxjs';
import { CompetitionsUIConfig } from '../../common/interfaces/ui-conf.interface';
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
    { label: 'Pacifico', css: 'Pacifico, cursive' }
  ];
  // Track injected Google fonts to limit total injected fonts
  private injectedGoogleFonts = new Set<string>();
  uiForm!: FormGroup;
  loaded = false;
  export_file_url: any;
  logoPreviewUrl: string | null = null;
  imageClubPreviewUrl: string | null = null;
  // inline SVG data URI used as a local placeholder to avoid external network requests
  placeholderImageUrl = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect fill='%23e0e0e0' width='100%25' height='100%25'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='10' fill='%23666'>No%20image</text></svg>";
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
        banner: this.fb.group({
          bg: ['#2e332d'],
          text_color: ['#ffffff']
        }),
        navbar: this.fb.group({
          bg: ['#3f493d'],
          text_color: ['#ffffff']
        }),
        content: this.fb.group({
          bg: ['#ffffff'],
          text_color: ['#222222']
        }),
        footer: this.fb.group({
          bg: ['#ffffff'],
          text_color: ['#000000']
        }),
        club: this.fb.group({
          font: ['Roboto, serif'],
          name: [''],
          logo: [''],
          image: ['']
        }),
        card_thumbnails: this.fb.array([]),
        album_thumbnail: this.fb.group({
          width: [600],
          height: [400],
          ratio: [1.5]
        }),
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
          comite: ['Comité des Pyrenees'],
          ligue: ['Ligue 06 LR-PY'],
          national: ['FFB']
        }),
        result_filter_thresholds: this.fb.group({}),
        show_infos: [false]
      }),
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
    return this.uiForm.get(['template', 'card_thumbnails']) as FormArray;
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
        const logoPath = ui?.template?.club?.logo ?? (ui as any)?.template?.logo ?? (ui as any)?.template?.logo_club_path ?? (ui as any)?.template?.logo_path;
        if (logoPath) {
          this.fileService.getPresignedUrl$(logoPath).subscribe({ next: (url) => this.logoPreviewUrl = url, error: () => this.logoPreviewUrl = null });
        } else {
          this.logoPreviewUrl = null;
        }
        const imagePath = ui?.template?.club?.image ?? (ui as any)?.template?.image ?? (ui as any)?.template?.image_club_path ?? '';
        if (imagePath) {
          this.fileService.getPresignedUrl$(imagePath).subscribe({ next: (url) => this.imageClubPreviewUrl = url, error: () => this.imageClubPreviewUrl = null });
        } else {
          this.imageClubPreviewUrl = null;
        }
        this.loaded = true;
        // Appliquer le thème seulement après chargement effectif
        this.applyTheme();
      },
      error: (err) => {
        this.toastService.showError('UI settings', 'Erreur chargement des paramètres UI');
      }
    });

  }


  private loadDataInForm(ui: any) {
    // Correction globale des accents mal encodés sur tout l'objet ui
    ui = this.fixAllBrokenAccents(ui);
    // Patch form with defaults (support both legacy top-level keys and new `homepage` nesting)
    // homepage and breakpoints are required in the interface; use defaults if absent
    const tournaments = (ui && ui.homepage && ui.homepage.tournaments_row_cols)
      ? ui.homepage.tournaments_row_cols
      : { SM: 1, MD: 2, LG: 4, XL: 6 };
    const news = (ui && ui.homepage && ui.homepage.news_row_cols)
      ? ui.homepage.news_row_cols
      : { SM: 1, MD: 2, LG: 4, XL: 6 };
    const template = ui?.template || {};
    // IMPORTANT: deep copy to avoid mutating the original object in BehaviorSubject cache
    const tournamentsType: { [key: string]: string } = { ...(ui?.tournaments_type || {}) };
    // ...
    const homepage = ui?.homepage || {};
    // Support legacy/default stored in tournaments_type under several possible keys
    const defaultKeys = ['defaut', 'défaut', 'default', '__default__', 'fallback'];
    let inferredDefault: string | undefined = ui?.default_tournament_image;
    for (const dk of defaultKeys) {
      if (!inferredDefault && tournamentsType[dk]) {
        inferredDefault = tournamentsType[dk];
        // remove from mapping so it doesn't appear as a regular mapping row (safe: we're mutating a copy)
        delete tournamentsType[dk];
      }
    }

    this.uiForm.patchValue({
      template: {
        banner: {
          bg: template?.banner?.bg ?? template?.banner_bg ?? ui?.banner_bg ?? ui?.header_bg ?? '#2e332d',
          text_color: template?.banner?.text_color ?? template?.banner_text_color ?? ui?.banner_text_color ?? ui?.header_text_color ?? '#ffffff'
        },
        navbar: {
          bg: template?.navbar?.bg ?? template?.navbar_bg ?? ui?.navbar_bg ?? '#3f493d',
          text_color: template?.navbar?.text_color ?? template?.navbar_text_color ?? ui?.navbar_text_color ?? '#ffffff'
        },
        content: {
          bg: template?.content?.bg ?? template?.content_bg ?? ui?.content_bg ?? '#ffffff',
          text_color: template?.content?.text_color ?? template?.content_text_color ?? ui?.content_text_color ?? '#222222'
        },
        footer: {
          bg: template.footer?.bg ?? '#ffffff',
          text_color: template.footer?.text_color ?? '#000000'
        },
        club: {
          font: template.club?.font ?? template.site_font ?? template.navbar_font ?? template.content_font ?? template.banner_font ?? ui?.main_font ?? 'Amarante, serif',
          name: template.club?.name ?? template.site?.name ?? ui?.site_name ?? '',
          logo: template.club?.logo ?? (template as any).logo_club_path ?? (template as any).logo_path ?? (template as any).logo ?? '',
          image: template.club?.image ?? (template as any).image_club_path ?? (template as any).image ?? ''
        }
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
        show_infos: ui?.competitions?.show_infos ?? false,
      } as CompetitionsUIConfig
    });

    // Force la mise à jour des contrôles du template pour synchroniser les inputs color
    const templateGroup = this.uiForm.get('template');
    if (templateGroup) {
      templateGroup.updateValueAndValidity();
      Object.keys(templateGroup.value).forEach(key => {
        const control = templateGroup.get(key);
        control?.updateValueAndValidity({ emitEvent: true });
      });
    }

    // Ensure `template.club` controls are explicitly set (robust against unexpected patchValue mismatches)
    try {
      const clubGroup = this.uiForm.get(['template', 'club']) as FormGroup | null;
      if (clubGroup) {
        const clubFont = template?.club?.font ?? template?.site_font ?? template?.navbar_font ?? ui?.main_font ?? 'Amarante, serif';
        const clubName = template?.club?.name ?? template?.site?.name ?? ui?.site_name ?? '';
        const clubLogo = template?.club?.logo ?? (template as any).logo_club_path ?? (template as any).logo_path ?? (template as any).logo ?? '';
        const clubImage = template?.club?.image ?? (template as any).image_club_path ?? (template as any).image ?? '';
        clubGroup.get('font')?.setValue(clubFont, { emitEvent: false });
        clubGroup.get('name')?.setValue(clubName, { emitEvent: false });
        clubGroup.get('logo')?.setValue(clubLogo, { emitEvent: false });
        clubGroup.get('image')?.setValue(clubImage, { emitEvent: false });
      }
    } catch (e) {
      // non-fatal — keep going
    }

    // Patch result_filter_thresholds séparément pour garantir la synchro avec le FormGroup enfant
    const thresholds = (COMPETITION_DIVISIONS as string[]).reduce((acc: { [key: string]: number }, d: string) => {
      acc[d] = ui?.competitions?.result_filter_thresholds?.[d] ?? 0;
      return acc;
    }, {});
    const thresholdsGroup = this.uiForm.get(['competitions', 'result_filter_thresholds']) as FormGroup;
    if (thresholdsGroup) {
      thresholdsGroup.patchValue(thresholds);
    }

    // Patch card_thumbnails array (stored under `template`)
    const cardThumbs = Array.isArray(ui?.card_thumbnails) && ui.card_thumbnails.length
      ? ui.card_thumbnails
      : [{ width: 300, height: 200, ratio: 1.78 }];
    const cardThumbsArray = this.uiForm.get(['template', 'card_thumbnails']) as FormArray;
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
    // Use a stable filename so uploads replace the existing S3 object (no timestamp)
    const filenameOnly = `logo.jpg`;
    const path = `${S3_ROOT_FOLDERS.SYSTEM}/${filenameOnly}`;
    try {
      // Create a new File instance with the chosen stable name so upload_file uses it
      const fileToUpload = new File([file], filenameOnly, { type: 'image/jpeg' });
      await this.fileService.upload_file(fileToUpload, S3_ROOT_FOLDERS.SYSTEM + '/');
      this.uiForm.get('template.club.logo')?.setValue(path);
      this.fileService.getPresignedUrl$(path).subscribe({ next: (url) => this.logoPreviewUrl = url, error: () => this.logoPreviewUrl = null });
      this.toastService.showSuccess('UI settings', 'Logo uploaded');
    } catch (e: any) {
      this.toastService.showError('UI settings', 'Erreur upload du logo');
    }
  }

  async onImageFileSelected(event: any) {
    const file: File = event.target.files?.[0];
    if (!file) return;
    // Use a stable filename so uploads replace the existing S3 object (no timestamp)
    const filenameOnly = `image_club.jpg`;
    const path = `${S3_ROOT_FOLDERS.SYSTEM}/${filenameOnly}`;
    try {
      const fileToUpload = new File([file], filenameOnly, { type: 'image/jpeg' });
      await this.fileService.upload_file(fileToUpload, S3_ROOT_FOLDERS.SYSTEM + '/');
      this.uiForm.get('template.club.image')?.setValue(path);
      this.fileService.getPresignedUrl$(path).subscribe({ next: (url) => this.imageClubPreviewUrl = url, error: () => this.imageClubPreviewUrl = null });
      this.toastService.showSuccess('UI settings', 'Image club uploaded');
    } catch (e: any) {
      this.toastService.showError('UI settings', 'Erreur upload de l\'image club');
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
      this.toastService.showError('UI settings', 'Erreur lecture du fichier');
    }
  }

  async saveSettings() {
    try {
      const formVal: any = this.uiForm.value || {};

      // Build clean payload conforming STRICTLY to UIConfiguration interface
      // Convert tournaments_type FormArray (array [{key,image},...]) into mapping { key: image }
      const tournamentsTypeMap: { [k: string]: string } = {};
      if (Array.isArray(formVal.tournaments_type)) {
        formVal.tournaments_type.forEach((entry: any) => {
          if (entry && entry.key) tournamentsTypeMap[entry.key] = entry.image || '';
        });
      }
      // If default_tournament_image is set, store it under the forced key 'defaut'
      if (formVal.default_tournament_image) {
        tournamentsTypeMap['defaut'] = formVal.default_tournament_image;
      }

      // Build payload with ONLY fields from UIConfiguration interface
      const payload: any = {
        template: {
          banner: {
            bg: formVal.template?.banner?.bg || '#2e332d',
            text_color: formVal.template?.banner?.text_color || '#ffffff'
          },
          navbar: {
            bg: formVal.template?.navbar?.bg || '#3f493d',
            text_color: formVal.template?.navbar?.text_color || '#ffffff'
          },
          content: {
            bg: formVal.template?.content?.bg || '#ffffff',
            text_color: formVal.template?.content?.text_color || '#222222'
          },
          footer: {
            bg: formVal.template?.footer?.bg || '#ffffff',
            text_color: formVal.template?.footer?.text_color || '#000000'
          },
          club: {
            font: formVal.template?.club?.font || formVal.template?.site_font || 'Amarante, serif',
            name: formVal.template?.club?.name || '',
            logo: formVal.template?.club?.logo || formVal.template?.logo_club_path || '',
            image: formVal.template?.club?.image || formVal.template?.image_club_path || ''
          },
          // backward-compatible aliases used by other parts of the app
          site_font: formVal.template?.club?.font || formVal.template?.site_font || 'Amarante, serif',
          logo_club_path: formVal.template?.club?.logo || formVal.template?.logo_club_path || '',
          image_club_path: formVal.template?.club?.image || formVal.template?.image_club_path || ''
        },
        homepage: {
          tournaments_row_cols: formVal.tournaments_row_cols || { SM: 1, MD: 2, LG: 4, XL: 6 },
          news_row_cols: formVal.news_row_cols || { SM: 1, MD: 2, LG: 4, XL: 6 },
          read_more_lines: formVal.read_more_lines ?? 3,
          unfold_on_hover: !!formVal.unfold_on_hover,
          hover_unfold_delay_ms: Number(formVal.hover_unfold_delay_ms) || 500,
          hover_unfold_duration_ms: Number(formVal.hover_unfold_duration_ms) || 300,
          home_layout_ratio: formVal.home_layout_ratio ?? 2
        },
        tournaments_type: tournamentsTypeMap,
        default_tournament_image: formVal.default_tournament_image || '',
        frontBannerEnabled: !!formVal.frontBannerEnabled,
        homepage_intro: formVal.homepage_intro || '',
        email: {
          tagline: formVal.email?.tagline || 'Votre club de bridge convivial et dynamique',
          ccEmail: formVal.email?.ccEmail || ''
        },
        card_thumbnails: Array.isArray(formVal.template?.card_thumbnails) && formVal.template.card_thumbnails.length
          ? formVal.template.card_thumbnails.map((t: any) => ({ width: Number(t.width), height: Number(t.height) }))
          : [{ width: 300, height: 200 }],
        album_thumbnail: {
          width: Number(formVal.template?.album_thumbnail?.width) || 600,
          height: Number(formVal.template?.album_thumbnail?.height) || 400
        },
        album_carousel_interval_ms: Number(formVal.album_carousel_interval_ms) || 5000,
        competitions: {
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
        } as CompetitionsUIConfig
      };

      // Save UI settings into dedicated file and publish immédiatement
      console.log('Saving UI settings with payload:', payload);
      await this.systemDataService.save_ui_settings(payload);
      // Le subscribe initial à get_ui_settings() sera notifié et mettra à jour l'UI
    } catch (e: any) {
      this.toastService.showError('UI settings', e?.message || 'Erreur sauvegarde');
    }
  }

  previewSettings() {
    try {
      const formVal: any = this.uiForm.value || {};

      // Build clean preview conforming to UIConfiguration interface (same as saveSettings)
      const tournamentsTypeMap: { [k: string]: string } = {};
      if (Array.isArray(formVal.tournaments_type)) {
        formVal.tournaments_type.forEach((entry: any) => {
          if (entry && entry.key) tournamentsTypeMap[entry.key] = entry.image || '';
        });
      }
      if (formVal.default_tournament_image) {
        tournamentsTypeMap['defaut'] = formVal.default_tournament_image;
      }

      const preview: any = {
        template: {
          banner: {
            bg: formVal.template?.banner?.bg || '#2e332d',
            text_color: formVal.template?.banner?.text_color || '#ffffff'
          },
          navbar: {
            bg: formVal.template?.navbar?.bg || '#3f493d',
            text_color: formVal.template?.navbar?.text_color || '#ffffff'
          },
          content: {
            bg: formVal.template?.content?.bg || '#ffffff',
            text_color: formVal.template?.content?.text_color || '#222222'
          },
          footer: {
            bg: formVal.template?.footer?.bg || '#ffffff',
            text_color: formVal.template?.footer?.text_color || '#000000'
          },
          club: {
            font: formVal.template?.club?.font || formVal.template?.site_font || 'Amarante, serif',
            name: formVal.template?.club?.name || '',
            logo: formVal.template?.club?.logo || formVal.template?.logo_club_path || '',
            image: formVal.template?.club?.image || formVal.template?.image_club_path || ''
          },
          // backward-compatible aliases
          site_font: formVal.template?.club?.font || formVal.template?.site_font || 'Amarante, serif',
          logo_club_path: formVal.template?.club?.logo || formVal.template?.logo_club_path || '',
          image_club_path: formVal.template?.club?.image || formVal.template?.image_club_path || ''
        },
        homepage: {
          tournaments_row_cols: formVal.tournaments_row_cols || { SM: 1, MD: 2, LG: 4, XL: 6 },
          news_row_cols: formVal.news_row_cols || { SM: 1, MD: 2, LG: 4, XL: 6 },
          read_more_lines: formVal.read_more_lines ?? 3,
          unfold_on_hover: !!formVal.unfold_on_hover,
          hover_unfold_delay_ms: Number(formVal.hover_unfold_delay_ms) || 500,
          hover_unfold_duration_ms: Number(formVal.hover_unfold_duration_ms) || 300,
          home_layout_ratio: formVal.home_layout_ratio ?? 2
        },
        tournaments_type: tournamentsTypeMap,
        default_tournament_image: formVal.default_tournament_image || '',
        frontBannerEnabled: !!formVal.frontBannerEnabled,
        homepage_intro: formVal.homepage_intro || '',
        email: {
          tagline: formVal.email?.tagline || 'Votre club de bridge convivial et dynamique',
          ccEmail: formVal.email?.ccEmail || ''
        },
        card_thumbnails: Array.isArray(formVal.template?.card_thumbnails) && formVal.template.card_thumbnails.length
          ? formVal.template.card_thumbnails.map((t: any) => ({ width: Number(t.width), height: Number(t.height) }))
          : [{ width: 300, height: 200 }],
        album_thumbnail: {
          width: Number(formVal.template?.album_thumbnail?.width) || 600,
          height: Number(formVal.template?.album_thumbnail?.height) || 400
        },
        album_carousel_interval_ms: Number(formVal.album_carousel_interval_ms) || 5000,
        competitions: {
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
        } as CompetitionsUIConfig
      };

      this.systemDataService.patchUiSettings(preview);
      // Update export blob to reflect the previewed state
      this.export_file_url = this.fileService.json_to_blob(preview);
      this.toastService.showInfo('UI settings', 'Aperçu appliqué');
    } catch (e: any) {
      this.toastService.showError('UI settings', 'Erreur affichage de l\'aperçu');
    }
  }



  applyTheme() {
    const siteFont = this.uiForm.get(['template','club','font'])?.value || this.uiForm.get('template.site_font')?.value || this.uiForm.get('template')?.get('site_font')?.value || 'Amarante, serif';
    const contentBg = this.uiForm.get('template.content')?.get('bg')?.value || this.uiForm.get('template')?.get(['content', 'bg'])?.value || '#ffffff';
    const contentText = this.uiForm.get('template.content')?.get('text_color')?.value || this.uiForm.get('template')?.get(['content', 'text_color'])?.value || '#222222';

    // Load single site Google Font dynamically
    if (siteFont) this.loadGoogleFont(siteFont);

    // Set CSS variables: keep backward-compatible per-section vars mapped to site font
    document.documentElement.style.setProperty('--site-font', siteFont);
    document.documentElement.style.setProperty('--banner-font', siteFont);
    document.documentElement.style.setProperty('--navbar-font', siteFont);
    document.documentElement.style.setProperty('--content-font', siteFont);
    document.documentElement.style.setProperty('--content-bg', contentBg);
    document.documentElement.style.setProperty('--content-text', contentText);
  }

  private loadGoogleFont(fontCss: string) {
    // Extract font family name from CSS string (e.g., "Quicksand, sans-serif" -> "Quicksand")
    const fontName = fontCss.split(',')[0].trim();
    // Normalize key used in DOM and tracking
    const normalized = fontName.replace(/\s+/g, '-').toLowerCase();

    // If already injected, skip
    if (this.injectedGoogleFonts.has(normalized)) return;

    // Check if font link already exists in DOM (robustness)
    const linkId = `google-font-${normalized}`;
    if (document.getElementById(linkId)) {
      this.injectedGoogleFonts.add(normalized);
      return; // Font already present in DOM
    }

    // Create and inject Google Fonts link
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}&display=swap`;
    document.head.appendChild(link);
    this.injectedGoogleFonts.add(normalized);
  }

  private fixBrokenAccents(str: string): string {
    if (!str) return str;
    return str
      .replace(/Ã©/g, 'é')
      .replace(/Ã¨/g, 'è')
      .replace(/Ãª/g, 'ê')
      .replace(/Ã«/g, 'ë')
      .replace(/Ã /g, 'à')
      .replace(/Ã¢/g, 'â')
      .replace(/Ã§/g, 'ç')
      .replace(/Ã¹/g, 'ù')
      .replace(/Ã»/g, 'û')
      .replace(/Ã¼/g, 'ü')
      .replace(/Ã´/g, 'ô')
      .replace(/Ã¶/g, 'ö')
      .replace(/Ã®/g, 'î')
      .replace(/Ã¯/g, 'ï')
      .replace(/Ãª/g, 'ê')
      .replace(/Ã‰/g, 'É')
      .replace(/Ã€/g, 'À')
      .replace(/Ã‹/g, 'Ë')
      .replace(/Ã”/g, 'Ô')
      .replace(/Ãœ/g, 'Ü')
      .replace(/Ã›/g, 'Û')
      .replace(/ÃŸ/g, 'ß')
      .replace(/Ã±/g, 'ñ')
      .replace(/Ã³/g, 'ó')
      .replace(/Ã¡/g, 'á')
      .replace(/Ã­/g, 'í')
      .replace(/Ãº/g, 'ú')
      .replace(/Ã‘/g, 'Ñ');
  }

  private fixAllBrokenAccents(obj: any): any {
    if (typeof obj === 'string') return this.fixBrokenAccents(obj);
    if (Array.isArray(obj)) return obj.map(v => this.fixAllBrokenAccents(v));
    if (typeof obj === 'object' && obj !== null) {
      const out: any = {};
      for (const k of Object.keys(obj)) {
        out[this.fixBrokenAccents(k)] = this.fixAllBrokenAccents(obj[k]);
      }
      return out;
    }
    return obj;
  }
}


