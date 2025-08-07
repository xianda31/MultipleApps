import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TitleService {

  _title$ : BehaviorSubject<string> = new BehaviorSubject<string>('Default Title');
  constructor() { }

get Title$() {
    return this._title$.asObservable();
  }

  setTitle(title: string): void {
    this._title$.next(title);
  }

}
