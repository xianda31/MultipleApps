import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of, switchMap, tap } from 'rxjs';
import { ToastService } from './toast.service';
import { DBhandler } from './graphQL.service';
import { MenuStructure, NavItem, NavItem_input, NAVITEM_TYPE } from '../interfaces/navitem.interface';
import { routes } from '../../front/front.routes';
import { Routes } from '@angular/router';
import { GenericPageComponent } from '../../front/front/pages/generic-page/generic-page.component';

@Injectable({
  providedIn: 'root'
})
export class NavItemsService {
  private _navItems: NavItem[] = [];
  private _navItems$ = new BehaviorSubject<NavItem[]>([]);

  constructor(
    private toastService: ToastService,
    private dbHandler: DBhandler,
  ) {}


  getFrontRoutes(sandbox?: boolean): Observable<Routes> {
    const _getFrontRoutes = (nav_items : NavItem[]): Routes => {
      let new_routes: Routes = [...routes];
      nav_items.forEach(item => {
        if ( item.type === NAVITEM_TYPE.CUSTOM_PAGE ) {
          new_routes[0].children?.unshift({path: item.path, component: GenericPageComponent, data: { page_title: item.page_title } });
        }
      });
      return (new_routes);
    }

    return this.loadNavItems(!!sandbox).pipe(
      map((nav_items) => _getFrontRoutes(nav_items))
    );
  }



  getMenuStructure(): MenuStructure {
    const menuStructure: MenuStructure = {};
    // Treat both null and undefined parent_id as top-level
    this._navItems.forEach(item => {
      if (item.parent_id == null) { // null or undefined
        menuStructure[item.id] = { parent: item, childs: [] };
      }
    });
    // Attach children
    this._navItems.forEach(item => {
      if (item.parent_id != null) {
        const parentEntry = menuStructure[item.parent_id];
        if (parentEntry) parentEntry.childs.push(item);
      }
    });
    // Sort children by rank asc
    Object.values(menuStructure).forEach(entry => {
      entry.childs.sort((a, b) => a.rank - b.rank);
    });
    return menuStructure;
  }

  


  // CRUDL NAVITEMS

  // Create
  async createNavItem(navItem: NavItem): Promise<NavItem> {
    const navItem_input: NavItem_input = {
      sandbox: navItem.sandbox,
      slug: navItem.slug,
      path: navItem.path,
      label: navItem.label,
      position: navItem.position,
      type: navItem.type,
      rank: navItem.rank,
      public: navItem.public,
      group_level: navItem.group_level,
      // optional params
      parent_id: navItem.parent_id,
      page_id: navItem.page_id,
      external_url: navItem.external_url,
      plugin_name: navItem.plugin_name,
    };
    try {
      const createdNavItem = await this.dbHandler.createNavItem(navItem_input);
      this._navItems.push(createdNavItem as NavItem);
      this._navItems$.next(this._navItems);
      return createdNavItem;
    } catch (error) {
  this.toastService.showErrorToast('NavItems', 'Erreur lors de la création');
      return Promise.reject(error);
    }
  }

  // List
  loadNavItems(sandbox: boolean): Observable<NavItem[]> {
    const _listNavItems = this.dbHandler.listNavItems().pipe(
      map((navItems: NavItem[]) => {
        // Include items without sandbox flag (legacy) + those matching current sandbox mode
        const filtered = navItems.filter(item => (item as any).sandbox === sandbox || (item as any).sandbox == null);
        this._navItems = filtered;
        this._navItems$.next(this._navItems);
      }),
      switchMap(() => this._navItems$.asObservable())
    );
    return (this._navItems && this._navItems.length > 0) ? this._navItems$.asObservable() : _listNavItems;
  }

  // Get one
  getNavItem(navItemId: string): NavItem | undefined {
    return this._navItems.find(navItem => navItem.id === navItemId);
  }

  // Update
  async updateNavItem(navItem: NavItem): Promise<NavItem> {
    try {
      const updatedNavItem = await this.dbHandler.updateNavItem(navItem);
      this._navItems = this._navItems.map(m => m.id === updatedNavItem.id ? (updatedNavItem as NavItem) : m);
      this._navItems$.next(this._navItems);
      return updatedNavItem;
    } catch (error) {
  this.toastService.showErrorToast('NavItems', 'Erreur lors de la modification');
      return Promise.reject(error);
    }
  }

  // Delete
  async deleteNavItem(navItem: NavItem): Promise<boolean> {
    try {
      await this.dbHandler.deleteNavItem(navItem.id);
      this._navItems = this._navItems.filter(m => m.id !== navItem.id);
      this._navItems$.next(this._navItems);
      return true;
    } catch (error) {
  this.toastService.showErrorToast('NavItems', 'Erreur lors de la suppression');
      return false;
    }
  }

  // Note: page_title is a UI concern; components can enrich items with titles using PageService
}
