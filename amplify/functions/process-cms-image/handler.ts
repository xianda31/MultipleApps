import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';

interface S3Record {
  s3: {
    bucket: { name: string };
    object: { key: string };
  };
}

interface S3Event {
  Records: S3Record[];
}

type CmsImageProfile = 'inline' | 'publication-landscape' | 'landscape-card' | 'portrait-card' | 'booklet' | 'tournament-thumbnail';

const profiles: Record<CmsImageProfile, { width?: number; height: number; fit: 'contain' | 'cover' }> = {
  inline: { width: 400, height: 300, fit: 'contain' },
  'publication-landscape': { height: 300, fit: 'contain' },
  'landscape-card': { width: 800, height: 533, fit: 'cover' },
  'portrait-card': { width: 600, height: 800, fit: 'cover' },
  booklet: { width: 960, height: 640, fit: 'cover' },
  'tournament-thumbnail': { width: 300, height: 200, fit: 'cover' },
};

const s3 = new S3Client({});

export interface CmsImageSource {
  snippetId: string;
  profile: CmsImageProfile;
  assetId: string;
  variantKey: string;
}

export interface GalleryImageSource {
  assetId: string;
  variantKey: string;
}

export const GALLERY_IMAGE_PROFILE = {
  width: 1920,
  height: 1080,
  fit: 'cover' as const,
  position: 'centre' as const,
};

export function galleryResizeForDimensions(width: number, height: number): typeof GALLERY_IMAGE_PROFILE {
  const scale = Math.floor(Math.min(
    GALLERY_IMAGE_PROFILE.width / 16,
    GALLERY_IMAGE_PROFILE.height / 9,
    width / 16,
    height / 9,
  ));
  if (scale < 1) throw new Error(`Gallery source is too small: ${width}x${height}`);

  return {
    ...GALLERY_IMAGE_PROFILE,
    width: scale * 16,
    height: scale * 9,
  };
}

export function parseCmsImageSource(key: string): CmsImageSource | null {
  const match = key.match(/^images\/cms\/sources\/([^/]+)\/([^/]+)\/([^/.]+)\.[^/]+$/);
  if (!match) return null;

  const [, snippetId, profileName, assetId] = match;
  if (!(profileName in profiles)) return null;

  const profile = profileName as CmsImageProfile;
  return {
    snippetId,
    profile,
    assetId,
    variantKey: `images/cms/snippets/${snippetId}/variants/${profile}/${assetId}.webp`,
  };
}

export function parseGalleryImageSource(key: string): GalleryImageSource | null {
  const match = key.match(/^images\/home\/sources\/([^/.]+)\.[^/]+$/);
  if (!match) return null;

  const [, assetId] = match;
  return {
    assetId,
    variantKey: `images/_ACCUEIL_/${assetId}.webp`,
  };
}

async function processRecord(record: S3Record): Promise<void> {
  const bucket = record.s3.bucket.name;
  const sourceKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  const cmsSource = parseCmsImageSource(sourceKey);
  const gallerySource = parseGalleryImageSource(sourceKey);
  if (!cmsSource && !gallerySource) {
    console.warn('Ignoring invalid image source key', { sourceKey });
    return;
  }

  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: sourceKey }));
  if (!object.Body) throw new Error(`S3 object has no body: ${sourceKey}`);

  const input = Buffer.from(await object.Body.transformToByteArray());
  const metadata = gallerySource ? await sharp(input).metadata() : null;
  const orientation = metadata?.orientation ?? 1;
  const sourceWidth = orientation >= 5 && orientation <= 8 ? metadata?.height : metadata?.width;
  const sourceHeight = orientation >= 5 && orientation <= 8 ? metadata?.width : metadata?.height;
  const resize = gallerySource
    ? galleryResizeForDimensions(sourceWidth ?? 0, sourceHeight ?? 0)
    : {
        width: profiles[cmsSource!.profile].width,
        height: profiles[cmsSource!.profile].height,
        fit: profiles[cmsSource!.profile].fit,
        position: 'centre' as const,
        withoutEnlargement: true,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      };
  const output = await sharp(input)
    .rotate()
    .resize(resize)
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: (gallerySource ?? cmsSource!).variantKey,
    Body: output,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

export async function handler(event: S3Event): Promise<void> {
  await Promise.all(event.Records.map(processRecord));
}
