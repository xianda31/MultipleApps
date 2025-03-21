import { Injectable } from '@angular/core';
import { downloadData, uploadData } from 'aws-amplify/storage';
import { SystemConfiguration } from '../system-conf.interface';
import { BehaviorSubject, from, map, Observable, switchMap, tap } from 'rxjs';
import { ToastService } from '../toaster/toast.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Balance_sheet, Liquidities } from '../accounting.interface';



@Injectable({
  providedIn: 'root'
})
export class SystemDataService {
  private _system_configuration !: SystemConfiguration;
  private _system_configuration$: BehaviorSubject<SystemConfiguration> = new BehaviorSubject(this._system_configuration);
  constructor(
    private toastService: ToastService,
    private sanitizer: DomSanitizer

  ) { }

  // S3 download / upload


  get_configuration(): Observable<SystemConfiguration> {

    let remote_load$ = from(this.download_configuration('system/system_configuration.txt')).pipe(
      tap((conf) => {
        this._system_configuration = conf;
        this._system_configuration$.next(this._system_configuration);
        if (this.trace_on()) console.log(' configuration from S3', this._system_configuration);
      }),
      switchMap(() => this._system_configuration$.asObservable())
    );

    return (this._system_configuration !== undefined) ? this._system_configuration$.asObservable() : remote_load$;
  }

  get_balance_history(): Observable<Balance_sheet[]> {
    return from(this.download_balance_history('accounting/balance_history.txt'));
  }


  select_sheet() {
    // this.other_seasons = this.seasons.filter((season) => season !== this.selected_season);
  }

  get_balance_sheet_initial_amounts(season: string): Observable<Liquidities> {
    return this.get_balance_history().pipe(
      map((balance_sheets: Balance_sheet[]) => {
        let prev_balance_sheet = balance_sheets.find((sheet) => sheet.season === this.previous_season(season));
        return prev_balance_sheet ? prev_balance_sheet.liquidities : { cash: 0, bank: 0, savings: 0 };
      }),
    );
  }


  save_balance_history(balance_sheets: Balance_sheet[]) {
    const json = JSON.stringify(balance_sheets);
    const blob = new Blob([json], { type: 'text/plain' });
    const file = new File([blob], 'balance_history.txt');
    this.upload(blob, 'accounting/', file).then((data) => {
    }
    );
  }

  async save_configuration(conf: SystemConfiguration) {
    const json = JSON.stringify(conf);
    const blob = new Blob([json], { type: 'text/plain' });
    const file = new File([blob], 'system_configuration.txt');
    this.upload(blob, 'system/', file).then((data) => {
    });
  }

  private async upload(blob: any, directory: string, file: File) {
    let promise = new Promise((resolve, reject) => {
      uploadData({
        data: blob,
        path: directory + file.name,
        // bucket: 'publicBucket'
        options: {
          contentType: 'text/plain;charset=utf-8',
          metadata: { customKey: 'bcsto' },
        }
      }).result
        .then((result) => {
          this.toastService.showSuccessToast(file.name, 'sauvegarde réussie');
          resolve(result);
        })
        .catch((error) => {
          console.log('error', error);
          this.toastService.showErrorToast(file.name, 'erreur de chargement');
          reject(error);
        });
    });
    return promise;
  }


  private async download_configuration(path: string): Promise<any> {
    let promise = new Promise<any>((resolve, reject) => {
      downloadData({
        path: path,
      }).result
        .then(async (result) => {
          const data = JSON.parse(await result.body.text());
          const { charge_accounts, product_accounts, ...sys_conf } = data;
          resolve(sys_conf);
        })
        .catch((error) => {
          reject(error);
        });
    });
    return promise;
  }

  private async download_balance_history(path: string): Promise<Balance_sheet[]> {
    let promise = new Promise<any>((resolve, reject) => {
      downloadData({
        path: path,
      }).result
        .then(async (result) => {
          const data = JSON.parse(await result.body.text());
          // console.log('%s : downloaded data', path, data);
          resolve(data as Balance_sheet[]);
        })
        .catch((error) => {
          reject(error);
        });
    });
    return promise;
  }

  // local file download / upload

  get_file_url(conf: any): SafeResourceUrl {
    const json = JSON.stringify(conf);
    const blob = new Blob([json], { type: 'text/plain' });

    return this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));
  }

  // utilities functions

  trace_on() {
    return this._system_configuration.dev_mode === 'trace';
  }

  get_season(date: Date): string {
    const month = date.getMonth();
    const year = date.getFullYear();
    if (month < 7) return `${year - 1}-${year}`;
    return `${year}-${year + 1}`;
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
    } else {
      for (let i = 1; i <= month; i++) {
        let m = (i).toString().padStart(2, '0');
        months.push(year.toString().slice(-2) + '-' + m);
      }
    }
    return months;

  }

  previous_season(season: string) {
    return (+season.slice(0, 4) - 1).toString() + '-' + (+season.slice(0, 4)).toString();
  }


}
