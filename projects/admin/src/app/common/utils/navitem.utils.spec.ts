import { charsanitize, buildFullPath, extractSegment } from './navitem.utils';
import { NavItem, NAVITEM_POSITION, NAVITEM_TYPE } from '../interfaces/navitem.interface';

describe('navitem.utils', () => {
  const baseParent: NavItem = {
    id: 'p1', sandbox: true, type: NAVITEM_TYPE.DROPDOWN, label: 'Parent', slug: 'parent', path: 'parent',
    rank: 0, public: true, group_level: 0, position: NAVITEM_POSITION.NAVBAR
  };
  const child: NavItem = {
    id: 'c1', sandbox: true, type: NAVITEM_TYPE.INTERNAL_LINK, label: 'Child', slug: 'child', path: 'parent/child',
    parent_id: 'p1', rank: 0, public: true, group_level: 0, position: NAVITEM_POSITION.NAVBAR
  };

  it('charsanitize should lowercase, remove accents, replace spaces and strip invalid chars', () => {
    expect(charsanitize('Événement Sportif 2025!')).toBe('evenement_sportif_2025');
    expect(charsanitize('  Multiple   Spaces  ')).toBe('multiple_spaces');
  });

  it('buildFullPath should prepend parent path when parent exists', () => {
    expect(buildFullPath('child', 'p1', [baseParent])).toBe('parent/child');
  });

  it('buildFullPath should return segment alone when no parent', () => {
    expect(buildFullPath('orphan', null, [baseParent])).toBe('orphan');
  });

  it('extractSegment should return last segment relative to parent', () => {
    expect(extractSegment(child, [baseParent, child])).toBe('child');
  });

  it('extractSegment should fallback to last path part when no parent match', () => {
    const lone: NavItem = { ...child, path: 'single' };
    expect(extractSegment(lone, [baseParent, lone])).toBe('single');
  });
});
