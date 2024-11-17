import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable, of } from 'rxjs';
import { AuthentificationService } from '../../../../common/authentification/authentification.service';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { Session } from './sales.interface';
@Injectable({
  providedIn: 'root'
})
export class SessionService {

  private _current_session!: Session;
  private _current_session$: BehaviorSubject<Session> = new BehaviorSubject<Session>(this._current_session);


  constructor(
    private authService: AuthentificationService,
    private systemDataService: SystemDataService

  ) {
    combineLatest([this.authService.logged_member$, this.systemDataService.configuration$])
      .subscribe(([vendor, conf]) => {
        this._current_session = {
          season: conf.season,
          vendor: vendor ? (vendor.firstname + ' ' + vendor.lastname) : '.. faut quelqu\'un !',
          date: new Date().toISOString().split('T')[0],
        };
        this._current_session$.next(this._current_session);
      });
  }


  get current_session(): Observable<Session> {
    return this._current_session$.asObservable();
  }


  set_current_session(session: Session) {
    this._current_session = session;
    this._current_session$.next(this._current_session);
  }
}
