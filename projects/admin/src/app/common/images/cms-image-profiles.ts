import { PAGE_TEMPLATES } from '../interfaces/page_snippet.interface';

export type CmsImageProfile = 'inline' | 'landscape-card' | 'portrait-card' | 'booklet';

export interface CmsImageProfileDefinition {
  width: number;
  height: number;
  fit: 'contain' | 'cover';
  aspectRatio: string;
  label: string;
  orientation: 'landscape' | 'portrait';
  recommendation: string;
}

export const CMS_IMAGE_PROFILES: Record<CmsImageProfile, CmsImageProfileDefinition> = {
  inline: {
    width: 400,
    height: 300,
    fit: 'contain',
    aspectRatio: '4 / 3',
    label: 'Illustration 4:3 sans recadrage',
    orientation: 'landscape',
    recommendation: 'Privilégiez une source proche du format 4:3. L’image entière sera conservée.',
  },
  'landscape-card': {
    width: 800,
    height: 533,
    fit: 'cover',
    aspectRatio: '3 / 2',
    label: 'Carte paysage 3:2',
    orientation: 'landscape',
    recommendation: 'Privilégiez une image paysage avec le sujet principal proche du centre.',
  },
  'portrait-card': {
    width: 600,
    height: 800,
    fit: 'cover',
    aspectRatio: '3 / 4',
    label: 'Carte portrait 3:4',
    orientation: 'portrait',
    recommendation: 'Privilégiez une image portrait avec le sujet principal proche du centre.',
  },
  booklet: {
    width: 960,
    height: 640,
    fit: 'cover',
    aspectRatio: '3 / 2',
    label: 'Livret paysage 3:2',
    orientation: 'landscape',
    recommendation: 'Privilégiez une image paysage avec une zone centrale dégagée.',
  },
};

export function cmsImageSourceOrientation(width: number, height: number): 'landscape' | 'portrait' | 'square' {
  if (width === height) return 'square';
  return width > height ? 'landscape' : 'portrait';
}

export function cmsImageOrientationMismatch(profile: CmsImageProfile, width: number, height: number): boolean {
  return cmsImageSourceOrientation(width, height) !== CMS_IMAGE_PROFILES[profile].orientation;
}

export const PAGE_TEMPLATE_IMAGE_PROFILE: Partial<Record<PAGE_TEMPLATES, CmsImageProfile>> = {
  [PAGE_TEMPLATES.PUBLICATION]: 'inline',
  [PAGE_TEMPLATES.SEQUENTIAL]: 'inline',
  [PAGE_TEMPLATES.A_LA_UNE]: 'inline',
  [PAGE_TEMPLATES.CARDS_top]: 'landscape-card',
  [PAGE_TEMPLATES.CARDS_top_left]: 'landscape-card',
  [PAGE_TEMPLATES.CARDS_bottom]: 'landscape-card',
  [PAGE_TEMPLATES.TROMBINOSCOPE]: 'portrait-card',
  [PAGE_TEMPLATES.ALBUMS]: 'portrait-card',
  [PAGE_TEMPLATES.BOOKLET]: 'booklet',
};

export function imageProfileForTemplate(template: PAGE_TEMPLATES): CmsImageProfile | null {
  return PAGE_TEMPLATE_IMAGE_PROFILE[template] ?? null;
}

export function cmsImageSourcePrefix(snippetId: string, profile: CmsImageProfile): string {
  return `images/cms/sources/${snippetId}/${profile}/`;
}

export function cmsImageVariantPath(sourcePath: string): string {
  const match = sourcePath.match(/^images\/cms\/sources\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) throw new Error(`Invalid CMS image source path: ${sourcePath}`);

  const [, snippetId, profile, sourceName] = match;
  const assetId = sourceName.replace(/\.[^.]+$/, '');
  return `images/cms/snippets/${snippetId}/variants/${profile}/${assetId}.webp`;
}
