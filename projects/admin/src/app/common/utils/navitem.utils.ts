import { NavItem } from "../../common/interfaces/navitem.interface";

// Sanitize a label into a slug: lowercase, remove diacritics, spaces -> '_', allow [a-z0-9_]
export function charsanitize(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// Build a full path from a segment and optional parent id, using current navitems to find parent's path
export function buildFullPath(segment: string, parent_id: string | null | undefined, navitems: NavItem[] | undefined): string {
  const seg = (segment || '').replace(/^\/+|\/+$/g, '');
  const parent = parent_id ? navitems?.find(n => n.id === parent_id) : null;
  const prefix = parent?.path ? parent.path.replace(/^\/+|\/+$/g, '') : '';
  return prefix ? `${prefix}/${seg}` : seg;
}

// Extract the last segment of item's path relative to its parent
export function extractSegment(item: NavItem, navitems: NavItem[] | undefined): string {
  const parent = item.parent_id ? navitems?.find(n => n.id === item.parent_id) : null;
  if (parent && parent.path && item.path && item.path.startsWith(parent.path + '/')) {
    return item.path.substring(parent.path.length + 1);
  }
  const parts = (item.path || '').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}
