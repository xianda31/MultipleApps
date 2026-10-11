import { PAGE_TEMPLATES } from '../interfaces/page_snippet.interface';
import {
  CMS_IMAGE_PROFILES,
  cmsImageFramingPercentages,
  cmsImageFramingProfiles,
  cmsImageOrientationMismatch,
  cmsImageSourcePrefix,
  cmsImageTargetDescription,
  cmsImageVariantPath,
  imageProfileForTemplate,
} from './cms-image-profiles';

describe('CMS image profiles', () => {
  it('groups page templates by actual image usage', () => {
    expect(imageProfileForTemplate(PAGE_TEMPLATES.PUBLICATION)).toBe('publication-landscape');
    expect(imageProfileForTemplate(PAGE_TEMPLATES.CARDS_top)).toBe('landscape-card');
    expect(imageProfileForTemplate(PAGE_TEMPLATES.ALBUMS)).toBe('portrait-card');
    expect(imageProfileForTemplate(PAGE_TEMPLATES.LOADABLE)).toBeNull();
  });

  it('builds deterministic source and variant paths', () => {
    const sourcePrefix = cmsImageSourcePrefix('snippet-1', 'portrait-card');
    const variantPath = cmsImageVariantPath(`${sourcePrefix}asset-123.jpg`);

    expect(sourcePrefix).toBe('images/cms/sources/snippet-1/portrait-card/');
    expect(variantPath).toBe('images/cms/snippets/snippet-1/variants/portrait-card/asset-123.webp');
  });

  it('defines the renderer contract for crop previews', () => {
    expect(CMS_IMAGE_PROFILES['landscape-card']).toEqual(jasmine.objectContaining({
      width: 800,
      height: 533,
      fit: 'cover',
      aspectRatio: '3 / 2',
    }));
    expect(CMS_IMAGE_PROFILES.inline.fit).toBe('contain');
    expect(CMS_IMAGE_PROFILES['publication-landscape']).toEqual(jasmine.objectContaining({
      width: null,
      height: 300,
      fit: 'contain',
      aspectRatio: null,
    }));
    expect(CMS_IMAGE_PROFILES['tournament-thumbnail-padded']).toEqual(jasmine.objectContaining({
      width: 300,
      height: 200,
      fit: 'contain',
      transparentPadding: true,
    }));
    expect(cmsImageTargetDescription('portrait-card'))
      .toBe('600 × 800 px · ratio 3:4 · WebP · recadrage centré');
    expect(cmsImageTargetDescription('inline'))
      .toBe('400 × 300 px · ratio 4:3 · WebP · image entière sans recadrage');
    expect(cmsImageTargetDescription('publication-landscape'))
      .toBe('hauteur 300 px · largeur proportionnelle · WebP · image entière sans recadrage');
    expect(cmsImageTargetDescription('tournament-thumbnail-padded'))
      .toBe('300 × 200 px · ratio 3:2 · WebP · image entière avec marges transparentes');
  });

  it('detects an orientation mismatch from the profile contract', () => {
    expect(cmsImageOrientationMismatch('portrait-card', 1600, 900)).toBeTrue();
    expect(cmsImageOrientationMismatch('portrait-card', 900, 1600)).toBeFalse();
    expect(cmsImageOrientationMismatch('landscape-card', 900, 1600)).toBeTrue();
  });

  it('calculates matching crop and transparent extension percentages', () => {
    const crop = cmsImageFramingPercentages('tournament-thumbnail', 1200, 1200);
    const extension = cmsImageFramingPercentages('tournament-thumbnail-padded', 1200, 1200);

    expect(crop.width).toBe(0);
    expect(crop.height).toBeCloseTo(33.3, 1);
    expect(extension.width).toBeCloseTo(33.3, 1);
    expect(extension.height).toBe(0);
  });

  it('pairs each eligible crop profile with its transparent variant', () => {
    expect(cmsImageFramingProfiles('landscape-card')).toEqual({
      crop: 'landscape-card',
      padded: 'landscape-card-padded',
    });
    expect(cmsImageFramingProfiles('portrait-card-padded')).toEqual({
      crop: 'portrait-card',
      padded: 'portrait-card-padded',
    });
    expect(cmsImageFramingProfiles('booklet')).toEqual({
      crop: 'booklet',
      padded: 'booklet-padded',
    });
    expect(cmsImageFramingProfiles('inline')).toBeNull();
  });
});
