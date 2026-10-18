import { Snippet } from '../interfaces/page_snippet.interface';
import { buildDocumentTree, listDocumentPathOptions, normalizeDocumentPath } from './document-path';

function snippet(id: string, documentPath?: string): Snippet {
  return {
    id,
    title: id,
    subtitle: '',
    content: '',
    public: true,
    featured: false,
    image: '',
    file: `documents/${id}.pdf`,
    folder: '',
    documentPath,
    ownerPageId: 'documents',
  };
}

describe('document paths', () => {
  it('normalizes separators, whitespace and traversal segments', () => {
    expect(normalizeDocumentPath(' / Vie du club // Statuts / ')).toBe('Vie du club/Statuts');
    expect(normalizeDocumentPath('Formation\\Débutants')).toBe('Formation/Débutants');
    expect(normalizeDocumentPath('Formation/../Débutants/./Supports')).toBe('Formation/Débutants/Supports');
  });

  it('lists existing paths and their selectable parents once', () => {
    expect(listDocumentPathOptions([
      'Formation/Débutants',
      'formation/Débutants/Supports',
    ])).toEqual([
      { path: 'Formation', name: 'Formation', depth: 0 },
      { path: 'Formation/Débutants', name: 'Débutants', depth: 1 },
      { path: 'formation/Débutants/Supports', name: 'Supports', depth: 2 },
    ]);
  });

  it('orders folders by first document appearance and preserves document order', () => {
    const tree = buildDocumentTree([
      snippet('root'),
      snippet('second', 'Vie du club/Statuts'),
      snippet('first', 'Vie du club/Statuts'),
      snippet('course', 'Formation/Débutants'),
    ]);

    expect(tree.rootDocuments.map(document => document.id)).toEqual(['root']);
    expect(tree.nodes.map(node => node.name)).toEqual(['Vie du club', 'Formation']);
    expect(tree.nodes[0].children[0].documents.map(document => document.id))
      .toEqual(['second', 'first']);
  });
});
