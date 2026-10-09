import { routes } from './app.routes';

describe('application routes', () => {
  it('keeps the legacy admin prefix mapped to the back office', () => {
    const adminRoute = routes.find(route => route.path === 'admin');

    expect(adminRoute?.redirectTo).toBe('back');
    expect(adminRoute?.pathMatch).toBe('prefix');
  });
});
