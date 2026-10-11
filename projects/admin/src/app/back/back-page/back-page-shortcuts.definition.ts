import { Group_names, Group_priorities } from '../../common/authentification/group.interface';
import { STATIC_MENUS } from '../back-navbar/back-navbar.definition';
import { NavbarMenu } from '../back-navbar/back-navbar.interface';
import { BACK_ROUTE_PATHS } from '../routes/back-route-paths';

export interface BackPageShortcut {
  label: string;
  route: string;
  iconClass: string;
}

interface NavbarShortcut extends BackPageShortcut {
  minimumLevel: number;
}

const FRONT_ROUTE = '/front';

const SHORTCUT_ROUTES: Record<Group_names, readonly string[]> = {
  [Group_names.Member]: [
    BACK_ROUTE_PATHS.OnlineHelp,
    FRONT_ROUTE,
  ],
  [Group_names.Support]: [
    BACK_ROUTE_PATHS.FeesCollector,
    BACK_ROUTE_PATHS.Shop,
    FRONT_ROUTE,
  ],
  [Group_names.Editor]: [
    BACK_ROUTE_PATHS.FeesCollector,
    BACK_ROUTE_PATHS.Shop,
    BACK_ROUTE_PATHS.CMSWrapper,
    BACK_ROUTE_PATHS.Mailing,
    BACK_ROUTE_PATHS.SondageList,
    FRONT_ROUTE,
  ],
  [Group_names.Admin]: [
    BACK_ROUTE_PATHS.FeesCollector,
    BACK_ROUTE_PATHS.Shop,
    BACK_ROUTE_PATHS.MembersDatabase,
    BACK_ROUTE_PATHS.GameCardsEditor,
    BACK_ROUTE_PATHS.Mailing,
    FRONT_ROUTE,
  ],
  [Group_names.System]: [
    BACK_ROUTE_PATHS.FeesCollector,
    BACK_ROUTE_PATHS.Shop,
    BACK_ROUTE_PATHS.MembersDatabase,
    BACK_ROUTE_PATHS.GameCardsEditor,
    BACK_ROUTE_PATHS.CashBoxStatus,
    BACK_ROUTE_PATHS.ExpenseAndRevenue,
       BACK_ROUTE_PATHS.CMSWrapper,
    BACK_ROUTE_PATHS.Mailing,
    FRONT_ROUTE,
  ],
};

function flattenMenus(menus: NavbarMenu[], inheritedIcon?: string): NavbarShortcut[] {
  return menus.flatMap((menu) => {
    const icon = menu.icon ?? inheritedIcon ?? 'bi-arrow-right-circle';
    const current = menu.route
      ? [{
          label: menu.route === FRONT_ROUTE ? 'Site public' : menu.label,
          route: menu.route.startsWith('/') ? menu.route : `/back/${menu.route}`,
          iconClass: `bi ${icon}`,
          minimumLevel: menu.route === FRONT_ROUTE ? 0 : (menu.minLevel ?? 0),
        }]
      : [];

    return [...current, ...flattenMenus(menu.subMenus ?? [], icon)];
  });
}

const NAVBAR_SHORTCUTS = flattenMenus(STATIC_MENUS);

interface ShortcutResolution {
  shortcuts: BackPageShortcut[];
  errors: string[];
}

function resolveGroupShortcuts(group: Group_names): ShortcutResolution {
  const groupLevel = Group_priorities[group];
  const shortcuts: BackPageShortcut[] = [];
  const errors: string[] = [];

  for (const configuredRoute of SHORTCUT_ROUTES[group]) {
    const absoluteRoute = configuredRoute.startsWith('/') ? configuredRoute : `/back/${configuredRoute}`;
    const shortcut = NAVBAR_SHORTCUTS.find((item) => item.route === absoluteRoute);

    if (!shortcut) {
      errors.push(`Raccourci introuvable dans la navbar du back : ${configuredRoute}`);
      continue;
    }

    if (shortcut.minimumLevel > groupLevel) {
      errors.push(
        `Raccourci non autorisé pour ${group} : ${shortcut.route} `
        + `(niveau requis ${shortcut.minimumLevel}, niveau du groupe ${groupLevel})`
      );
      continue;
    }

    const { minimumLevel: _minimumLevel, ...resolvedShortcut } = shortcut;
    shortcuts.push(resolvedShortcut);
  }

  return { shortcuts, errors };
}

const RESOLUTIONS: Record<Group_names, ShortcutResolution> = {
  [Group_names.Member]: resolveGroupShortcuts(Group_names.Member),
  [Group_names.Support]: resolveGroupShortcuts(Group_names.Support),
  [Group_names.Editor]: resolveGroupShortcuts(Group_names.Editor),
  [Group_names.Admin]: resolveGroupShortcuts(Group_names.Admin),
  [Group_names.System]: resolveGroupShortcuts(Group_names.System),
};

const CONFIGURATION_ERRORS = Object.values(RESOLUTIONS).flatMap((resolution) => resolution.errors);
CONFIGURATION_ERRORS.forEach((error) => console.error(`[BackPageShortcuts] ${error}`));

export function getBackPageShortcuts(group: Group_names): BackPageShortcut[] {
  return [...RESOLUTIONS[group].shortcuts];
}

export function getBackPageShortcutConfigurationErrors(): string[] {
  return [...CONFIGURATION_ERRORS];
}
