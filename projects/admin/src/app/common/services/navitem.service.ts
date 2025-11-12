import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of, switchMap, tap } from 'rxjs';
import { ToastService } from './toast.service';
import { DBhandler } from './graphQL.service';
import { MenuStructure, NavItem, NavItem_input, NAVITEM_TYPE } from '../interfaces/navitem.interface';
import { minimal_routes, routes } from '../../front/front.routes';
import { Routes } from '@angular/router';
import { GenericPageComponent } from '../../front/front/pages/generic-page/generic-page.component';
import { ConnexionPageComponent } from '../authentification/connexion-page/connexion-page.component';
import { PLUGINS } from '../interfaces/plugin.interface';

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


  getFrontRoutes(sandbox: boolean): Observable<Routes> {
    const src$ = sandbox ? this.loadNavItemsSandbox() : this.loadNavItemsProduction(true);
    return src$.pipe(
      tap((items) => console.log('[routes] navitems (sandbox=%s): %d', sandbox, items.length)),
      map((nav_items) => this.generateFrontRoutes(nav_items)),
      tap((routes) => {
        const children = routes?.[0]?.children ?? [];
        const sample = (children as any[]).slice(0, 5).map(r => (r as any).path);
        console.log('[routes] generated children=%d sample=%o', children.length, sample);
      })
    );
  }

  generateFrontRoutes(navItems: NavItem[]) : Routes {
    // Deep-clone base routes to avoid mutating the shared minimal_routes tree
    const cloneRoutes = (rs: Routes): Routes => rs.map(r => ({
      ...r,
      children: r.children ? cloneRoutes(r.children) : undefined
    }));
    const new_routes: Routes = cloneRoutes(minimal_routes);

    // Ensure we only insert unique paths and always before catch-all
    const root = new_routes[0];
    if (!root.children) root.children = [];
    const children = root.children;
    const existing = new Set<string>(children.map(r => (r as any).path).filter((p: any) => typeof p === 'string'));

    for (const item of navItems) {
      const p = item.path;
      if (!p || existing.has(p)) continue; // skip invalid or duplicate paths
      switch (item.type) {
        case NAVITEM_TYPE.CUSTOM_PAGE:
          children.unshift({ path: p, component: GenericPageComponent, data: { page_title: item.page_title } });
          existing.add(p);
          break;
        case NAVITEM_TYPE.PLUGIN:
          children.unshift({ path: p, component: PLUGINS[item.plugin_name!] });
          existing.add(p);
          break;
        default:
          // skip other types
          break;
      }
    }
    return new_routes;
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
      logging_criteria: navItem.logging_criteria,
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

  // List (separated loads)
  loadNavItemsSandbox(): Observable<NavItem[]> {
    const _list = this.dbHandler.listNavItems().pipe(
      map((navItems: NavItem[]) => {
        const filtered = navItems.filter(item => (item as any).sandbox === true);
        this._navItems = filtered;
        this._navItems$.next(this._navItems);
      }),
      switchMap(() => this._navItems$.asObservable())
    );
    return (this._navItems && this._navItems.length > 0) ? this._navItems$.asObservable() : _list;
  }

  loadNavItemsProduction(includeLegacy: boolean = true): Observable<NavItem[]> {
    const _list = this.dbHandler.listNavItems().pipe(
      map((navItems: NavItem[]) => {
        const filtered = navItems.filter(item => {
          const sb = (item as any).sandbox;
          return sb === false || (includeLegacy && (sb === undefined || sb === null));
        });
        this._navItems = filtered;
        this._navItems$.next(this._navItems);
      }),
      switchMap(() => this._navItems$.asObservable())
    );
    return (this._navItems && this._navItems.length > 0) ? this._navItems$.asObservable() : _list;
  }

  // Backward-compatible alias
  loadNavItems(sandbox: boolean): Observable<NavItem[]> {
    return sandbox ? this.loadNavItemsSandbox() : this.loadNavItemsProduction(true);
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
