import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { Snippet } from '../interfaces/page_snippet.interface';
import { SnippetService } from './snippet.service';

@Injectable({ providedIn: 'root' })
export class HomeHighlightsService {
  constructor(private snippetService: SnippetService) {}

  listHighlights(): Observable<Snippet[]> {
    return this.snippetService.listSnippets().pipe(
      map(snippets => snippets
        .filter(snippet => snippet.featured)
        .sort((left, right) => (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''))),
    );
  }
}
