import { BehaviorSubject, of } from 'rxjs';
import { Snippet } from '../interfaces/page_snippet.interface';
import { SnippetService } from './snippet.service';

function snippet(id: string, isPublic: boolean): Snippet {
  return {
    id,
    title: id,
    subtitle: '',
    content: '',
    public: isPublic,
    featured: false,
    image: '',
    file: '',
    folder: '',
    ownerPageId: 'documents',
  };
}

describe('SnippetService visibility', () => {
  it('removes private snippets when the member logs out', async () => {
    const loggedMember$ = new BehaviorSubject<any>({ id: 'member-1' });
    const service = new SnippetService(
      { logged_member$: loggedMember$ } as any,
      {} as any,
      {} as any,
      { listSnippets: () => of([snippet('public', true), snippet('private', false)]) } as any,
    );
    let visibleSnippets: Snippet[] = [];

    service.listSnippets().subscribe(snippets => {
      visibleSnippets = snippets;
    });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(visibleSnippets.map(item => item.id)).toEqual(['public', 'private']);

    loggedMember$.next(null);

    expect(visibleSnippets.map(item => item.id)).toEqual(['public']);
  });
});
