import { Injectable } from '@angular/core';
import { FFB_licensee } from '../../../../../common/ffb/interface/licensee.interface';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { filter } from 'rxjs/operators';
import { FFB_proxyService } from '../../../../../common/ffb/services/ffb.service';

@Injectable({
  providedIn: 'root'
})
export class LicenseesService {
  private _licensees: FFB_licensee[] = [];
  private _licensees$: BehaviorSubject<FFB_licensee[]> = new BehaviorSubject(this._licensees);

  constructor(
    private FFBService: FFB_proxyService
  ) {
    this.FFBService.getAdherents().then((licensees) => {
      this._licensees = licensees;
      this._licensees$.next(this._licensees);
    });

  }

  get FFB_licensees$(): Observable<FFB_licensee[]> {
    return this._licensees$;
  }

  getLicenseeByLicense(license: string): Observable<FFB_licensee> {
    return from(this.FFBService.getLicenceeDetails(license)).pipe(
      filter((licensee): licensee is FFB_licensee => licensee !== null)
    );
  }
}
