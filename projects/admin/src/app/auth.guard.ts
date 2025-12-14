import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthentificationService } from './common/authentification/authentification.service';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthentificationService, private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    if (!environment.back_guard) {
      return true;
    }
    if (this.auth.isLoggedIn()) {
      return true;
    }
    return this.router.createUrlTree(['/front']);
  }
}
