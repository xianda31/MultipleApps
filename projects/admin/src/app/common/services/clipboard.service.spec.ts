import { of } from 'rxjs';

import { CLIPBOARD_TITLE, Page, PAGE_TEMPLATES, Snippet } from '../interfaces/page_snippet.interface';
import { ClipboardService } from './clipboard.service';
import { PageService } from './page.service';
import { SnippetService } from './snippet.service';

describe('ClipboardService', () => {
  it('assigns the clipboard page as owner when parking an article', async () => {
    const clipboardPage: Page = {
      id: 'clipboard-page',
      title: CLIPBOARD_TITLE,
      template: PAGE_TEMPLATES.PUBLICATION,
      snippet_ids: [],
    };
    const pageService = jasmine.createSpyObj<PageService>('PageService', [
      'getPageByTitle',
      'createPage',
      'updatePage',
    ]);
    pageService.getPageByTitle.and.returnValue(of(clipboardPage));
    pageService.updatePage.and.callFake(page => Promise.resolve(page));
    const snippetService = jasmine.createSpyObj<SnippetService>('SnippetService', [
      'listSnippets',
      'updateSnippet',
    ]);
    snippetService.listSnippets.and.returnValue(of([]));
    snippetService.updateSnippet.and.callFake(snippet => Promise.resolve(snippet));
    const service = new ClipboardService(pageService, snippetService);
    await service.initClipboardPage();

    await service.addSnippet({ id: 'snippet-1', title: 'Article' } as Snippet);

    expect(pageService.updatePage).toHaveBeenCalledWith(jasmine.objectContaining({
      id: clipboardPage.id,
      snippet_ids: ['snippet-1'],
    }));
    expect(snippetService.updateSnippet).toHaveBeenCalledWith(jasmine.objectContaining({
      id: 'snippet-1',
      ownerPageId: clipboardPage.id,
    }));
  });

  it('removes the clipboard reference when changing ownership fails', async () => {
    const clipboardPage: Page = {
      id: 'clipboard-page',
      title: CLIPBOARD_TITLE,
      template: PAGE_TEMPLATES.PUBLICATION,
      snippet_ids: [],
    };
    const pageService = jasmine.createSpyObj<PageService>('PageService', [
      'getPageByTitle',
      'createPage',
      'updatePage',
    ]);
    pageService.getPageByTitle.and.returnValue(of(clipboardPage));
    pageService.updatePage.and.callFake(page => Promise.resolve(page));
    const snippetService = jasmine.createSpyObj<SnippetService>('SnippetService', [
      'listSnippets',
      'updateSnippet',
    ]);
    snippetService.listSnippets.and.returnValue(of([]));
    snippetService.updateSnippet.and.rejectWith(new Error('update failed'));
    const service = new ClipboardService(pageService, snippetService);
    await service.initClipboardPage();

    await expectAsync(service.addSnippet({ id: 'snippet-1', title: 'Article' } as Snippet)).toBeRejected();

    expect(pageService.updatePage.calls.mostRecent().args[0].snippet_ids).toEqual([]);
    expect(service.clipboardSnippets$.value).toEqual([]);
  });
});