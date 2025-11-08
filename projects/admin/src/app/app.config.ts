import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { InMemoryScrollingOptions, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { APP_INITIALIZER } from '@angular/core';
import { NavItemsService } from './common/services/navitem.service';
import { DynamicRoutesService } from './common/services/dynamic-routes.service';


// Fonction d'initialisation pour précharger les routes dynamiques du front
export function preloadFrontRoutes(navitemService: NavItemsService, dynamicRoutesService: DynamicRoutesService) {
  return () =>
    new Promise<void>((resolve) => {
      navitemService.getFrontRoutes_stub().subscribe({
        next: (routes) => {
          dynamicRoutesService.setRoutes(routes);
          resolve();
        }
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
      deps: [NavItemsService, DynamicRoutesService],
      multi: true
    }
  ]
};
