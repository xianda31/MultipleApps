import { Snippet } from '../interfaces/page_snippet.interface';
import { resolvePageSnippets } from './page-snippet-filter';

function snippet(id: string): Snippet {
  return {
    id,
    title: id,
    subtitle: '',
    content: '',
    public: true,
    featured: false,
    image: '',
    file: '',
    folder: '',
    ownerPageId: 'documents',
  };
}

describe('resolvePageSnippets', () => {
  it('keeps page order and removes snippets absent from the visible list', () => {
    expect(resolvePageSnippets(
      ['first', 'private', 'second'],
      [snippet('second'), snippet('first')],
    ).map(item => item.id)).toEqual(['first', 'second']);
  });
});
