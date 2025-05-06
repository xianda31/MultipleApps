import { Injectable } from '@angular/core';
import { SystemConfiguration } from '../system-conf.interface';
import { BehaviorSubject, from, Observable, switchMap, tap } from 'rxjs';
import { FileService } from './files.service';



@Injectable({
  providedIn: 'root'
})
export class SystemDataService {
  private _system_configuration !: SystemConfiguration;
  private _system_configuration$: BehaviorSubject<SystemConfiguration> = new BehaviorSubject(this._system_configuration);
  constructor(
    private fileService: FileService,

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
    
    if(this._system_configuration !== undefined) {
      if (this.trace_on()) console.log(' configuration from cache', this._system_configuration);
      return this._system_configuration$.asObservable();
    }else {
      return remote_load$;
    }
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

  get_profit_and_loss_keys(): any {
    return this._system_configuration.profit_and_loss;
  }

  // around season and date 

  trace_on() {
    return this._system_configuration.trace_mode ;
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

  start_date(season: string): string {
    return season.slice(0, 4) + '-07-01';
  }

  date_in_season(date: string, season: string): boolean {
    let start_date = new Date(season.slice(0, 4) + '-07-01');
    let end_date = new Date(season.slice(5, 9) + '-06-30');
    let date_obj = new Date(date);
    return (date_obj >= start_date && date_obj <= end_date);
  }
}
