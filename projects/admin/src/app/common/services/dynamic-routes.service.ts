import { Injectable } from '@angular/core';
import { Routes, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class DynamicRoutesService {
  private _routes: Routes = [] ;

  constructor(private router: Router) {}

  async fetchRoutes(): Promise<void> {
    // Replace with your async DB/API call
    // this._routes = await this.getRoutesFromService();
  }

  /**
   * Store routes locally and reset the Angular Router configuration so new routes are active immediately.
   * This ensures route `data` and other static bindings are available to routed components.
   */
      setRoutes(routes: Routes): void {
        // ...
      this._routes = routes;
      try {
        // Merge the dynamic front routes into the existing router config instead of overwriting it.
        // This preserves top-level routes like '/back'. The incoming `routes` is expected to
        // contain the front subtree (root path '' with children).
        const current = this.router.config || [];
        const frontSubtree = this._routes && this._routes.length > 0 ? this._routes[0] : undefined;
        if (frontSubtree) {
          // Find existing 'front' route (app-level lazy route) and replace its children/component
          const idx = current.findIndex(r => r.path === 'front');
          if (idx !== -1) {
            const existing = { ...current[idx] } as any;
            // Replace lazy loader with static children/component coming from generated front subtree
            const replacement: any = {
              ...existing,
            };
            // If frontSubtree defines children, use them; otherwise keep existing children
            if (frontSubtree.children) {
              replacement.children = frontSubtree.children;
              // If generated subtree has a component at root, set it
              if (frontSubtree.component) {
                replacement.component = frontSubtree.component;
              }
              // Remove loadChildren to avoid conflicts
              delete replacement.loadChildren;
            }
            const newConfig = [...current];
            newConfig[idx] = replacement;
            this.router.resetConfig(newConfig);
          } else {
            // No explicit 'front' route: as a fallback, reset config to keep as before but append front subtree
            const newConfig = [...current, ...this._routes];
            this.router.resetConfig(newConfig);
            console.log('DynamicRoutesService - Appended front routes to router config');
          }
        } else {
          // Nothing to merge; no-op but keep original stored routes
          console.warn('DynamicRoutesService - No front subtree found to merge');
        }
      } catch (err) {
        console.warn('DynamicRoutesService - Failed to reset router config', err);
      }
    }

    getRoutes(): Routes {
      return this._routes;
    }
}
