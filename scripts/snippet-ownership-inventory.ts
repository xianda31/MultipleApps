export interface OwnershipPage {
  id: string;
  title?: string;
  snippetIds: string[];
}

export interface OwnershipSnippet {
  id: string;
  ownerPageId?: string | null;
}

export interface OwnershipAssignment {
  snippetId: string;
  ownerPageId: string;
}

export interface OwnershipConflict {
  snippetId: string;
  ownerPageId?: string;
  referencedByPageIds: string[];
  reason: 'multiple-references' | 'owner-mismatch';
}

export interface DuplicatePageReference {
  pageId: string;
  snippetId: string;
  occurrences: number;
}

export interface OrphanSnippet {
  snippetId: string;
  ownerPageId?: string;
}

export interface MissingSnippetReference {
  snippetId: string;
  referencedByPageIds: string[];
}

export interface OwnershipInventory {
  assignments: OwnershipAssignment[];
  alignedSnippetIds: string[];
  conflicts: OwnershipConflict[];
  orphans: OrphanSnippet[];
  missingSnippetReferences: MissingSnippetReference[];
  duplicatePageReferences: DuplicatePageReference[];
}

export function inventorySnippetOwnership(
  pages: OwnershipPage[],
  snippets: OwnershipSnippet[],
): OwnershipInventory {
  const snippetById = new Map(snippets.map(snippet => [snippet.id, snippet]));
  const referencesBySnippetId = new Map<string, Set<string>>();
  const duplicatePageReferences: DuplicatePageReference[] = [];

  for (const page of pages) {
    const occurrences = new Map<string, number>();
    for (const snippetId of page.snippetIds.filter(Boolean)) {
      occurrences.set(snippetId, (occurrences.get(snippetId) ?? 0) + 1);
      const pageIds = referencesBySnippetId.get(snippetId) ?? new Set<string>();
      pageIds.add(page.id);
      referencesBySnippetId.set(snippetId, pageIds);
    }

    for (const [snippetId, count] of occurrences) {
      if (count > 1) {
        duplicatePageReferences.push({ pageId: page.id, snippetId, occurrences: count });
      }
    }
  }

  const assignments: OwnershipAssignment[] = [];
  const alignedSnippetIds: string[] = [];
  const conflicts: OwnershipConflict[] = [];
  const orphans: OrphanSnippet[] = [];

  for (const snippet of snippets) {
    const referencedByPageIds = [...(referencesBySnippetId.get(snippet.id) ?? [])].sort();
    if (referencedByPageIds.length === 0) {
      orphans.push({ snippetId: snippet.id, ownerPageId: snippet.ownerPageId ?? undefined });
    } else if (referencedByPageIds.length > 1) {
      conflicts.push({
        snippetId: snippet.id,
        ownerPageId: snippet.ownerPageId ?? undefined,
        referencedByPageIds,
        reason: 'multiple-references',
      });
    } else if (snippet.ownerPageId && snippet.ownerPageId !== referencedByPageIds[0]) {
      conflicts.push({
        snippetId: snippet.id,
        ownerPageId: snippet.ownerPageId,
        referencedByPageIds,
        reason: 'owner-mismatch',
      });
    } else if (snippet.ownerPageId === referencedByPageIds[0]) {
      alignedSnippetIds.push(snippet.id);
    } else {
      assignments.push({ snippetId: snippet.id, ownerPageId: referencedByPageIds[0] });
    }
  }

  const missingSnippetReferences = [...referencesBySnippetId.entries()]
    .filter(([snippetId]) => !snippetById.has(snippetId))
    .map(([snippetId, pageIds]) => ({ snippetId, referencedByPageIds: [...pageIds].sort() }))
    .sort((left, right) => left.snippetId.localeCompare(right.snippetId));

  return {
    assignments: assignments.sort((left, right) => left.snippetId.localeCompare(right.snippetId)),
    alignedSnippetIds: alignedSnippetIds.sort(),
    conflicts: conflicts.sort((left, right) => left.snippetId.localeCompare(right.snippetId)),
    orphans: orphans.sort((left, right) => left.snippetId.localeCompare(right.snippetId)),
    missingSnippetReferences,
    duplicatePageReferences: duplicatePageReferences.sort((left, right) =>
      left.pageId.localeCompare(right.pageId) || left.snippetId.localeCompare(right.snippetId)),
  };
}
