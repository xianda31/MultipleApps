import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection, InjectionToken } from '@angular/core';
import { InMemoryScrollingOptions, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { routes as front_static_routes } from './front/front.routes';
import { APP_INITIALIZER } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NavItemsService } from './common/services/navitem.service';
import { DynamicRoutesService } from './common/services/dynamic-routes.service';
import { SandboxService } from './common/services/sandbox.service';

// Fonction d'initialisation pour précharger les routes dynamiques du front
export const APP_SANDBOX = new InjectionToken<boolean>('APP_SANDBOX');

// Fonction d'initialisation pour précharger les routes dynamiques du front
export function preloadFrontRoutes(
  navitemService: NavItemsService,
  dynamicRoutesService: DynamicRoutesService,
  sandboxService: SandboxService
) {
  return () => {
    const flag = sandboxService.value;
    // Initial runtime should use static routes unless sandbox is explicitly ON
  if (flag) {
      // Load sandbox routes once on startup if sandbox=true
      const initial = firstValueFrom(navitemService.getFrontRoutes(true))
        .then((routes) => { dynamicRoutesService.setRoutes(routes); })
  .catch(() => { dynamicRoutesService.setRoutes(front_static_routes); });
      // And keep in sync with subsequent changes
      sandboxService.sandbox$.subscribe((nextFlag) => {
        if (nextFlag) {
          navitemService.getFrontRoutes(true).subscribe({
            next: (routes) => dynamicRoutesService.setRoutes(routes),
            error: () => { /* ignore */ }
          });
        } else {
          dynamicRoutesService.setRoutes(front_static_routes);
        }
      });
      return initial;
    } else {
      // Start on static routes and listen for sandbox toggles to switch
      dynamicRoutesService.setRoutes(front_static_routes);
      sandboxService.sandbox$.subscribe((nextFlag) => {
        if (nextFlag) {
          navitemService.getFrontRoutes(true).subscribe({
            next: (routes) => dynamicRoutesService.setRoutes(routes),
            error: () => { /* ignore */ }
          });
        } else {
          dynamicRoutesService.setRoutes(front_static_routes);
        }
      });
      return Promise.resolve();
    }
  };
}

const scrollConfig: InMemoryScrollingOptions = {
  scrollPositionRestoration: 'enabled'
}
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // provideAnimations(),
    provideRouter(routes, withInMemoryScrolling(scrollConfig), withComponentInputBinding()),
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    {
      provide: APP_INITIALIZER,
      useFactory: preloadFrontRoutes,
      deps: [NavItemsService, DynamicRoutesService, SandboxService],
      multi: true
    },
    { provide: APP_SANDBOX, useFactory: (sandboxService: SandboxService) => sandboxService.value, deps: [SandboxService] }
  ]
};
