import { PAGE_TEMPLATES } from '../interfaces/page_snippet.interface';
import {
  CMS_IMAGE_PROFILES,
  cmsImageOrientationMismatch,
  cmsImageSourcePrefix,
  cmsImageVariantPath,
  imageProfileForTemplate,
} from './cms-image-profiles';

describe('CMS image profiles', () => {
  it('groups page templates by actual image usage', () => {
    expect(imageProfileForTemplate(PAGE_TEMPLATES.PUBLICATION)).toBe('inline');
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
  });

  it('detects an orientation mismatch from the profile contract', () => {
    expect(cmsImageOrientationMismatch('portrait-card', 1600, 900)).toBeTrue();
    expect(cmsImageOrientationMismatch('portrait-card', 900, 1600)).toBeFalse();
    expect(cmsImageOrientationMismatch('landscape-card', 900, 1600)).toBeTrue();
  });
});
