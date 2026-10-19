const ALLOWED_TAGS = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'EM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'I', 'LI', 'MARK', 'OL', 'P', 'S', 'SPAN', 'STRONG', 'TABLE', 'TBODY', 'TD',
  'TFOOT', 'TH', 'THEAD', 'TR', 'U', 'UL',
]);

const DROP_WITH_CONTENT = new Set([
  'EMBED', 'IFRAME', 'MATH', 'OBJECT', 'SCRIPT', 'STYLE', 'SVG', 'TEMPLATE',
]);

const ALLOWED_TABLE_CLASSES = new Set([
  'equal-cols', 'fit-cols', 'table', 'table-borderless', 'table-sm',
]);

export function sanitizeSnippetHtml(html: string): string {
  if (!html) {
    return '';
  }

  const documentNode = new DOMParser().parseFromString(`<div id="snippet-root">${html}</div>`, 'text/html');
  const root = documentNode.getElementById('snippet-root');
  if (!root) {
    return '';
  }

  sanitizeChildren(root);
  return root.innerHTML;
}

function sanitizeChildren(parent: Element): void {
  Array.from(parent.childNodes).forEach(node => {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.remove();
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node as HTMLElement;
    const tag = element.tagName;
    if (DROP_WITH_CONTENT.has(tag)) {
      element.remove();
      return;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      sanitizeChildren(element);
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    sanitizeChildren(element);
    sanitizeAttributes(element);
  });
}

function sanitizeAttributes(element: HTMLElement): void {
  const href = element.tagName === 'A' ? safeHref(element.getAttribute('href')) : null;
  const color = safeColor(element.style.color);
  const tableClasses = element.tagName === 'TABLE'
    ? Array.from(element.classList).filter(className => ALLOWED_TABLE_CLASSES.has(className))
    : [];
  const colspan = numericSpan(element.getAttribute('colspan'));
  const rowspan = numericSpan(element.getAttribute('rowspan'));

  Array.from(element.attributes).forEach(attribute => element.removeAttribute(attribute.name));

  if (href) {
    element.setAttribute('href', href);
  }
  if (color) {
    element.style.color = color;
  }
  if (tableClasses.length) {
    element.classList.add(...tableClasses);
  }
  if ((element.tagName === 'TD' || element.tagName === 'TH') && colspan) {
    element.setAttribute('colspan', colspan);
  }
  if ((element.tagName === 'TD' || element.tagName === 'TH') && rowspan) {
    element.setAttribute('rowspan', rowspan);
  }
}

function safeHref(value: string | null): string | null {
  const href = value?.trim();
  if (!href) {
    return null;
  }
  return /^(?:https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(href) ? href : null;
}

function safeColor(value: string): string | null {
  const color = value.trim();
  if (!color || /url|var|expression/i.test(color)) {
    return null;
  }

  const probe = document.createElement('span');
  probe.style.color = color;
  return probe.style.color || null;
}

function numericSpan(value: string | null): string | null {
  return value && /^[1-9]\d?$/.test(value) ? value : null;
}
