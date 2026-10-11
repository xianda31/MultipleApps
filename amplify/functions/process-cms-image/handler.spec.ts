import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import {
  GALLERY_IMAGE_PROFILE,
  cmsResizeForProfile,
  galleryResizeForDimensions,
  parseCmsImageSource,
  parseGalleryImageSource,
} from './handler';

describe('process-cms-image path contract', () => {
  it('maps a valid source to its deterministic WebP variant', () => {
    assert.deepEqual(
      parseCmsImageSource('images/cms/sources/snippet-1/landscape-card/asset-123.jpeg'),
      {
        snippetId: 'snippet-1',
        profile: 'landscape-card',
        assetId: 'asset-123',
        variantKey: 'images/cms/snippets/snippet-1/variants/landscape-card/asset-123.webp',
      },
    );
  });

  it('rejects unknown profiles and generated variants', () => {
    assert.equal(parseCmsImageSource('images/cms/sources/snippet-1/unknown/asset.jpg'), null);
    assert.equal(parseCmsImageSource('images/cms/snippets/snippet-1/variants/inline/asset.webp'), null);
  });

  it('accepts the fixed-height publication profile', () => {
    assert.equal(
      parseCmsImageSource('images/cms/sources/snippet-1/publication-landscape/banner.jpg')?.variantKey,
      'images/cms/snippets/snippet-1/variants/publication-landscape/banner.webp',
    );
  });

  it('maps transparent card and booklet variants to distinct paths', () => {
    assert.equal(
      parseCmsImageSource('images/cms/sources/snippet-1/landscape-card-padded/banner.jpg')?.variantKey,
      'images/cms/snippets/snippet-1/variants/landscape-card-padded/banner.webp',
    );
    assert.equal(
      parseCmsImageSource('images/cms/sources/snippet-1/portrait-card-padded/portrait.jpg')?.variantKey,
      'images/cms/snippets/snippet-1/variants/portrait-card-padded/portrait.webp',
    );
    assert.equal(
      parseCmsImageSource('images/cms/sources/snippet-1/booklet-padded/booklet.jpg')?.variantKey,
      'images/cms/snippets/snippet-1/variants/booklet-padded/booklet.webp',
    );
  });

  it('maps a tournament thumbnail source to the reserved variants namespace', () => {
    assert.deepEqual(
      parseCmsImageSource('images/cms/sources/tournament-thumbnails/tournament-thumbnail/asset-456.png'),
      {
        snippetId: 'tournament-thumbnails',
        profile: 'tournament-thumbnail',
        assetId: 'asset-456',
        variantKey: 'images/cms/snippets/tournament-thumbnails/variants/tournament-thumbnail/asset-456.webp',
      },
    );
    assert.deepEqual(
      parseCmsImageSource('images/cms/sources/tournament-thumbnails/tournament-thumbnail-padded/asset-789.png'),
      {
        snippetId: 'tournament-thumbnails',
        profile: 'tournament-thumbnail-padded',
        assetId: 'asset-789',
        variantKey: 'images/cms/snippets/tournament-thumbnails/variants/tournament-thumbnail-padded/asset-789.webp',
      },
    );
  });

  it('centres the complete thumbnail on a transparent 300 by 200 canvas', async () => {
    const source = await sharp({
      create: {
        width: 100,
        height: 200,
        channels: 3,
        background: { r: 20, g: 120, b: 60 },
      },
    }).png().toBuffer();

    const { data, info } = await sharp(source)
      .resize(cmsResizeForProfile('tournament-thumbnail-padded'))
      .webp()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[((y * info.width + x) * info.channels) + 3];

    assert.equal(info.width, 300);
    assert.equal(info.height, 200);
    assert.equal(info.channels, 4);
    assert.equal(alphaAt(0, 100), 0);
    assert.equal(alphaAt(150, 100), 255);
    assert.equal(alphaAt(299, 100), 0);
  });

  it('maps a homepage source to the legacy public gallery', () => {
    assert.deepEqual(
      parseGalleryImageSource('images/home/sources/asset-123.jpeg'),
      {
        assetId: 'asset-123',
        variantKey: 'images/_ACCUEIL_/asset-123.webp',
      },
    );
    assert.equal(parseGalleryImageSource('images/_ACCUEIL_/asset-123.webp'), null);
    assert.deepEqual(GALLERY_IMAGE_PROFILE, {
      width: 1920,
      height: 1080,
      fit: 'cover',
      position: 'centre',
    });
    assert.deepEqual(galleryResizeForDimensions(1280, 1920), {
      ...GALLERY_IMAGE_PROFILE,
      width: 1280,
      height: 720,
    });
    assert.deepEqual(galleryResizeForDimensions(3840, 2160), GALLERY_IMAGE_PROFILE);
  });
});
