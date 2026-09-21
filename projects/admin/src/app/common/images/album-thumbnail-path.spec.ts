import { replaceImageExtensionWithWebp } from './album-thumbnail-path';

describe('replaceImageExtensionWithWebp', () => {
  it('replaces common image extensions without changing the path', () => {
    expect(replaceImageExtensionWithWebp('albums/été/photo.jpeg')).toBe('albums/été/photo.webp');
    expect(replaceImageExtensionWithWebp('albums/photo.PNG')).toBe('albums/photo.webp');
  });

  it('adds the extension when the file has none', () => {
    expect(replaceImageExtensionWithWebp('albums/photo')).toBe('albums/photo.webp');
  });
});
