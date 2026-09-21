import assert from 'node:assert/strict';
import test from 'node:test';

import { inventorySnippetOwnership } from './snippet-ownership-inventory';

test('classifies ownership without proposing ambiguous updates', () => {
  const inventory = inventorySnippetOwnership(
    [
      { id: 'page-a', snippetIds: ['assign', 'aligned', 'multi', 'duplicate', 'duplicate', 'missing'] },
      { id: 'page-b', snippetIds: ['multi', 'mismatch'] },
    ],
    [
      { id: 'assign' },
      { id: 'aligned', ownerPageId: 'page-a' },
      { id: 'multi' },
      { id: 'mismatch', ownerPageId: 'page-a' },
      { id: 'duplicate' },
      { id: 'orphan' },
    ],
  );

  assert.deepEqual(inventory.assignments, [
    { snippetId: 'assign', ownerPageId: 'page-a' },
    { snippetId: 'duplicate', ownerPageId: 'page-a' },
  ]);
  assert.deepEqual(inventory.alignedSnippetIds, ['aligned']);
  assert.deepEqual(inventory.conflicts, [
    {
      snippetId: 'mismatch',
      ownerPageId: 'page-a',
      referencedByPageIds: ['page-b'],
      reason: 'owner-mismatch',
    },
    {
      snippetId: 'multi',
      ownerPageId: undefined,
      referencedByPageIds: ['page-a', 'page-b'],
      reason: 'multiple-references',
    },
  ]);
  assert.deepEqual(inventory.orphans, [{ snippetId: 'orphan', ownerPageId: undefined }]);
  assert.deepEqual(inventory.missingSnippetReferences, [
    { snippetId: 'missing', referencedByPageIds: ['page-a'] },
  ]);
  assert.deepEqual(inventory.duplicatePageReferences, [
    { pageId: 'page-a', snippetId: 'duplicate', occurrences: 2 },
  ]);
});
