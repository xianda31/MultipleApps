import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { filter, switchMap, tap, map } from 'rxjs/operators';
import { FFB_licensee } from '../../ffb/interface/licensee.interface';
import { FFB_proxyService } from '../../ffb/services/ffb.service';
import { FFBPersonIV } from '../../interfaces/FFBperson.interface';

@Injectable({
  providedIn: 'root'
})
export class LicenseesService {
  private _licensees!: FFB_licensee[];
  private _licensees$: BehaviorSubject<FFB_licensee[]> = new BehaviorSubject(this._licensees);

  constructor(
    private FFBService: FFB_proxyService
  ) {
    this.FFBService.getAdherents().then((licensees) => {
      this._licensees = licensees;
      this._licensees$.next(this._licensees);
    });

  }

  list_FFB_licensees$(): Observable<FFB_licensee[]> {
    const fetchLicensees = async () => {
      const licensees = await this.FFBService.getAdherents();
      this._licensees = licensees;
      return this._licensees;
    };


    let remote_load$ = from(fetchLicensees()).pipe(
      tap((licensees) => {
        this._licensees = licensees;
        this._licensees$.next(this._licensees);
      }
      ),
      switchMap(() => this._licensees$.asObservable())
    );


    return this._licensees ? this._licensees$.asObservable() : remote_load$;
  }

  async get_iv(person_id: number): Promise<FFBPersonIV | undefined> {
    const person = await this.FFBService.getFFBPerson(person_id);
    return person?.iv;
  }
}
