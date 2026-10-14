import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { environment } from '../environments/environment';

export const devOnlyGuard: CanMatchFn = () =>
  environment.production ? inject(Router).createUrlTree(['/back/home']) : true;
