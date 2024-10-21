import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable, of } from 'rxjs';
import { AuthentificationService } from '../../../../common/authentification/authentification.service';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { Session } from './sales.interface';
@Injectable({
  providedIn: 'root'
})
export class SessionService {

  private _current_session!: Session;
  // private _current_session$: BehaviorSubject<Session> = new BehaviorSubject<Session>(this._current_session);
  constructor(
    private authService: AuthentificationService,
    private systemDataService: SystemDataService

  ) { }

  get current_session(): Observable<Session> {
    if (!this._current_session) {
      return combineLatest([this.authService.logged_member$, this.systemDataService.configuration$])
        .pipe(
          map(([vendor, conf]) => {
            this._current_session = {
              season: conf.season,
              vendor: vendor ? (vendor.firstname + ' ' + vendor.lastname) : '.. faut quelqu\'un !',
              event: new Date().toLocaleDateString('en-CA'),
            };
          }),
          map(() => this._current_session)
        );

    } else {
      return of(this._current_session);
    }
  }


  set_current_session(session: Session) {
    this._current_session = session;
    // this._current_session$.next(this._current_session);
  }
}
