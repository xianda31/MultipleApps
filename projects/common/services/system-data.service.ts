import { Injectable } from '@angular/core';
import { SystemConfiguration } from '../system-conf.interface';
import { BehaviorSubject, catchError, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { Balance_sheet, Liquidities } from '../accounting.interface';
import { FileService } from './files.service';
import { formatDate } from '@angular/common';



@Injectable({
  providedIn: 'root'
})
export class SystemDataService {
  private _system_configuration !: SystemConfiguration;
  private _system_configuration$: BehaviorSubject<SystemConfiguration> = new BehaviorSubject(this._system_configuration);
  constructor(
    private fileService: FileService

  ) { }

  // S3 download / upload


  get_configuration(): Observable<SystemConfiguration> {

    let remote_load$ = from(this.fileService.download_json_file('system/system_configuration.txt')).pipe(
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
    return from(this.fileService.download_json_file('accounting/balance_history.txt')).pipe(
      map((data) => data as Balance_sheet[]),
      catchError((error) => {
        console.log('Error fetching balance history:', error);
        return of([] as Balance_sheet[]);
      })
    );
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
    return this.fileService.upload_to_S3(balance_sheets, 'accounting/', 'balance_history.txt')

  }

  async save_configuration(conf: SystemConfiguration) {
    this.fileService.upload_to_S3(conf, 'system/', 'system_configuration.txt').then((data) => {
    });
  }

  async to_next_season() {
    this._system_configuration.season = this.next_season(this._system_configuration.season);
    console.log('next season', this._system_configuration.season);
    this._system_configuration$.next(this._system_configuration);
    this.save_configuration(this._system_configuration);
  }


  // utilities functions

  trace_on() {
    return this._system_configuration.dev_mode === 'trace';
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
    } else {
      for (let i = 1; i <= month; i++) {
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

  closout_date(season: string): string {
    let date = new Date('01/07/' + season.slice(5, 9));
    return formatDate(date, 'yyyy-MM-dd', 'en')
    // return '01/07/' + season.slice(5, 9);
  }
}
