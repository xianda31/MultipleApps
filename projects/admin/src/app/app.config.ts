import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection, InjectionToken } from '@angular/core';
import { InMemoryScrollingOptions, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { APP_INITIALIZER } from '@angular/core';
import { NavItemsService } from './common/services/navitem.service';
import { DynamicRoutesService } from './common/services/dynamic-routes.service';
import { SandboxService } from './common/services/sandbox.service';

// Fonction d'initialisation pour précharger les routes dynamiques du front
export const APP_SANDBOX = new InjectionToken<boolean>('APP_SANDBOX');

// Fonction d'initialisation pour précharger les routes dynamiques du front
export function preloadFrontRoutes(navitemService: NavItemsService, dynamicRoutesService: DynamicRoutesService, sandboxService: SandboxService) {
  return () => new Promise<void>((resolve) => {
    const flag = sandboxService.value;
    navitemService.getFrontRoutes(flag).subscribe({
      next: (routes) => {
        dynamicRoutesService.setRoutes(routes);
        resolve();
      },
      error: () => { resolve(); }
    });
  });
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
