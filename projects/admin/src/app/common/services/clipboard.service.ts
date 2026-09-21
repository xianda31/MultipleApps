import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { CLIPBOARD_TITLE, Page, Snippet } from '../interfaces/page_snippet.interface';
import { PageService } from './page.service';
import { SnippetService } from './snippet.service';

@Injectable({ providedIn: 'root' })
export class ClipboardService {
  private clipboardPage: Page | null = null;
  private _clipboardSnippets$ = new BehaviorSubject<Snippet[]>([]);



  public get clipboardSnippets$(): BehaviorSubject<Snippet[]> {
    return this._clipboardSnippets$;
  }

  constructor(private pageService: PageService, private snippetService: SnippetService) {
    this.initClipboardPage();
  }

  async initClipboardPage() {
    // Cherche la page clipboard, sinon la crée
    const clipboard = await firstValueFrom(this.pageService.getPageByTitle(CLIPBOARD_TITLE));
    if (clipboard) {
      this.clipboardPage = clipboard;
      const allSnippets = await firstValueFrom(this.snippetService.listSnippets());
      const clipboardSnippets = clipboard.snippet_ids
        .map(id => allSnippets.find(s => s.id === id))
        .filter(s => s !== undefined) as Snippet[];
      this._clipboardSnippets$.next(clipboardSnippets);
    } else {
      const newPage = await this.pageService.createPage({
        id: '',
        title: CLIPBOARD_TITLE,
        template: 'publication',
        snippet_ids: []
      } as Page);
      this.clipboardPage = newPage;
      this._clipboardSnippets$.next([]);
      console.warn('Clipboard page created');
    }
  }

  async addSnippet(snippet: Snippet) {
    if (!this.clipboardPage) await this.initClipboardPage();
    if (this.clipboardPage) {
      const clipboardSnippet = { ...snippet, ownerPageId: this.clipboardPage.id };
      const originalSnippetIds = [...this.clipboardPage.snippet_ids];
      const updatedClipboardPage = {
        ...this.clipboardPage,
        snippet_ids: originalSnippetIds.includes(snippet.id)
          ? originalSnippetIds
          : [...originalSnippetIds, snippet.id],
      };

      await this.pageService.updatePage(updatedClipboardPage);
      try {
        await this.snippetService.updateSnippet(clipboardSnippet);
      } catch (error) {
        try {
          await this.pageService.updatePage({ ...updatedClipboardPage, snippet_ids: originalSnippetIds });
        } catch {
          // Preserve the original ownership failure for the caller.
        }
        throw error;
      }

      this.clipboardPage = updatedClipboardPage;
      if (!this._clipboardSnippets$.value.some(item => item.id === snippet.id)) {
        this._clipboardSnippets$.next([...this._clipboardSnippets$.value, clipboardSnippet]);
      }
    }
  }

  async removeSnippet(snippetId: string) {
    if (!this.clipboardPage) await this.initClipboardPage();
    if (this.clipboardPage) {
      const updatedClipboardPage = {
        ...this.clipboardPage,
        snippet_ids: this.clipboardPage.snippet_ids.filter(id => id !== snippetId),
      };
      await this.pageService.updatePage(updatedClipboardPage);
      this.clipboardPage = updatedClipboardPage;
      this._clipboardSnippets$.next(this._clipboardSnippets$.value.filter(s => s.id !== snippetId));
    }
  }

  // async clear() {
  //   if (!this.clipboardPage) await this.initClipboardPage();
  //   this._clipboardSnippets$.next([]);
  //   if (this.clipboardPage) {
  //     this.clipboardPage.snippet_ids = [];
  //     await this.pageService.updatePage(this.clipboardPage);
  //   }
  // }

}
