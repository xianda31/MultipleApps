import { inject, Injectable } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthentificationService } from '../../../../common/authentification/authentification.service';
import { map, take, tap } from 'rxjs';



export const loggedInGuard: CanActivateFn = (route, state) => {
  const auth: AuthentificationService = inject(AuthentificationService);
  return auth.logged_member$.pipe(
    take(1),
    map(member => !!member),
  );
};
