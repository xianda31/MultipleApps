import { minimal_routes } from './front.routes';

describe('front system routes', () => {
  const children = minimal_routes[0].children ?? [];

  it('redirects current and legacy management links to the back office', () => {
    for (const path of ['back_office', 'espace_gestion']) {
      const route = children.find(candidate => candidate.path === path);
      expect(route?.redirectTo).withContext(`missing redirect for "${path}"`).toBe('/back');
      expect(route?.pathMatch).toBe('full');
    }
  });
});
