import { Injectable } from '@angular/core';
import { Menu, Page } from '../menu.interface';
import { BehaviorSubject, combineLatest, from, map, Observable, of, tap } from 'rxjs';
import { generateClient } from 'aws-amplify/api';
import { data, Schema } from '../../../amplify/data/resource';

@Injectable({
  providedIn: 'root'
})
export class SiteLayoutService {
  private _pages!: Page[];
  private _menus!: Menu[];

  constructor() { }

  // utilitaires
  getFullPathAsync(pageId: string): Promise<string> {
    const client = generateClient<Schema>();
    return new Promise<string>(async (resolve, reject) => {
      const { data, errors } = await client.models.Page.get({ id: pageId }, { selectionSet: ["menuId", "link"] });
      if (errors) { console.error(errors); reject(errors); }
      let page: Page = data as unknown as Page;
      let menu = this._menus.find((m) => m.id === page.menuId);
      if (!menu) { reject('menu not found'); } else {
        if (menu.pages.length === 1) {
          resolve(menu.label);
        } else {
          resolve(menu.label + ' > ' + page.link);
        }
      }
    });
  }

  private getMenuRank(menu_id: string): number {
    let menu = this._menus.find((m) => m.id === menu_id);
    return menu ? menu.rank : 0;
  }

  // private menusSubscription() {
  //   const client = generateClient<Schema>();

  //   client.models.Menu.observeQuery({ selectionSet: ["id", "label", "rank", "pages.*"] })
  //     .subscribe({
  //       next: (data) => {
  //         this._menus = data.items as unknown as Menu[];
  //         const iSynced = data.isSynced;
  //         if (iSynced) { console.log('menus  synced '); }
  //         // check if pages are there ; there is a bug in the API :o((
  //         this._menus = this._menus.map((m) => {
  //           if (typeof m.pages === 'function') {
  //             console.log(' menu "%s" has lost its pages  !!...', m.label);
  //           } else {
  //             m.pages = m.pages.sort((a, b) => a.rank - b.rank);
  //           }
  //           return m;
  //         });
  //         this._menus = this._menus.sort((a, b) => a.rank - b.rank);

  //         // this.menus_loaded = data.isSynced
  //         this._menus$.next(this._menus);
  //         // console.log('menus_loaded', this._menus);
  //       },
  //       error: (error) => {
  //         console.error('error', error);
  //       }
  //     });
  // }


  // private pagesSubscription() {
  //   const client = generateClient<Schema>();
  //   client.models.Page.observeQuery({ selectionSet: ["id", "menuId", "link", "template", "rank", "member_only", "articles.*"] })
  //     .subscribe({
  //       next: (data) => {
  //         // console.log('pages', data.items);
  //         this._pages = data.items as unknown as Page[];
  //         this._pages = this._pages
  //           .sort((a, b) => a.rank - b.rank)
  //           .sort((a, b) => a.menuId.localeCompare(b.menuId))
  //           .sort((a, b) => this.getMenuRank(a.menuId) - this.getMenuRank(b.menuId));
  //         this.pages_loaded = data.isSynced

  //         this._pages$.next(this._pages);
  //         // console.log('pages_loaded', this._pages);
  //       },
  //       error: (error) => {
  //         console.error('error', error);
  //       }
  //     });
  // }

  // menu REST API



  createMenu(menu: Menu) {
    return new Promise<any>(async (resolve, reject) => {
      let { id, ...menuCreateInput } = menu;
      const client = generateClient<Schema>();
      const { data: data, errors } = await client.models.Menu.create(menuCreateInput);
      if (errors) { console.error(errors); reject(errors); }
      let newMenu: Menu = { id: data?.id!, ...menuCreateInput };;
      // console.log('newMenu', newMenu);
      if (newMenu) {
        this._menus.push(newMenu as Menu);
        // this._menus$.next(this._menus);
        resolve(newMenu);
      } else {
        reject('Menu not created');
      }
    });
  }

  readMenu(menu_id: string) {
    return new Promise<Menu>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data: data, errors } = await client.models.Menu.get(
        { id: menu_id }, { selectionSet: ["id", "label", "rank", "pages.*"] }
      );
      if (errors) { console.error(errors); reject(errors); }
      let menu: Menu = data as unknown as Menu;
      resolve(menu);
    });
  }


  getMenus(): Observable<Menu[]> {
    const ob_readMenus = (): Observable<Menu[]> => {
      const client = generateClient<Schema>();
      return from(client.models.Menu.list({ selectionSet: ["id", "label", "rank", "pages.*"] })).pipe(
        // tap(response => console.log('menus', response.data)),
        map((response) => response.data as Menu[]),
        map((menus) => menus.sort((a, b) => a.rank - b.rank)),
        tap((menus) => this._menus = menus),
      );
    }

    return this._menus ? of(this._menus) : ob_readMenus();
  }

  getLayout(): Observable<{ menus: Menu[], pages: Page[] }> {
    // console.log('getLayout');
    return combineLatest([this.getMenus(), this.getPages()]).pipe(
      map(([menus, pages]) => ({ menus, pages }))
    );
  }


  updateMenu(menu: Menu) {
    return new Promise<void>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data: data, errors } = await client.models.Menu.update(menu);
      if (errors) { console.error(errors); reject(errors); }
      let updatedMenu: Menu = data as unknown as Menu;
      this._menus = this._menus.map(m => m.id === updatedMenu.id ? updatedMenu : m);
      // this._menus$.next(this._menus);
      // this.readMenus();
      resolve();
    });
  }

  deleteMenu(menuId: string) {
    return new Promise<any>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data, errors } = await client.models.Menu.delete({ id: menuId });
      if (errors) { console.error(errors); reject(errors); }
      this._menus = this._menus.filter(m => m.id !== menuId);
      // this._menus$.next(this._menus);
      resolve(data);
    });

  }

  // page REST API

  createPage(page: Page) {
    return new Promise<any>(async (resolve, reject) => {
      let { id, ...pageCreateInput } = page;
      const client = generateClient<Schema>();
      const { data: data, errors } = await client.models.Page.create(pageCreateInput);
      if (errors) { console.error(errors); reject(errors); }
      let newPage: Page = { id: data?.id!, ...pageCreateInput };;
      // console.log('newPage', newPage);
      if (newPage) {
        this._pages.push(newPage as Page);
        // this._pages$.next(this._pages);

        let menu = this._menus.find((m) => m.id === newPage.menuId);
        if (menu) {
          menu.pages.push(newPage);
          this.updateMenu(menu).then(() => { });
        }
        resolve(newPage);
      } else {
        reject('Page not created');
      }
    });
  }
  getPage(page_id: string): Page | undefined {
    return this._pages.find((p) => p.id === page_id);
  }
  getPages(): Observable<Page[]> {
    const ob_readPages = (): Observable<Page[]> => {
      const client = generateClient<Schema>();
      return from(client.models.Page.list({ selectionSet: ["id", "menuId", "link", "template", "rank", "member_only", "articles.*"] })).pipe(
        // tap(response => console.log('pages', response.data)),
        map((response) => response.data as Page[]),
        map((pages) => pages.sort((a, b) => a.rank - b.rank)),
        map((pages) => pages.sort((a, b) => a.menuId.localeCompare(b.menuId))),
        // map((pages) => pages.sort((a, b) => this.getMenuRank(a.menuId) - this.getMenuRank(b.menuId))),
        tap((pages) => this._pages = pages),
        // tap((pages) => this._pages$.next(pages))
      );
    }

    return this._pages ? of(this._pages) : ob_readPages();
  }



  readPage(page_id: string) {
    return new Promise<any>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data: data, errors } = await client.models.Page.get(
        { id: page_id }, { selectionSet: ["template", "member_only", "articles.*"] }
      );
      if (errors) { console.error(errors); reject(errors); }
      let page: Page = data as unknown as Page;
      resolve(page);
    });
  }

  updatePage(page: Page) {
    return new Promise<any>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data: data, errors } = await client.models.Page.update(page);
      if (errors) { console.error(errors); reject(errors); }

      let updatedPage: Page = data as unknown as Page;
      this._pages = this._pages.map(p => p.id === updatedPage.id ? updatedPage : p);
      this._pages = this._pages.sort((a, b) => this.getMenuRank(a.menuId) - this.getMenuRank(b.menuId));

      // this._pages$.next(this._pages);

      if (page.menuId !== updatedPage.menuId) {
        this._menus = this._menus.filter((m) => m.id !== page.menuId);
        let menu = this._menus.find((m) => m.id === updatedPage.menuId);
        if (menu) {
          menu.pages.push(page);
        } else {
          reject('oups ! menu not found');
        }
      }


      resolve(updatedPage);
    });
  }

  deletePage(page: Page) {
    return new Promise<any>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data, errors } = await client.models.Page.delete({ id: page.id });
      if (errors) { console.error(errors); reject(errors); }
      this._pages = this._pages.filter(p => p.id !== page.id);
      this._pages = this._pages.sort((a, b) => this.getMenuRank(a.menuId) - this.getMenuRank(b.menuId));
      // this._pages$.next(this._pages);

      this._menus = this._menus.filter((m) => m.id !== page.menuId);
      // this._menus$.next(this._menus);
      // this.readMenus();

      resolve(data);
    });
  }

  deleteAllPages(menuId: string) {
    return new Promise<any>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      this._pages
        .filter(p => p.menuId === menuId)
        .map(async (p) => { this.deletePage(p).then(() => { }); })

      resolve('pages deleted');
    });
  }

}


