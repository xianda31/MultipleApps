import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, timeout, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthentificationService } from './common/authentification/authentification.service';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthentificationService, private router: Router) {}

  async canActivate(): Promise<boolean | UrlTree> {
    if (!environment.back_guard) {
      return true;
    }

    try {
      // Attendre la première émission non-null de logged_member$ (max 5s)
      // Utile après un rechargement complet (ex: retour Stripe)
      await firstValueFrom(
        this.auth.logged_member$.pipe(
          filter(member => member !== null),
          timeout(5000)
        )
      );
      return true;
    } catch (err) {
      // Timeout ou erreur → rediriger vers /front
      return this.router.createUrlTree(['/front']);
    }
  }
}
