
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom, map, of, switchMap, tap, first, combineLatest } from 'rxjs';
import { ToastService } from './toast.service';
import { DBhandler } from './graphQL.service';
import { MenuGroup, NavItem, NavItem_input, NAVITEM_TYPE, NAVITEM_POSITION, NAVITEM_LOGGING_CRITERIA } from '../interfaces/navitem.interface';
import { minimal_routes } from '../../front/front.routes';
import { Routes } from '@angular/router';
import { GenericPageComponent } from '../../front/front/pages/generic-page/generic-page.component';
import { PLUGINS, NAVITEM_PLUGIN, PLUGINS_META } from '../interfaces/plugin.interface';
import { AuthGuard } from '../../auth.guard';
import { PageService } from './page.service';
import { Page, PAGE_TEMPLATES } from '../interfaces/page_snippet.interface';
import { Carousel } from '../../front/carousel/carousel';
import { TournamentComponent } from '../tournaments/tournament/tournament.component';

@Injectable({
  providedIn: 'root'
})
export class NavItemsService {
  private _navItems: NavItem[] = [];
  private _navItems$ = new BehaviorSubject<NavItem[]>([]);


  constructor(
    private toastService: ToastService,
    private dbHandler: DBhandler,
    private pageService: PageService,
  ) {}

  private enrichWithPageTitleAndCarousel(items: NavItem[], pages: Page[]): NavItem[] {
    if (!pages || pages.length === 0) {
      return items;
    }
    const byId = new Map(pages.map(p => [p.id, { title: p.title, carousel: p.template === PAGE_TEMPLATES.ALBUMS }] as [string, { title: string, carousel: boolean }]));
    return items.map(n =>
      n.page_id
        ? { ...n, page_title: byId.get(n.page_id)?.title, carousel: byId.get(n.page_id)?.carousel }
        : n
    );
  }


  /**
   * Returns an observable of generated front routes for the sandbox or production navitems.
   * @param sandbox If true, use sandbox navitems; otherwise, use production.
   */
  getFrontRoutes(sandbox: boolean): Observable<Routes> {
    return this.loadNavItems(sandbox).pipe(
      switchMap(navItems =>
        this.pageService.listPages().pipe(
          map(pages => this.generateFrontRoutes(this.enrichWithPageTitleAndCarousel(navItems, pages)))
        )
      )
    );
  }
  generateFrontRoutes(navItems: NavItem[]): Routes {
    // Generate dynamic front child routes from navitems
    // Deep-clone base routes to avoid mutating the shared minimal_routes tree
    const cloneRoutes = (rs: Routes): Routes => rs.map(r => ({
      ...r,
      children: r.children ? cloneRoutes(r.children) : undefined
    }));

    const new_routes: Routes = cloneRoutes(minimal_routes);

    // Assume paths are unique (enforced by editor later). Build dynamic children once
    const dynamicItems = navItems
      .filter(it => !!it?.path && (it.type === NAVITEM_TYPE.CUSTOM_PAGE || it.type === NAVITEM_TYPE.PLUGIN));

    const dynamicChildren = dynamicItems.map(ni => {
      if (ni.type === NAVITEM_TYPE.CUSTOM_PAGE) {
        const needsAuth = ni.logging_criteria === NAVITEM_LOGGING_CRITERIA.LOGGED_ONLY ;
        return {
          path: ni.path,
          component: GenericPageComponent,
          data: { page_title: ni.page_title },
          canActivate: needsAuth ? [AuthGuard] : undefined
        };
      }
      if (ni.type === NAVITEM_TYPE.PLUGIN) {
        const meta = ni.plugin_name ? PLUGINS_META[ni.plugin_name as string] : undefined;
        const comp = PLUGINS[ni.plugin_name!];
        const route: any = {
          path: ni.path,
          component: comp,
          canActivate: meta?.requiresAuth ? [AuthGuard] : undefined
        };
        if (meta?.requiresExternalUrl) {
          route.data = { external_url: ni.external_url };
        }
        return route;
      }
      return undefined as any;
    }).filter((r): r is any => !!r);

    
    // Data-driven extra routes from plugin metadata
    const extraRoutes: any[] = [];
    for (const ni of navItems) {
      if (!ni.plugin_name) continue;
      const meta = PLUGINS_META[ni.plugin_name as string];
      if (meta && meta.extraRoutes) {
        for (const t of meta.extraRoutes) {
          if (t.when === 'always' || (t.when === 'album' && !!ni.carousel)) {
            const routeComponent = t.component ?? meta.component ?? PLUGINS[ni.plugin_name!];
            extraRoutes.push({ path: ni.path + (t.suffix ?? ''), component: routeComponent, canActivate: meta?.requiresAuth ? [AuthGuard] : undefined });
          }
        }
      }
    }

    // Drive album extra-routes via PLUGINS_META['PAGE_ALBUM'] when present
    const pageAlbumMeta = PLUGINS_META['PAGE_ALBUM'];
    if (pageAlbumMeta && pageAlbumMeta.extraRoutes) {
      const albumNavs = navItems.filter(n => n.page_title && n.carousel);
      for (const n of albumNavs) {
        for (const t of pageAlbumMeta.extraRoutes) {
          if (t.when === 'always') {
            const routeComponent = t.component ?? pageAlbumMeta.component ?? PLUGINS['carousel'];
            extraRoutes.push({ path: n.path + (t.suffix ?? ''), component: routeComponent });
          }
        }
      }
    }

    // Add default redirect only if BRAND exists
    const brandNavitem = navItems.find(ni => ni.position === NAVITEM_POSITION.BRAND);
    const brandRoute = brandNavitem ? [{ path: '', redirectTo: brandNavitem.path, pathMatch: 'full' as const }] : [];

    const redirectRoute = [...extraRoutes, ...brandRoute];

    // Append minimal base routes after dynamic ones 
    const root = new_routes[0];
    const baseChildren = root.children ?? [];


    root.children = [...dynamicChildren, ...redirectRoute, ...baseChildren];
    return new_routes;
  }

  /**
   * Nouvelle structure récursive : retourne un tableau de MenuGroup
   */
  getMenuStructure(): MenuGroup[] {
    return this.buildMenuStructureNew(this._navItems);
  }

  /**
   * Get the path for a given page_title (reverse lookup).
   * Returns the path of the first navitem that has this page_title.
   * Returns null if not found.
   */
  getPathByPageTitle(pageTitle: string): string | null {
    const navitem = this._navItems.find(ni => ni.page_title === pageTitle);
    return navitem?.path || null;
  }

  /**
   * Fonction utilitaire pour construire la structure récursive
   */
  buildMenuStructureNew(items: NavItem[], parentId: string | null = null): MenuGroup[] {
    const levelItems = items.filter(it => it.parent_id === parentId);
    levelItems.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    return levelItems.map(it => ({
      navitem: it,
      childs: this.buildMenuStructureNew(items, it.id)
    }));
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
      pre_label: navItem.pre_label,
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
    return this.dbHandler.listNavItems().pipe(
      map((navItems: NavItem[]) => {
        const filtered = navItems.filter(item => (item as any).sandbox === true);
        this._navItems = filtered;
        this._navItems$.next(this._navItems);
        return filtered;
      })
    );
  }

  loadNavItemsProduction(includeLegacy: boolean = true): Observable<NavItem[]> {
    return this.dbHandler.listNavItems().pipe(
      map((navItems: NavItem[]) => {
        const filtered = navItems.filter(item => {
          const sb = (item as any).sandbox;
          return sb === false || (includeLegacy && (sb === undefined || sb === null));
        });
        this._navItems = filtered;
        this._navItems$.next(this._navItems);
        return filtered;
      })
    );
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
      // Only send fields allowed by backend schema
      const navItem_input = {
        sandbox: navItem.sandbox,
        type: navItem.type,
        label: navItem.label,
        slug: navItem.slug,
        path: navItem.path,
        rank: navItem.rank,
        logging_criteria: navItem.logging_criteria,
        group_level: navItem.group_level,
        position: navItem.position,
        pre_label: navItem.pre_label,
        parent_id: navItem.parent_id,
        page_id: navItem.page_id,
        external_url: navItem.external_url,
        plugin_name: navItem.plugin_name,
      };
      const updatedNavItem = await this.dbHandler.updateNavItem({ ...navItem_input, id: navItem.id });
      this._navItems = this._navItems.map(m => m.id === updatedNavItem.id ? (updatedNavItem as NavItem) : m);
      this._navItems$.next(this._navItems);
      return updatedNavItem;
    } catch (error) {
      this.toastService.showErrorToast('NavItems', 'Erreur lors de la modification');
      console.log('Erreur updateNavItem', error);
      console.log('NavItem envoyé', navItem);
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

  /**
   * Clone all production navitems (sandbox=false) to sandbox (sandbox=true) with new IDs.
   * This allows editing without affecting production.
   * Preserves parent-child relationships by mapping old IDs to new IDs.
   * Returns the number of items cloned.
   */
  async cloneProductionToSandbox(): Promise<number> {
    try {
      const all = await firstValueFrom(this.dbHandler.listNavItems());
      const prodItems = (all || []).filter((it: any) => it?.sandbox === false) as NavItem[];

      // First, delete all existing sandbox items
      const sandboxItems = (all || []).filter((it: any) => it?.sandbox === true) as NavItem[];
      for (const item of sandboxItems) {
        await this.deleteNavItem(item);
      }

      // Map old production IDs to new sandbox IDs
      const idMap = new Map<string, string>();

      // Sort items to process parents before children (null parent_id first, then by rank)
      const sortedItems = [...prodItems].sort((a, b) => {
        if (!a.parent_id && b.parent_id) return -1;
        if (a.parent_id && !b.parent_id) return 1;
        return (a.rank ?? 0) - (b.rank ?? 0);
      });

      // Clone items in order, mapping parent_id references
      let clonedCount = 0;
      for (const prodItem of sortedItems) {
        const clonedItem: NavItem_input = {
          sandbox: true,
          slug: prodItem.slug,
          path: prodItem.path,
          label: prodItem.label,
          position: prodItem.position,
          type: prodItem.type,
          rank: prodItem.rank,
          logging_criteria: prodItem.logging_criteria,
          group_level: prodItem.group_level,
          parent_id: prodItem.parent_id ? (idMap.get(prodItem.parent_id) || null) : null,
          page_id: prodItem.page_id,
          external_url: prodItem.external_url,
          plugin_name: prodItem.plugin_name,
          pre_label: prodItem.pre_label,
        };
        const newItem = await this.createNavItem(clonedItem as NavItem);
        idMap.set(prodItem.id, newItem.id);
        clonedCount++;
      }

      this.toastService.showSuccess('NavItems', `${clonedCount} élément(s) copié(s) vers sandbox`);
      return clonedCount;
    } catch (error: any) {
      this.toastService.showErrorToast('NavItems', 'Erreur lors de la copie vers sandbox');
      return Promise.reject(error);
    }
  }

  /**
   * Promote all sandbox nav items to production by:
   * 1. Deleting all existing production items (sandbox=false)
   * 2. Deleting all sandbox items (sandbox=true) and recreating them as production items with new IDs
   * Preserves parent-child relationships by mapping old sandbox IDs to new production IDs.
   * Returns the number of items promoted.
   */
  async promoteSandboxToProduction(): Promise<number> {
    try {
      const all = await firstValueFrom(this.dbHandler.listNavItems());
      const prodItems = (all || []).filter((it: any) => it?.sandbox === false) as NavItem[];
      const sandboxItems = (all || []).filter((it: any) => it?.sandbox === true) as NavItem[];

      // Delete all production items
      for (const item of prodItems) {
        await this.deleteNavItem(item);
      }

      // Map old sandbox IDs to new production IDs
      const idMap = new Map<string, string>();

      // Sort items to process parents before children (null parent_id first, then by rank)
      const sortedItems = [...sandboxItems].sort((a, b) => {
        if (!a.parent_id && b.parent_id) return -1;
        if (a.parent_id && !b.parent_id) return 1;
        return (a.rank ?? 0) - (b.rank ?? 0);
      });

      // Delete sandbox items and recreate as production with mapped parent_id
      let promotedCount = 0;
      for (const sandboxItem of sortedItems) {
        // Delete the sandbox item first
        await this.deleteNavItem(sandboxItem);

        // Recreate as production item with new ID
        const prodItem: NavItem_input = {
          sandbox: false,
          slug: sandboxItem.slug,
          path: sandboxItem.path,
          label: sandboxItem.label,
          position: sandboxItem.position,
          type: sandboxItem.type,
          rank: sandboxItem.rank,
          logging_criteria: sandboxItem.logging_criteria,
          group_level: sandboxItem.group_level,
          parent_id: sandboxItem.parent_id ? (idMap.get(sandboxItem.parent_id) || null) : null,
          page_id: sandboxItem.page_id,
          external_url: sandboxItem.external_url,
          plugin_name: sandboxItem.plugin_name,
          pre_label: sandboxItem.pre_label,
        };
        const newItem = await this.createNavItem(prodItem as NavItem);
        idMap.set(sandboxItem.id, newItem.id);
        promotedCount++;
      }

      this.toastService.showSuccess('NavItems', `${promotedCount} élément(s) promu(s) en production`);
      return promotedCount;
    } catch (error: any) {
      this.toastService.showErrorToast('NavItems', 'Erreur lors de la promotion vers production');
      return Promise.reject(error);
    }
  }

  // Promote all sandbox nav items to production by flipping the sandbox flag to false.
  // Returns the number of items promoted.
  // @deprecated Use promoteSandboxToProduction() instead
  async promoteSandboxMenus(): Promise<number> {
    try {
      const all = await firstValueFrom(this.dbHandler.listNavItems());
      const sandboxItems = (all || []).filter((it: any) => it?.sandbox === true) as NavItem[];
      for (const item of sandboxItems) {
        const updated: NavItem = { ...item, sandbox: false } as NavItem;
        await this.updateNavItem(updated);
      }
      this.toastService.showSuccess('NavItems', `${sandboxItems.length} élément(s) promu(s) en production`);
      return sandboxItems.length;
    } catch (error: any) {
      this.toastService.showErrorToast('NavItems', 'Erreur lors de la promotion des menus sandbox');
      return Promise.reject(error);
    }
  }


}
