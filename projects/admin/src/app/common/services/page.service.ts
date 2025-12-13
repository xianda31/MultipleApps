import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, switchMap, tap, shareReplay } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { DBhandler } from './graphQL.service';
import { Page, Page_input } from '../interfaces/page_snippet.interface';

@Injectable({
  providedIn: 'root'
})
export class PageService {
  private _pages: Page[] = [];
  private _pages$ = new BehaviorSubject<Page[]>([]);
  private _pagesLoading$?: Observable<Page[]>;

  constructor(
    private toastService: ToastService,
    private dbHandler: DBhandler
  ) {}

  // Create
  async createPage(page: Page): Promise<Page> {
    let page_input: Page_input = {
      title: page.title,
      template: page.template,
      snippet_ids: page.snippet_ids
    };
    try {
      const createdPage = await this.dbHandler.createPage(page_input);
      this._pages.push(createdPage as Page);
      this._pages$.next(this._pages);
      return createdPage;
    } catch (error) {
      this.toastService.showErrorToast('Pages', 'Erreur lors de la création');
      return Promise.reject(error);
    }
  }


  // List
  listPages(): Observable<Page[]> {
    if (this._pages && this._pages.length > 0) return this._pages$.asObservable();
    if (this._pagesLoading$) return this._pagesLoading$;

    this._pagesLoading$ = this.dbHandler.listPages().pipe(
      map((pages: Page[]) => {
        this._pages = pages;
        this._pages$.next(pages);
        return pages;
      }),
      tap(() => { this._pagesLoading$ = undefined; }),
      shareReplay(1)
    );

    return this._pagesLoading$;
  }

  // Get one
  getPage(pageId: string): Page | undefined {
    return this._pages.find(page => page.id === pageId);
  }

  getPageByTitle(title: string): Observable<Page | undefined> {
    return this.listPages().pipe(
      map(pages => pages.find(page => page.title === title))
    );
  }

  // Update
  async updatePage(page: Page): Promise<Page> {
    try {
      const updatedPage = await this.dbHandler.updatePage(page);
      this._pages = this._pages.map(p => p.id === updatedPage.id ? updatedPage : p);
      this._pages$.next(this._pages);
      return updatedPage;
    } catch (error) {
      this.toastService.showErrorToast('Pages', 'Erreur lors de la modification');
      return Promise.reject(error);
    }
  }

  // Delete
  async deletePage(page: Page): Promise<boolean> {
    try {
      await this.dbHandler.deletePage(page.id);
      this._pages = this._pages.filter(p => p.id !== page.id);
      this._pages$.next(this._pages);
      return true;
    } catch (error) {
      this.toastService.showErrorToast('Pages', 'Erreur lors de la suppression');
      return Promise.reject(error);
    }
  }
}
