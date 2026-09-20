import { firstValueFrom, of } from 'rxjs';

import { Snippet } from '../interfaces/page_snippet.interface';
import { SnippetService } from './snippet.service';
import { HomeHighlightsService } from './home-highlights.service';

describe('HomeHighlightsService', () => {
  it('selects featured snippets and orders them by publication date', async () => {
    const snippets = [
      { id: 'regular', featured: false, publishedAt: '2026-09-20' },
      { id: 'older', featured: true, publishedAt: '2026-08-10' },
      { id: 'newer', featured: true, publishedAt: '2026-09-10' },
    ] as Snippet[];
    const snippetService = jasmine.createSpyObj<SnippetService>('SnippetService', ['listSnippets']);
    snippetService.listSnippets.and.returnValue(of(snippets));
    const service = new HomeHighlightsService(snippetService);

    const highlights = await firstValueFrom(service.listHighlights());

    expect(highlights.map(snippet => snippet.id)).toEqual(['newer', 'older']);
  });
});
