import { Group_names, Group_priorities } from '../../common/authentification/group.interface';
import { HELP_TOPICS, HelpTopic } from '../back-online-help/back-online-help-content';
import { STATIC_MENUS } from '../back-navbar/back-navbar.definition';
import { NavbarMenu } from '../back-navbar/back-navbar.interface';
import { BACK_ROUTE_ACCESS, getBackRouteAccess, getBackRouteMinimumLevel } from './back-route-access';
import { BACK_ROUTE_PATHS } from './back-route-paths';

function flattenHelpTopics(topics: HelpTopic[]): HelpTopic[] {
  return topics.flatMap((topic) => [topic, ...flattenHelpTopics(topic.children ?? [])]);
}

function flattenMenus(menus: NavbarMenu[]): NavbarMenu[] {
  return menus.flatMap((menu) => [menu, ...flattenMenus(menu.subMenus ?? [])]);
}

describe('back route access policy', () => {
  it('defines an access policy for every back-office route', () => {
    for (const [key, path] of Object.entries(BACK_ROUTE_PATHS)) {
      expect(getBackRouteAccess(path))
        .withContext(`Missing access policy for ${key}: ${path}`)
        .toBeDefined();
    }
  });

  it('maps composed and legacy route aliases to their canonical policies', () => {
    expect(getBackRouteAccess(`${BACK_ROUTE_PATHS.Shop}/:member_id`))
      .toBe(BACK_ROUTE_ACCESS.Shop);
    expect(getBackRouteAccess('caisse/collecte'))
      .toBe(BACK_ROUTE_ACCESS.Billetterie);
  });

  it('references existing help topics', () => {
    const topicIds = new Set(flattenHelpTopics(HELP_TOPICS).map((topic) => topic.id));

    for (const [key, access] of Object.entries(BACK_ROUTE_ACCESS)) {
      if (!access.helpTopicId) continue;
      expect(topicIds.has(access.helpTopicId))
        .withContext(`Missing help topic ${access.helpTopicId} for ${key}`)
        .toBeTrue();
    }
  });

  it('keeps documented group levels aligned with route policies', () => {
    for (const topic of flattenHelpTopics(HELP_TOPICS)) {
      if (!topic.route) continue;
      const access = getBackRouteAccess(topic.route);
      if (!access) continue;

      expect(topic.nav.groupLevel as Group_names)
        .withContext(`Documentation level mismatch for ${topic.id}`)
        .toBe(access.minimumGroup);
    }
  });

  it('derives menu levels from route policies', () => {
    for (const menu of flattenMenus(STATIC_MENUS)) {
      if (!menu.route || menu.route === '/front') continue;

      expect(menu.minLevel)
        .withContext(`Menu level mismatch for ${menu.label}: ${menu.route}`)
        .toBe(getBackRouteMinimumLevel(menu.route));
    }
  });

  it('exposes the expected routes to an Editor', () => {
    const editorLevel = Group_priorities[Group_names.Editor];
    const canAccess = (path: string) => editorLevel >= (getBackRouteMinimumLevel(path) ?? Infinity);

    expect(canAccess(BACK_ROUTE_PATHS.UiConf)).withContext('Editor screen').toBeTrue();
    expect(canAccess(BACK_ROUTE_PATHS.ImageMaintenance)).withContext('Editor screen').toBeTrue();
    expect(canAccess(BACK_ROUTE_PATHS.Shop)).withContext('Contributor screen').toBeTrue();
    expect(canAccess(BACK_ROUTE_PATHS.OnlineHelp)).withContext('Member screen').toBeTrue();
    expect(canAccess(BACK_ROUTE_PATHS.CashBoxStatus)).withContext('Admin screen').toBeFalse();
    expect(canAccess(BACK_ROUTE_PATHS.BookBackup)).withContext('System screen').toBeFalse();
  });
});