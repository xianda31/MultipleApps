import { PAGE_TEMPLATES } from '../interfaces/page_snippet.interface';

export type CmsImageProfile =
  | 'inline'
  | 'publication-landscape'
  | 'landscape-card'
  | 'landscape-card-padded'
  | 'portrait-card'
  | 'portrait-card-padded'
  | 'booklet'
  | 'booklet-padded'
  | 'tournament-thumbnail'
  | 'tournament-thumbnail-padded';

export interface CmsImageProfileDefinition {
  width: number | null;
  height: number;
  fit: 'contain' | 'cover';
  aspectRatio: string | null;
  label: string;
  orientation: 'landscape' | 'portrait';
  recommendation: string;
  transparentPadding?: boolean;
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
  'publication-landscape': {
    width: null,
    height: 300,
    fit: 'contain',
    aspectRatio: null,
    label: 'Illustration paysage à hauteur fixe',
    orientation: 'landscape',
    recommendation: 'Privilégiez une image paysage. La hauteur sera fixée à 300 px et la largeur suivra les proportions de la source.',
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
  'landscape-card-padded': {
    width: 800,
    height: 533,
    fit: 'contain',
    aspectRatio: '3 / 2',
    label: 'Carte paysage 3:2 sans rognage',
    orientation: 'landscape',
    recommendation: 'L’image entière sera centrée et complétée par des marges transparentes.',
    transparentPadding: true,
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
  'portrait-card-padded': {
    width: 600,
    height: 800,
    fit: 'contain',
    aspectRatio: '3 / 4',
    label: 'Carte portrait 3:4 sans rognage',
    orientation: 'portrait',
    recommendation: 'L’image entière sera centrée et complétée par des marges transparentes.',
    transparentPadding: true,
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
  'booklet-padded': {
    width: 960,
    height: 640,
    fit: 'contain',
    aspectRatio: '3 / 2',
    label: 'Livret paysage 3:2 sans rognage',
    orientation: 'landscape',
    recommendation: 'L’image entière sera centrée et complétée par des marges transparentes.',
    transparentPadding: true,
  },
  'tournament-thumbnail': {
    width: 300,
    height: 200,
    fit: 'cover',
    aspectRatio: '3 / 2',
    label: 'Vignette tournoi 3:2',
    orientation: 'landscape',
    recommendation: 'Privilégiez une image paysage avec le sujet principal proche du centre.',
  },
  'tournament-thumbnail-padded': {
    width: 300,
    height: 200,
    fit: 'contain',
    aspectRatio: '3 / 2',
    label: 'Vignette tournoi 3:2 sans rognage',
    orientation: 'landscape',
    recommendation: 'L’image entière sera centrée et complétée par des marges transparentes.',
    transparentPadding: true,
  },
};

export function cmsImageSourceOrientation(width: number, height: number): 'landscape' | 'portrait' | 'square' {
  if (width === height) return 'square';
  return width > height ? 'landscape' : 'portrait';
}

export function cmsImageOrientationMismatch(profile: CmsImageProfile, width: number, height: number): boolean {
  return cmsImageSourceOrientation(width, height) !== CMS_IMAGE_PROFILES[profile].orientation;
}

export function cmsImageFramingPercentages(
  profile: CmsImageProfile,
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  const definition = CMS_IMAGE_PROFILES[profile];
  if (!definition.width || sourceWidth <= 0 || sourceHeight <= 0) return { width: 0, height: 0 };

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = definition.width / definition.height;
  if (definition.fit === 'cover') {
    return {
      width: sourceRatio > targetRatio ? (1 - targetRatio / sourceRatio) * 100 : 0,
      height: sourceRatio < targetRatio ? (1 - sourceRatio / targetRatio) * 100 : 0,
    };
  }
  if (definition.transparentPadding) {
    return {
      width: sourceRatio < targetRatio ? (1 - sourceRatio / targetRatio) * 100 : 0,
      height: sourceRatio > targetRatio ? (1 - targetRatio / sourceRatio) * 100 : 0,
    };
  }
  return { width: 0, height: 0 };
}

const CMS_IMAGE_FRAMING_PAIRS: Array<readonly [CmsImageProfile, CmsImageProfile]> = [
  ['landscape-card', 'landscape-card-padded'],
  ['portrait-card', 'portrait-card-padded'],
  ['booklet', 'booklet-padded'],
  ['tournament-thumbnail', 'tournament-thumbnail-padded'],
];

export function cmsImageFramingProfiles(
  profile: CmsImageProfile,
): { crop: CmsImageProfile; padded: CmsImageProfile } | null {
  const pair = CMS_IMAGE_FRAMING_PAIRS.find(([crop, padded]) => profile === crop || profile === padded);
  return pair ? { crop: pair[0], padded: pair[1] } : null;
}

export const PAGE_TEMPLATE_IMAGE_PROFILE: Partial<Record<PAGE_TEMPLATES, CmsImageProfile>> = {
  [PAGE_TEMPLATES.PUBLICATION]: 'publication-landscape',
  [PAGE_TEMPLATES.SEQUENTIAL]: 'inline',
  [PAGE_TEMPLATES.A_LA_UNE]: 'inline',
  [PAGE_TEMPLATES.CARDS_top]: 'landscape-card',
  [PAGE_TEMPLATES.CARDS_top_left]: 'landscape-card',
  [PAGE_TEMPLATES.CARDS_bottom]: 'landscape-card',
  [PAGE_TEMPLATES.TROMBINOSCOPE]: 'portrait-card',
  [PAGE_TEMPLATES.ALBUMS]: 'portrait-card',
  [PAGE_TEMPLATES.BOOKLET]: 'booklet',
};

export const TOURNAMENT_THUMBNAIL_OWNER_ID = 'tournament-thumbnails';
export const TOURNAMENT_THUMBNAIL_PROFILE: CmsImageProfile = 'tournament-thumbnail';
export const TOURNAMENT_THUMBNAIL_PADDED_PROFILE: CmsImageProfile = 'tournament-thumbnail-padded';
export const TOURNAMENT_THUMBNAIL_VARIANT_PREFIX =
  `images/cms/snippets/${TOURNAMENT_THUMBNAIL_OWNER_ID}/variants/${TOURNAMENT_THUMBNAIL_PROFILE}/`;

export function imageProfileForTemplate(template: PAGE_TEMPLATES): CmsImageProfile | null {
  return PAGE_TEMPLATE_IMAGE_PROFILE[template] ?? null;
}

export function cmsImageTargetDescription(profile: CmsImageProfile): string {
  const definition = CMS_IMAGE_PROFILES[profile];
  if (definition.width === null || definition.aspectRatio === null) {
    return `hauteur ${definition.height} px · largeur proportionnelle · WebP · image entière sans recadrage`;
  }
  const ratio = definition.aspectRatio.replace(/\s*\/\s*/, ':');
  if (definition.transparentPadding) {
    return `${definition.width} × ${definition.height} px · ratio ${ratio} · WebP · image entière avec marges transparentes`;
  }
  const framing = definition.fit === 'cover' ? 'recadrage centré' : 'image entière sans recadrage';
  return `${definition.width} × ${definition.height} px · ratio ${ratio} · WebP · ${framing}`;
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
