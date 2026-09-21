import { PAGE_TEMPLATES, Snippet } from '../../../common/interfaces/page_snippet.interface';

export type SnippetField = 'title' | 'subtitle' | 'content' | 'publishedAt' | 'public' | 'featured' | 'image' | 'file' | 'folder';

export interface SnippetTemplateRule {
  required: SnippetField[];
  visible: SnippetField[];
}

const editorialFields: SnippetField[] = ['title', 'subtitle', 'content', 'publishedAt', 'public', 'featured'];

export const SNIPPET_TEMPLATE_RULES: Record<PAGE_TEMPLATES, SnippetTemplateRule> = {
  [PAGE_TEMPLATES.PUBLICATION]: {
    required: ['title', 'content'],
    visible: [...editorialFields, 'image'],
  },
  [PAGE_TEMPLATES.SEQUENTIAL]: {
    required: ['title', 'content'],
    visible: [...editorialFields, 'image'],
  },
  [PAGE_TEMPLATES.A_LA_UNE]: {
    required: ['title', 'content'],
    visible: [...editorialFields, 'image'],
  },
  [PAGE_TEMPLATES.TROMBINOSCOPE]: {
    required: ['title', 'image'],
    visible: ['title', 'subtitle', 'content', 'public', 'image'],
  },
  [PAGE_TEMPLATES.LOADABLE]: {
    required: ['title', 'file'],
    visible: ['title', 'content', 'public', 'file'],
  },
  [PAGE_TEMPLATES.CARDS_top]: {
    required: ['title', 'image'],
    visible: [...editorialFields, 'image'],
  },
  [PAGE_TEMPLATES.CARDS_top_left]: {
    required: ['title', 'image'],
    visible: [...editorialFields, 'image'],
  },
  [PAGE_TEMPLATES.CARDS_bottom]: {
    required: ['title', 'image'],
    visible: [...editorialFields, 'image'],
  },
  [PAGE_TEMPLATES.ALBUMS]: {
    required: ['title', 'image', 'folder'],
    visible: ['title', 'subtitle', 'public', 'image', 'folder'],
  },
  [PAGE_TEMPLATES.BOOKLET]: {
    required: ['title'],
    visible: [...editorialFields, 'image'],
  },
};

export function snippetMissingFields(snippet: Snippet, template: PAGE_TEMPLATES): SnippetField[] {
  return SNIPPET_TEMPLATE_RULES[template].required.filter(field => {
    const value = snippet[field];
    return typeof value !== 'string' || value.trim().length === 0;
  });
}

export function isSnippetFieldVisible(template: PAGE_TEMPLATES, field: SnippetField): boolean {
  return SNIPPET_TEMPLATE_RULES[template].visible.includes(field);
}