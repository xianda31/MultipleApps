import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthentificationService } from './common/authentification/authentification.service';
import { AUTHENTICATION_CONFIG } from './common/authentification/authentification.config';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthentificationService, private router: Router) {}

  async canActivate(): Promise<boolean | UrlTree> {
    if (!environment.back_guard) {
      return true;
    }

    try {
      await firstValueFrom(
        this.auth.isRestoringSession$.pipe(
          filter(isRestoring => !isRestoring),
          take(1),
          timeout(AUTHENTICATION_CONFIG.sessionRestoreTimeoutMs)
        )
      );
      return this.auth.currentMember !== null
        ? true
        : this.router.createUrlTree(['/front']);
    } catch (error) {
      console.error('[AuthGuard] Session restoration failed or timed out', error);
      return this.router.createUrlTree(['/front']);
    }
  }
}
