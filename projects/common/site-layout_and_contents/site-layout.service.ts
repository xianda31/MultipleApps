import { Injectable } from '@angular/core';
import { Menu, Page } from '../menu.interface';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../amplify/data/resource';

@Injectable({
  providedIn: 'root'
})
export class SiteLayoutService {
  private _pages: Page[] = [];
  pages_loaded: boolean = false;
  private _pages$: BehaviorSubject<Page[]> = new BehaviorSubject<Page[]>(this._pages);

  pages$ = this._pages$.asObservable();



  private _menus: Menu[] = [];
  menus_loaded: boolean = false;
  private _menus$: BehaviorSubject<Menu[]> = new BehaviorSubject<Menu[]>(this._menus);
  menus$ = this._menus$.asObservable();

  // _layout$: BehaviorSubject<[Menu[], Page[]]> = new BehaviorSubject<[Menu[], Page[]]>([this._menus, this._pages]);
  private _layout$ = combineLatest([this._menus$, this._pages$]);
  layout$ = this._layout$;

  constructor() {

    const client = generateClient<Schema>();


    client.models.Menu.observeQuery({ selectionSet: ["id", "label", "summary", "rank", "pages.*"] })
      .subscribe({
        next: (data) => {
          this._menus = data.items as unknown as Menu[];
          this._menus = this._menus.sort((a, b) => a.rank - b.rank);
          // this.menus_loaded = data.isSynced
          this._menus$.next(this._menus);
          // console.log('menus_loaded', this._menus);
          this.pagesSubscription();
        },
        error: (error) => {
          console.error('error', error);
        }
      });


  }

  pagesSubscription() {
    const client = generateClient<Schema>();
    client.models.Page.observeQuery({ selectionSet: ["id", "menuId", "link", "layout", "summary"] })
      .subscribe({
        next: (data) => {
          // console.log('pages', data.items);
          this._pages = data.items as unknown as Page[];
          this._pages = this._pages.sort((a, b) => a.menuId.localeCompare(b.menuId));
          this.pages_loaded = data.isSynced
          this._pages = this._pages.sort((a, b) => this.getMenu(a.menuId)!.rank - this.getMenu(b.menuId)!.rank);

          this._pages$.next(this._pages);
          // console.log('pages_loaded', this._pages);
        },
        error: (error) => {
          console.error('error', error);
        }
      });
  }

  // menu REST API

  listMenus() {
    const client = generateClient<Schema>();
    client.models.Menu.list({ selectionSet: ["id", "label", "summary", "rank", "pages.*"] })
      .then(({ data, errors }) => {
        if (errors) { console.error(errors); }
        this._menus = data as unknown as Menu[];
        this._menus = this._menus.sort((a, b) => a.rank - b.rank);
        this._menus$.next(this._menus);
      });
  }



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
        this._menus$.next(this._menus);
        resolve(newMenu);
      } else {
        reject('Menu not created');
      }
    });
  }

  getMenu(menu_id: string): Menu | undefined {
    return this._menus.find((m) => m.id === menu_id);
  }

  updateMenu(menu: Menu) {
    return new Promise<any>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data: data, errors } = await client.models.Menu.update(menu);
      if (errors) { console.error(errors); reject(errors); }
      let updatedMenu: Menu = data as unknown as Menu;
      this._menus = this._menus
        .map(m => m.id === updatedMenu.id ? updatedMenu : m)
        .sort((a, b) => a.rank - b.rank);
      this._menus$.next(this._menus);
      resolve(updatedMenu);
    });
  }

  deleteMenu(menuId: string) {
    return new Promise<any>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data, errors } = await client.models.Menu.delete({ id: menuId });
      if (errors) { console.error(errors); reject(errors); }
      this._menus = this._menus.filter(m => m.id !== menuId);
      this._menus$.next(this._menus);
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
        this._pages$.next(this._pages);
        this.listMenus();
        resolve(newPage);
      } else {
        reject('Page not created');
      }
    });
  }
  getPage(page_id: string): Page | undefined {
    return this._pages.find((p) => p.id === page_id);
  }
  readPage(page_id: string) {
    return new Promise<any>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data: data, errors } = await client.models.Page.get(
        { id: page_id }, { selectionSet: ["layout", "summary", "articles.*"] }
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
      this._pages = this._pages.sort((a, b) => this.getMenu(a.menuId)!.rank - this.getMenu(b.menuId)!.rank);

      this._pages$.next(this._pages);
      this.listMenus();

      resolve(updatedPage);
    });
  }

  deletePage(pageId: string) {
    return new Promise<any>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data, errors } = await client.models.Page.delete({ id: pageId });
      if (errors) { console.error(errors); reject(errors); }
      this._pages = this._pages.filter(p => p.id !== pageId);
      this._pages = this._pages.sort((a, b) => this.getMenu(a.menuId)!.rank - this.getMenu(b.menuId)!.rank);
      this._pages$.next(this._pages);
      this.listMenus();

      resolve(data);
    });
  }


}
