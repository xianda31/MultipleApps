import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import { AuthentificationService } from '../../../../common/authentification/authentification.service';
import { Member } from '../../../../common/member.interface';
import { SystemDataService } from '../../../../common/services/system-data.service';
import { Session } from '../cart/cart.interface';
@Injectable({
  providedIn: 'root'
})
export class SessionService {

  private _current_session!: Session;
  private _current_session$: BehaviorSubject<Session> = new BehaviorSubject<Session>(this._current_session);
  vendor!: Member;
  season!: string;
  constructor(
    private authService: AuthentificationService,
    private systemDataService: SystemDataService

  ) {
    this.authService.logged_member$.subscribe((member) => {
      if (member) {
        this.vendor = member;
      }
    });
    this.systemDataService.configuration$.subscribe((conf) => {
      this.season = conf.season;
    });

    combineLatest([this.authService.logged_member$, this.systemDataService.configuration$]).subscribe(([member, conf]) => {
      this.vendor = member ?? this.vendor;
      this.season = conf.season;
      this._current_session = {
        season: this.season,
        vendor: this.vendor.firstname + ' ' + this.vendor.lastname,
        event: new Date().toLocaleDateString('en-CA'),
      };
      this._current_session$.next(this._current_session);
    });
  }

  get current_session(): Observable<Session> {
    if (this._current_session == null) {
      return combineLatest([this.authService.logged_member$, this.systemDataService.configuration$])
        .pipe(
          map(([member, conf]) => {
            this._current_session = {
              season: conf.season,
              vendor: member ? (this.vendor.firstname + ' ' + this.vendor.lastname) : 'nobody',
              event: new Date().toLocaleDateString('en-CA'),
            };
            // this._current_session$.next(this._current_session);
            // return this._current_session$.asObservable();
          }),
          map(() => this._current_session)
        );

    } else {
      return this._current_session$.asObservable();
    }
  }


  set_current_session(session: Session) {
    this._current_session = session;
    this._current_session$.next(this._current_session);
  }
}
