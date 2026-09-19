import { PAGE_TEMPLATES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { isSnippetFieldVisible, snippetMissingFields } from './snippet-template-rules';

const completeSnippet: Snippet = {
  id: 'snippet-1',
  title: 'Titre',
  subtitle: '',
  content: 'Contenu',
  public: true,
  featured: false,
  image: 'images/example.jpg',
  file: 'documents/example.pdf',
  folder: 'albums/example/',
};

describe('snippet template rules', () => {
  it('requires an album folder', () => {
    expect(snippetMissingFields({ ...completeSnippet, folder: '' }, PAGE_TEMPLATES.ALBUMS)).toEqual(['folder']);
  });

  it('requires a document for a download page', () => {
    expect(snippetMissingFields({ ...completeSnippet, file: '' }, PAGE_TEMPLATES.LOADABLE)).toEqual(['file']);
  });

  it('requires an image for image-card pages', () => {
    expect(snippetMissingFields({ ...completeSnippet, image: '' }, PAGE_TEMPLATES.CARDS_top)).toEqual(['image']);
  });

  it('hides fields that are irrelevant to the template', () => {
    expect(isSnippetFieldVisible(PAGE_TEMPLATES.ALBUMS, 'file')).toBeFalse();
    expect(isSnippetFieldVisible(PAGE_TEMPLATES.LOADABLE, 'folder')).toBeFalse();
  });
});