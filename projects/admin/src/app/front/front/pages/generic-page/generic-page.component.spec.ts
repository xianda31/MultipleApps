import { PAGE_TEMPLATES, Page, Snippet } from '../../../../common/interfaces/page_snippet.interface';
import { GenericPageComponent } from './generic-page.component';

function snippet(id: string): Snippet {
  return {
    id,
    title: id,
    subtitle: '',
    content: '',
    public: true,
    featured: false,
    image: '',
    file: '',
    folder: '',
    ownerPageId: 'documents',
  };
}

describe('GenericPageComponent snippet filtering', () => {
  it('rebuilds internally loaded page snippets when the visible snippet list changes', () => {
    const titleService = { setTitle: jasmine.createSpy('setTitle') };
    const component = new GenericPageComponent(
      {} as any,
      {} as any,
      titleService as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const page: Page = {
      id: 'documents',
      title: 'documents',
      template: PAGE_TEMPLATES.LOADABLE,
      snippet_ids: ['public', 'private'],
    };
    component.pages = [page];
    component.snippets = [snippet('public')];
    component.page_snippets = [snippet('private')];

    component.filter_PageSnippets(page.title);

    expect(component.page_snippets.map(item => item.id)).toEqual(['public']);
    expect(titleService.setTitle).toHaveBeenCalledWith(page.title);
  });
});
