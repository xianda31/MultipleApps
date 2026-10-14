export const BACK_OFFICE_CHANGE_LOG_AREAS = [
  { value: 'TOURNOIS', label: 'Tournois' },
  { value: 'BOUTIQUE', label: 'Boutique' },
  { value: 'ADHERENTS', label: 'Adhérents' },
  { value: 'COMPTABILITE', label: 'Comptabilité' },
  { value: 'PAIEMENTS', label: 'Paiements' },
  { value: 'SITE_WEB', label: 'Site web' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'GENERAL', label: 'Général' },
] as const;

export const FRONT_CHANGE_LOG_AREAS = [
  { value: 'ACCUEIL_ACTUALITES', label: 'Accueil & actualités' },
  { value: 'TOURNOIS_COMPETITIONS', label: 'Tournois & compétitions' },
  { value: 'BOUTIQUE', label: 'Boutique en ligne' },
  { value: 'ESPACE_MEMBRE', label: 'Espace membre' },
  { value: 'ALBUMS_MEDIAS', label: 'Albums & médias' },
  { value: 'NAVIGATION_PAGES', label: 'Navigation & pages' },
  { value: 'ASSISTANCE', label: 'Assistance' },
  { value: 'GENERAL', label: 'Général' },
] as const;

export type ChangeLogArea =
  | typeof BACK_OFFICE_CHANGE_LOG_AREAS[number]['value']
  | typeof FRONT_CHANGE_LOG_AREAS[number]['value'];

export const CHANGE_LOG_AREAS: readonly { value: ChangeLogArea; label: string }[] = [
  ...BACK_OFFICE_CHANGE_LOG_AREAS,
  ...FRONT_CHANGE_LOG_AREAS.filter((area) => area.value !== 'GENERAL'),
];

export const CHANGE_LOG_KINDS = [
  { value: 'NEW', label: 'Nouveauté', cssClass: 'bg-success text-white' },
  { value: 'IMPROVEMENT', label: 'Amélioration', cssClass: 'text-bg-primary' },
  { value: 'FIX', label: 'Correction', cssClass: 'text-bg-warning text-dark' },
] as const;

export const CHANGE_LOG_SITES = [
  { value: 'BACK_OFFICE', label: 'Back-office' },
  { value: 'FRONT', label: 'Front' },
] as const;

export type ChangeLogKind = typeof CHANGE_LOG_KINDS[number]['value'];
export type ChangeLogSite = typeof CHANGE_LOG_SITES[number]['value'];

export interface ChangeLogEntry {
  id: string;
  publishedOn: string;
  site: ChangeLogSite;
  area: ChangeLogArea;
  kind: ChangeLogKind;
  summary: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHANGE_LOG_AREA_VALUES = new Set<string>(CHANGE_LOG_AREAS.map((area) => area.value));
const CHANGE_LOG_KIND_VALUES = new Set<string>(CHANGE_LOG_KINDS.map((kind) => kind.value));
const CHANGE_LOG_SITE_VALUES = new Set<string>(CHANGE_LOG_SITES.map((site) => site.value));

export function validateChangeLogEntries(value: unknown): ChangeLogEntry[] {
  if (!Array.isArray(value)) {
    throw new Error('Le change log doit être une liste');
  }

  const ids = new Set<string>();
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error(`Entrée ${index + 1} invalide`);
    }

    const entry = candidate as Record<string, unknown>;
    const id = requiredString(entry['id'], `Identifiant de l’entrée ${index + 1}`);
    const publishedOn = requiredString(entry['publishedOn'], `Date de l’entrée ${index + 1}`);
    const site = entry['site'] === undefined
      ? 'BACK_OFFICE'
      : requiredString(entry['site'], `Site de l’entrée ${index + 1}`);
    const area = requiredString(entry['area'], `Rubrique de l’entrée ${index + 1}`);
    const kind = requiredString(entry['kind'], `Nature de l’entrée ${index + 1}`);
    const summary = requiredString(entry['summary'], `Résumé de l’entrée ${index + 1}`);

    if (!ID_PATTERN.test(id)) {
      throw new Error(`Identifiant invalide : ${id}`);
    }
    if (ids.has(id)) {
      throw new Error(`Identifiant dupliqué : ${id}`);
    }
    ids.add(id);

    if (!isValidIsoDate(publishedOn)) {
      throw new Error(`Date invalide pour ${id} : ${publishedOn}`);
    }
    if (!CHANGE_LOG_SITE_VALUES.has(site)) {
      throw new Error(`Site invalide pour ${id} : ${site}`);
    }
    if (!CHANGE_LOG_AREA_VALUES.has(area)) {
      throw new Error(`Rubrique invalide pour ${id} : ${area}`);
    }
    if (!changeLogAreasForSite(site as ChangeLogSite).some((candidate) => candidate.value === area)) {
      throw new Error(`Rubrique ${area} incompatible avec le site ${site} pour ${id}`);
    }
    if (!CHANGE_LOG_KIND_VALUES.has(kind)) {
      throw new Error(`Nature invalide pour ${id} : ${kind}`);
    }
    if (summary.length > 160) {
      throw new Error(`Le résumé de ${id} dépasse 160 caractères`);
    }
    if (summary.includes('\uFFFD')) {
      throw new Error(`Le résumé de ${id} contient des caractères d’encodage invalides`);
    }

    return {
      id,
      publishedOn,
      site: site as ChangeLogSite,
      area: area as ChangeLogArea,
      kind: kind as ChangeLogKind,
      summary,
    };
  });
}

export function sortChangeLogEntries(entries: ChangeLogEntry[]): ChangeLogEntry[] {
  return [...entries].sort((left, right) =>
    right.publishedOn.localeCompare(left.publishedOn) || left.id.localeCompare(right.id)
  );
}

export function changeLogAreasForSite(site: ChangeLogSite) {
  return site === 'FRONT' ? FRONT_CHANGE_LOG_AREAS : BACK_OFFICE_CHANGE_LOG_AREAS;
}

export function generateChangeLogId(
  publishedOn: string,
  summary: string,
  existingIds: ReadonlySet<string>,
): string {
  const baseSlug = summary
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .slice(0, 7)
    .join('-') || 'evolution';
  const baseId = `${publishedOn}-${baseSlug}`;

  let id = baseId;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} manquant`);
  }
  return value.trim();
}

function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}
