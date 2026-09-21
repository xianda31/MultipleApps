import type { Snippet } from '../interfaces/page_snippet.interface';

export type SnippetMediaField = 'image' | 'file' | 'folder';

export interface SnippetMediaReference {
  snippetId: string;
  field: SnippetMediaField;
}

function normalizedPath(path: string | undefined): string | undefined {
  const value = path?.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return value || undefined;
}

export function findSnippetMediaReferences(
  snippets: Snippet[],
  mediaPath: string,
  excludedSnippetId?: string,
): SnippetMediaReference[] {
  const target = normalizedPath(mediaPath);
  if (!target) return [];

  return snippets.flatMap(snippet => {
    if (snippet.id === excludedSnippetId) return [];

    const references: SnippetMediaReference[] = [];
    for (const field of ['image', 'file', 'folder'] as const) {
      const reference = normalizedPath(snippet[field]);
      if (!reference) continue;
      const targetContainsReference = reference.startsWith(`${target}/`);
      const referencedFolderContainsTarget = field === 'folder' && target.startsWith(`${reference}/`);
      if (reference === target || targetContainsReference || referencedFolderContainsTarget) {
        references.push({ snippetId: snippet.id, field });
      }
    }
    return references;
  });
}

export function canDeleteSnippetMedia(
  snippets: Snippet[],
  mediaPath: string,
  ownerSnippetId: string,
): boolean {
  return findSnippetMediaReferences(snippets, mediaPath, ownerSnippetId).length === 0;
}