import { Injectable } from '@angular/core';
import { FFB_licensee } from '../../../../../common/ffb/interface/licensee.interface';
import { BehaviorSubject, Observable } from 'rxjs';
import { FfbService } from '../../../../../common/ffb/services/ffb.service';

@Injectable({
  providedIn: 'root'
})
export class LicenseesService {
  private _licensees: FFB_licensee[] = [];
  private _licensees$: BehaviorSubject<FFB_licensee[]> = new BehaviorSubject(this._licensees);
  private call: number = 1;

  constructor(
    private FFBService: FfbService
  ) {
    this.FFBService.getAdherents().then((licensees) => {
      this._licensees = licensees;
      this._licensees$.next(this._licensees);
      console.log('LicenseesService.getAdherents call#', this.call++);
    });

  }

  get FFB_licensees$(): Observable<FFB_licensee[]> {
    return this._licensees$;
  }
}
