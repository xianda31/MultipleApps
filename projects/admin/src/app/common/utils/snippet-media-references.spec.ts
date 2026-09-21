/// <reference types="jasmine" />

import { Snippet } from '../interfaces/page_snippet.interface';
import { canDeleteSnippetMedia, findSnippetMediaReferences } from './snippet-media-references';

describe('snippet media references', () => {
  const snippets = [
    { id: 'owner', image: 'images/shared/photo.webp' },
    { id: 'other-image', image: '/images/shared/photo.webp/' },
    { id: 'album', folder: 'albums/shared' },
    { id: 'document', file: 'documents/rules.pdf' },
  ] as unknown as Snippet[];

  it('blocks deletion while another article references the same object', () => {
    expect(canDeleteSnippetMedia(snippets, 'images/shared/photo.webp', 'owner')).toBeFalse();
    expect(findSnippetMediaReferences(snippets, 'images/shared/photo.webp', 'owner')).toEqual([
      { snippetId: 'other-image', field: 'image' },
    ]);
  });

  it('detects objects contained by a referenced folder', () => {
    expect(findSnippetMediaReferences(snippets, 'albums/shared/event/photo.jpg')).toEqual([
      { snippetId: 'album', field: 'folder' },
    ]);
  });

  it('blocks deleting a folder that contains referenced objects', () => {
    expect(findSnippetMediaReferences(snippets, 'images/shared')).toEqual([
      { snippetId: 'owner', field: 'image' },
      { snippetId: 'other-image', field: 'image' },
    ]);
  });

  it('allows deletion when no other article references the path', () => {
    expect(canDeleteSnippetMedia(snippets, 'documents/rules.pdf', 'document')).toBeTrue();
  });
});