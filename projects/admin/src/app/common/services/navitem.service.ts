import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, of, switchMap, tap } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ToastService } from './toast.service';
import { DBhandler } from './graphQL.service';
import { MenuStructure, NavItem, NavItem_input } from '../interfaces/navitem.interface';
import { routes } from '../../front/front.routes';
import { Routes } from '@angular/router';

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


  getFrontRoutes_stub(): Observable<Routes> {
    return of(routes);              // stub for development
  }
  getFrontRoutes(): Observable<Routes> {
    return of(routes);              
  }



  getMenuStructure(): MenuStructure {
    const menuStructure: MenuStructure = {};
    this._navItems.forEach(item => {
      if (!menuStructure[item.id]) {
        menuStructure[item.id] = { parent: item, childs: [] };
      }
      if (item.parent_id) {
        const parent = menuStructure[item.parent_id];
        if (parent) {
          parent.childs.push(item);
        }
      }
    });
    return menuStructure;
  }

  


  // CRUDL NAVITEMS

  // Create
  async createNavItem(navItem: NavItem): Promise<NavItem> {
    const navItem_input: NavItem_input = {
      slug: navItem.slug,
      path: navItem.path,
      label: navItem.label,
      position: navItem.position,
      type: navItem.type,
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
  loadNavItems(): Observable<NavItem[]> {
    const _listNavItems = this.dbHandler.listNavItems().pipe(
      map((navItems: NavItem[]) => {
        this._navItems = navItems;
        this._navItems$.next(navItems);
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
      this._navItems = this._navItems.map(m => m.id === updatedNavItem.id ? updatedNavItem : m);
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
}
