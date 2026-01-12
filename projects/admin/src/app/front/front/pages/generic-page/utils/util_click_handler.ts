// util_click_handler.ts
// Utilitaire pour attacher un handler sur les liens <a> générés dynamiquement dans du HTML injecté

export function attachExternalLinkHandler(root: HTMLElement) {
  root.querySelectorAll('a').forEach((a: HTMLAnchorElement) => {
    if ((a as any)._customHandlerAttached) return;
    (a as any)._customHandlerAttached = true;
    a.addEventListener('click', (event: MouseEvent) => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (/^https?:\/\//i.test(href)) {
        event.preventDefault();
        window.open(href, '_blank', 'noopener');
      }
    });
  });
}
