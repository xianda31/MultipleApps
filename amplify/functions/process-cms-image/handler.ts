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

type CmsImageProfile = 'inline' | 'publication-landscape' | 'landscape-card' | 'portrait-card' | 'booklet';

const profiles: Record<CmsImageProfile, { width?: number; height: number; fit: 'contain' | 'cover' }> = {
  inline: { width: 400, height: 300, fit: 'contain' },
  'publication-landscape': { height: 300, fit: 'contain' },
  'landscape-card': { width: 800, height: 533, fit: 'cover' },
  'portrait-card': { width: 600, height: 800, fit: 'cover' },
  booklet: { width: 960, height: 640, fit: 'cover' },
};

const s3 = new S3Client({});

export interface CmsImageSource {
  snippetId: string;
  profile: CmsImageProfile;
  assetId: string;
  variantKey: string;
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

async function processRecord(record: S3Record): Promise<void> {
  const bucket = record.s3.bucket.name;
  const sourceKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  const source = parseCmsImageSource(sourceKey);
  if (!source) {
    console.warn('Ignoring invalid CMS image source key', { sourceKey });
    return;
  }

  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: sourceKey }));
  if (!object.Body) throw new Error(`S3 object has no body: ${sourceKey}`);

  const input = Buffer.from(await object.Body.transformToByteArray());
  const profile = profiles[source.profile];
  const output = await sharp(input)
    .rotate()
    .resize({
      width: profile.width,
      height: profile.height,
      fit: profile.fit,
      position: 'centre',
      withoutEnlargement: true,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: source.variantKey,
    Body: output,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

export async function handler(event: S3Event): Promise<void> {
  await Promise.all(event.Records.map(processRecord));
}
