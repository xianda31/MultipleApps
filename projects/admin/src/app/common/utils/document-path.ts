import { Snippet } from '../interfaces/page_snippet.interface';

export interface DocumentPathOption {
  path: string;
  name: string;
  depth: number;
}

export interface DocumentTreeNode extends DocumentPathOption {
  children: DocumentTreeNode[];
  documents: Snippet[];
}

export interface DocumentTree {
  rootDocuments: Snippet[];
  nodes: DocumentTreeNode[];
}

export function normalizeDocumentPath(value?: string | null): string {
  if (!value) return '';

  return value
    .replace(/\\/g, '/')
    .split('/')
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0 && segment !== '.' && segment !== '..')
    .join('/');
}

export function listDocumentPathOptions(paths: Array<string | null | undefined>): DocumentPathOption[] {
  const canonicalPaths = new Map<string, string>();

  paths.forEach(value => {
    const path = normalizeDocumentPath(value);
    if (!path) return;

    const segments = path.split('/');
    for (let index = 1; index <= segments.length; index += 1) {
      const parentPath = segments.slice(0, index).join('/');
      const key = parentPath.toLocaleLowerCase('fr');
      if (!canonicalPaths.has(key)) {
        canonicalPaths.set(key, parentPath);
      }
    }
  });

  return [...canonicalPaths.values()]
    .map(path => {
      const segments = path.split('/');
      return {
        path,
        name: segments.at(-1) ?? path,
        depth: segments.length - 1,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path, 'fr', { sensitivity: 'base' }));
}

export function buildDocumentTree(snippets: Snippet[]): DocumentTree {
  const rootDocuments: Snippet[] = [];
  const rootNodes: DocumentTreeNode[] = [];

  snippets.forEach(snippet => {
    const path = normalizeDocumentPath(snippet.documentPath);
    if (!path) {
      rootDocuments.push(snippet);
      return;
    }

    let nodes = rootNodes;
    let currentPath = '';
    let currentNode: DocumentTreeNode | undefined;

    path.split('/').forEach((segment, depth) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const key = segment.toLocaleLowerCase('fr');
      currentNode = nodes.find(node => node.name.toLocaleLowerCase('fr') === key);
      if (!currentNode) {
        currentNode = {
          name: segment,
          path: currentPath,
          depth,
          children: [],
          documents: [],
        };
        nodes.push(currentNode);
      }
      nodes = currentNode.children;
    });

    currentNode?.documents.push(snippet);
  });

  return {
    rootDocuments,
    nodes: rootNodes,
  };
}
