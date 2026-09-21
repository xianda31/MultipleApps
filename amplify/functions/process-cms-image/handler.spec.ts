import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCmsImageSource } from './handler';

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
});
