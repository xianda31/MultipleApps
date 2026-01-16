import { Injectable } from '@angular/core';
import { SystemConfiguration } from '../interfaces/system-conf.interface';
import { UIConfiguration } from '../interfaces/ui-conf.interface';
import { BehaviorSubject, from, Observable, switchMap, tap, catchError, of, combineLatest, map, first } from 'rxjs';
import { FileService } from './files.service';
import { ToastService } from './toast.service';
import { normalizeBreakpoints } from '../utils/ui-utils';



@Injectable({
  providedIn: 'root'
})
export class SystemDataService {
  private _system_configuration !: SystemConfiguration;
  private _system_configuration$: BehaviorSubject<SystemConfiguration> = new BehaviorSubject(this._system_configuration);
  // Separate UI settings cache and observable (stored in its own file)
  private _ui_settings: UIConfiguration | undefined;
  private _ui_settings$: BehaviorSubject<UIConfiguration | undefined> = new BehaviorSubject<UIConfiguration | undefined>(undefined);
  constructor(
    private fileService: FileService,
    private toastService: ToastService
  ) {
  }


   get_configuration(): Observable<SystemConfiguration> {

    let remote_load$ = from(this.fileService.download_json_file('system/system_configuration.txt')).pipe(
      tap((conf) => {
        this._system_configuration = conf;
        this._system_configuration$.next(this._system_configuration);
      }),
      switchMap(() => this._system_configuration$.asObservable())
    );
 
    return this._system_configuration ? of(this._system_configuration) : remote_load$;
  }

  /**
   * UI settings live methods: kept in a separate file `system/ui_settings.txt`.
   */
  get_ui_settings(): Observable<UIConfiguration> {
    const defaults: UIConfiguration = this.getDefaultUi();

    // attempting to download system/ui_settings.txt
    const remote_load$ = from(this.fileService.download_json_file('system/ui_settings.txt')).pipe(
      tap((conf) => {
        // Simple load: expect `ui_settings.txt` to conform to `UIConfiguration`.
        this._ui_settings = conf;
        this._ui_settings$.next(this._ui_settings);
        try {
          // console.info('[SystemDataService] get_ui_settings(): loaded ui_settings', { timestamp: new Date().toISOString(), keys: Object.keys(conf || {}) });
        } catch (e) { /* ignore logging issues */ }
      }),
      catchError((err) => {
        // If the file does not exist or can't be read, initialize with defaults and warn the user.
        console.error('[SystemDataService] get_ui_settings(): failed to download or parse system/ui_settings.txt', err);
        this._ui_settings = defaults;
        try { this._ui_settings$.next(this._ui_settings); } catch (e) { /* ignore */ }
        try { this.toastService.showWarning('UI settings', 'Fichier ui_settings manquant — paramètres initialisés par défaut'); } catch (e) { /* ignore */ }
        return of(this._ui_settings);
      }),
      switchMap(() => this._ui_settings$.asObservable())
    );

    if (this._ui_settings !== undefined) {
      // cast is safe: observable may emit undefined initially but callers expect UIConfiguration; ensure subscribers handle undefined if needed
      return this._ui_settings$.asObservable() as Observable<UIConfiguration>;
    } else {
      return remote_load$ as Observable<UIConfiguration>;
    }
  }

  /**
   * Observable of the tournaments_type mapping: { [key]: imagePath }
   */
  tournamentsType$(): Observable<{ [key: string]: string }> {
    return this.get_ui_settings().pipe(
      switchMap((ui) => of((ui && ui.tournaments_type) ? ui.tournaments_type : {}))
    );
  }

  /**
   * Given a tournament keyword, return an observable that emits a presigned URL string or null.
   * This looks up the configured image path from `tournaments_type` and asks FileService for a presigned URL.
   */
  imageForTournament$(keyword: string): Observable<string | null> {
    if (!keyword) return of(null);
    return this.tournamentsType$().pipe(
      switchMap((map) => {
        const p = map ? map[keyword] : undefined;
        if (!p) return of(null);
        return this.fileService.getPresignedUrl$(p).pipe(
          catchError(() => of(null))
        );
      })
    );
  }

  /**
   * Return a mapping of tournament key -> presigned URL (or null on failure).
   * Useful for components that want the ready-to-use URL for each keyword.
   */
  tournamentsTypeWithUrl$(): Observable<{ [key: string]: string | null }> {
    // Use full UI settings so we can also resolve an explicit default image path if present.
    return this.get_ui_settings().pipe(
      switchMap((ui) => {
        const mapping = (ui && ui.tournaments_type) ? ui.tournaments_type : {};
        const entries = Object.entries(mapping || {});

        const pathObs = entries.map(([k, path]) =>
          this.fileService.getPresignedUrl$(path).pipe(
            map((url: string) => [k, url] as [string, string | null]),
            catchError(() => of([k, null] as [string, string | null]))
          )
        );

        // If a default image path is specified, resolve it too and include under key '__default__'
        const defaultPath = (ui && (ui as any).default_tournament_image) ? (ui as any).default_tournament_image : undefined;
        const defaultObs = defaultPath
          ? this.fileService.getPresignedUrl$(defaultPath).pipe(
              map((url: string) => ['__default__', url] as [string, string | null]),
              catchError(() => of(['__default__', null] as [string, string | null]))
            )
          : of(null);

        const allObs = defaultObs ? [...pathObs, defaultObs] : pathObs;

        if (allObs.length === 0) return of({} as { [key: string]: string | null });
        return combineLatest(allObs as any[]).pipe(
          map((pairs: Array<[string, string | null]>) => {
            const filtered = pairs.filter(Boolean) as Array<[string, string | null]>;
            return Object.fromEntries(filtered);
          })
        );
      })
    );
  }

  /**
   * Force a remote download of `system/ui_settings.txt` and update cache.
   * Useful to surface missing-file warnings immediately.
   */
  fetch_ui_settings(): Observable<UIConfiguration> {
    const remote$ = from(this.fileService.download_json_file('system/ui_settings.txt')).pipe(
      tap((conf) => {
        this._ui_settings = conf;
        // MAJ du BehaviorSubject pour tous les abonnés
        this._ui_settings$.next(this._ui_settings);
      }),
      catchError((err) => {
        const defaults: UIConfiguration = {
          template: { logo_path: '' },
          homepage: { tournaments_row_cols: { SM: 1, MD: 2, LG: 3, XL: 4 }, news_row_cols: { SM: 1, MD: 2, LG: 3, XL: 4 } },
          frontBannerEnabled: false,
          homepage_intro: '',
          email: { tagline: 'Votre club de bridge convivial et dynamique', ccEmail: '' },
          card_thumbnails: [],
          album_thumbnail: { width: 150, height: 150 }
        };
        console.error('[SystemDataService] fetch_ui_settings(): error fetching ui_settings', err);
        this._ui_settings = defaults;
        this._ui_settings$.next(this._ui_settings);
        try { this.toastService.showWarning('UI settings', 'Fichier ui_settings manquant — paramètres initialisés par défaut'); } catch (e) { /* ignore */ }
        return of(this._ui_settings as UIConfiguration);
      }),
      // On émet UNIQUEMENT la valeur fraîchement chargée
      map(() => this._ui_settings as UIConfiguration)
    );
    return remote$ as Observable<UIConfiguration>;
  }
  async save_ui_settings(ui: UIConfiguration) {
    // Merge incoming settings with current cache (shallow) and normalize breakpoints
    const existing = this._ui_settings || ({} as UIConfiguration);
    const merged: UIConfiguration = { ...(existing as any), ...(ui as any) } as UIConfiguration;
    // If the admin provided a full `tournaments_type` mapping, ensure it replaces the cached one
    try {
      if ((ui as any)?.tournaments_type !== undefined) {
        (merged as any).tournaments_type = (ui as any).tournaments_type;
      }
      if ((ui as any)?.default_tournament_image !== undefined) {
        (merged as any).default_tournament_image = (ui as any).default_tournament_image;
      }
      if ((ui as any)?.email !== undefined) {
        (merged as any).email = (ui as any).email;
      }
    } catch (e) { /* ignore */ }
    // Ensure breakpoints live under merged.homepage; accept legacy top-level keys
    (merged as any).homepage = (merged as any).homepage || {};
    const legacyT = (merged as any).tournaments_row_cols || (merged as any).homepage?.tournaments_row_cols;
    const legacyN = (merged as any).news_row_cols || (merged as any).homepage?.news_row_cols;
    (merged as any).homepage.tournaments_row_cols = normalizeBreakpoints(legacyT) as any;
    (merged as any).homepage.news_row_cols = normalizeBreakpoints(legacyN) as any;
    // remove legacy top-level keys
    if ((merged as any).tournaments_row_cols !== undefined) delete (merged as any).tournaments_row_cols;
    if ((merged as any).news_row_cols !== undefined) delete (merged as any).news_row_cols;

    this._ui_settings = merged;
    // Persist to S3 in background (log errors). If somehow _ui_settings is undefined,
    // use a safe default payload to avoid uploading the literal string "undefined".
    const payload = this._ui_settings ?? this.getDefaultUi();
    if (this._ui_settings === undefined) {
      console.warn('[SystemDataService] save_ui_settings(): _ui_settings undefined at persist time, using defaults');
    }
    try {
      await this.fileService.upload_to_S3(payload, 'system/', 'ui_settings.txt');
      // Only notify subscribers after successful upload
      this._ui_settings$.next(this._ui_settings);
    } catch (err) {
      console.warn('save_ui_settings: upload error', err);
      try { console.error('[SystemDataService] save_ui_settings(): upload_to_S3 failed', { err, timestamp: new Date().toISOString() }); } catch (e) { /* ignore */ }
    }
  }

  private getDefaultUi(): UIConfiguration {
    return {
      template: { logo_path: ''},
      homepage: { tournaments_row_cols: { SM: 1, MD: 2, LG: 3, XL: 4 }, news_row_cols: { SM: 1, MD: 2, LG: 3, XL: 4 } },
      frontBannerEnabled: false,
      homepage_intro: ''
    } as UIConfiguration;
  }


  async save_configuration(conf: SystemConfiguration) {
    // Update local cache and notify subscribers immediately so UI can react without waiting for S3 upload
    try {
      this._system_configuration = conf;
      try { this._system_configuration$.next(this._system_configuration); } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }
    // Persist to S3 in background. Ensure UI settings are NOT embedded into the system configuration file.
    try {
      const toUpload: any = { ...(conf as any) };
      if (toUpload.ui_settings !== undefined) delete toUpload.ui_settings;
      this.fileService.upload_to_S3(toUpload, 'system/', 'system_configuration.txt').then(() => {
      }).catch((err) => {
        console.warn('save_configuration: upload error', err);
      });
    } catch (e) {
      console.warn('save_configuration: unable to prepare payload', e);
    }
  }

  /**
   * Merge and publish UI settings locally without persisting immediately.
   * This allows live preview in the front-end while the admin edits settings.
   */
  patchUiSettings(ui: Partial<UIConfiguration>) {
    try {
      if (this._ui_settings === undefined || this._ui_settings === null) this._ui_settings = {} as UIConfiguration;
      // Merge and normalize breakpoints when present
      const mergedRaw = { ...(this._ui_settings || {}), ...(ui || {}) } as any;
      mergedRaw.homepage = mergedRaw.homepage || {};
      // support legacy top-level keys or nested homepage keys
      if ((ui as any)?.homepage?.tournaments_row_cols || (ui as any)?.tournaments_row_cols) {
        const t = (ui as any)?.homepage?.tournaments_row_cols || (ui as any)?.tournaments_row_cols;
        mergedRaw.homepage.tournaments_row_cols = normalizeBreakpoints(t);
      }
      if ((ui as any)?.homepage?.news_row_cols || (ui as any)?.news_row_cols) {
        const n = (ui as any)?.homepage?.news_row_cols || (ui as any)?.news_row_cols;
        mergedRaw.homepage.news_row_cols = normalizeBreakpoints(n);
      }
      // delete legacy top-level keys if any
      if (mergedRaw.tournaments_row_cols !== undefined) delete mergedRaw.tournaments_row_cols;
      if (mergedRaw.news_row_cols !== undefined) delete mergedRaw.news_row_cols;
      this._ui_settings = mergedRaw as UIConfiguration;
      try { this._ui_settings$.next(this._ui_settings); } catch (e) { /* ignore */ }
    } catch (e) {
      // ignore
    }
  }

  async change_to_new_season(season: string) {
    this._system_configuration.season = season;
    console.log('new season', this._system_configuration.season);
    this.save_configuration(this._system_configuration);
    // Note: save_configuration already publishes the updated configuration.
  }


  // utilities functions

  get_profit_and_loss_keys(): any {
    return this._system_configuration.profit_and_loss;
  }

  // around season and date 

  trace_on() {
    return this._system_configuration.trace_mode ;
  }

  get_today_season(): string {
    const today = new Date();
    return this.get_season(today);
  }

  get_season(date: Date): string {
    const month = 1 + date.getMonth();  // ! zero-based method ...
    const year = date.getFullYear();
    if (month < 7) return `${year - 1}/${year}`;
    return `${year}/${year + 1}`;
  }

  get_season_months(date: Date): string[] {
    const month = 1 + date.getMonth();
    const year = +date.getFullYear();
    let months: string[] = [];
    if (month <= 6) {
      for (let i = 7; i <= 12; i++) {
        let m = (i).toString().padStart(2, '0');
        months.push((year - 1).toString().slice(-2) + '-' + m);
      }
      for (let i = 1; i <= month; i++) {
        let m = (i).toString().padStart(2, '0');
        months.push(year.toString().slice(-2) + '-' + m);
      }
    }
    else {
      for (let i = 7; i <= month; i++) {
        let m = (i).toString().padStart(2, '0');
        months.push(year.toString().slice(-2) + '-' + m);
      }
    }
    return months;

  }

  previous_season(season: string) {
    return (+season.slice(0, 4) - 1).toString() + '/' + (+season.slice(0, 4)).toString();
  }

  next_season(season: string) {
    return (+season.slice(5, 9)).toString() + '/' + (+season.slice(5, 9) + 1).toString();
  }

  start_date(season: string): string {
    return season.slice(0, 4) + '-07-01';
  }

  last_date(season: string): string {
    return season.slice(5, 9) + '-06-30';
  }

  date_in_season(date: string, season: string): boolean {
    let start_date = new Date(season.slice(0, 4) + '-07-01');
    let end_date = new Date(season.slice(5, 9) + '-06-30');
    let date_obj = new Date(date);
    return (date_obj >= start_date && date_obj <= end_date);
  }
}
