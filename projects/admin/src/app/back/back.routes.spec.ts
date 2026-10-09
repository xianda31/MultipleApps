import { AuthGuard } from '../auth.guard';
import { AccreditationGuard } from '../accreditation.guard';
import { routes } from './back.routes';
import { BACK_ROUTE_PATHS } from './routes/back-route-paths';

describe('back-office routes', () => {
  const childRoutes = routes[0].children ?? [];

  it('keeps entry, home and sign-out routes accessible without authentication', () => {
    for (const path of ['', BACK_ROUTE_PATHS.Home, BACK_ROUTE_PATHS.SignOut]) {
      const route = childRoutes.find(candidate => candidate.path === path);
      expect(route).withContext(`missing route "${path}"`).toBeDefined();
      expect(route?.canActivate).withContext(`route "${path}" should be public`).toBeUndefined();
    }
  });

  it('keeps functional routes protected by authentication and accreditation', () => {
    const route = childRoutes.find(candidate => candidate.path === BACK_ROUTE_PATHS.Shop);

    expect(route?.canActivate).toEqual([AuthGuard, AccreditationGuard]);
  });
});
