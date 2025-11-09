import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SandboxService {
  private readonly key = 'sandbox';
  private _sandbox$ = new BehaviorSubject<boolean>(this.readInitial());

  private readInitial(): boolean {
    try {
      const raw = localStorage.getItem(this.key);
      if (raw === null) return false;
      if (raw === 'true' || raw === 'false') return raw === 'true';
      return !!JSON.parse(raw);
    } catch { return false; }
  }

  sandbox$ = this._sandbox$.asObservable();

  get value(): boolean { return this._sandbox$.value; }

  setSandbox(flag: boolean): void {
    localStorage.setItem(this.key, String(flag));
    this._sandbox$.next(flag);
  }

  toggle(): void { this.setSandbox(!this.value); }
}
