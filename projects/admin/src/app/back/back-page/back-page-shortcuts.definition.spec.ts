import { Group_names } from '../../common/authentification/group.interface';
import {
  getBackPageShortcutConfigurationErrors,
  getBackPageShortcuts,
} from './back-page-shortcuts.definition';

describe('back page shortcuts definition', () => {
  it('contains no missing or unauthorized route', () => {
    expect(getBackPageShortcutConfigurationErrors()).toEqual([]);
  });

  it('resolves every configured shortcut from the back navbar', () => {
    for (const group of Object.values(Group_names)) {
      const shortcuts = getBackPageShortcuts(group);

      expect(shortcuts.length).toBeGreaterThanOrEqual(group === Group_names.Member ? 2 : 3);
      expect(new Set(shortcuts.map((shortcut) => shortcut.route)).size).toBe(shortcuts.length);
      expect(shortcuts.every((shortcut) => shortcut.route.startsWith('/'))).toBeTrue();
      expect(shortcuts.every((shortcut) => shortcut.iconClass.startsWith('bi '))).toBeTrue();
    }
  });

  it('keeps each group selection independent', () => {
    const contributorRoutes = getBackPageShortcuts(Group_names.Support).map((shortcut) => shortcut.route);
    const editorRoutes = getBackPageShortcuts(Group_names.Editor).map((shortcut) => shortcut.route);

    expect(contributorRoutes).toContain('/back/caisse/droits-de-table');
    expect(editorRoutes).not.toContain('/back/caisse/droits-de-table');
    expect(editorRoutes).toContain('/back/site/cms-wrapper');
    expect(contributorRoutes).not.toContain('/back/site/cms-wrapper');
  });
});
