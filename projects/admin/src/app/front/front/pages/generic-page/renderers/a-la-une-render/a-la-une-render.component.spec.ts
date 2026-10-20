import { Snippet } from '../../../../../../common/interfaces/page_snippet.interface';
import { findRecentHighlightIds } from './a-la-une-render.component';

describe('findRecentHighlightIds', () => {
  const now = Date.parse('2026-10-20T12:00:00.000Z');

  it('returns every publication from the last seven days', () => {
    const snippets = [
      snippet('older', '2026-10-15T08:00:00.000Z'),
      snippet('newest', '2026-10-19T18:00:00.000Z'),
      snippet('middle', '2026-10-18T08:00:00.000Z'),
    ];

    expect(Array.from(findRecentHighlightIds(snippets, now))).toEqual([
      'older',
      'newest',
      'middle',
    ]);
  });

  it('returns an empty set when every publication is older than seven days', () => {
    expect(findRecentHighlightIds([
      snippet('old', '2026-10-12T11:59:59.000Z'),
    ], now).size).toBe(0);
  });

  it('ignores invalid and future publication dates', () => {
    expect(findRecentHighlightIds([
      snippet('invalid', 'not-a-date'),
      snippet('future', '2026-10-21T08:00:00.000Z'),
    ], now).size).toBe(0);
  });

  function snippet(id: string, publishedAt: string): Snippet {
    return {
      id,
      publishedAt,
      title: id,
      subtitle: '',
      content: '',
      public: true,
      image: '',
      file: '',
      folder: '',
      featured: true,
      ownerPageId: 'news',
    };
  }
});
