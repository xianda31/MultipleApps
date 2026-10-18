import { Snippet } from '../interfaces/page_snippet.interface';

export function resolvePageSnippets(snippetIds: string[], visibleSnippets: Snippet[]): Snippet[] {
  const snippetsById = new Map(visibleSnippets.map(snippet => [snippet.id, snippet]));
  return snippetIds
    .map(id => snippetsById.get(id))
    .filter((snippet): snippet is Snippet => snippet !== undefined);
}
