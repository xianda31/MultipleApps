import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection, InjectionToken } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { InMemoryScrollingOptions, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { minimal_routes } from './front/front.routes';
import { APP_INITIALIZER } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { distinctUntilChanged, skip } from 'rxjs/operators';
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
    const applyRoutes = async (useSandbox: boolean) => {
      try {
        const routes = await firstValueFrom(navitemService.getFrontRoutes(useSandbox));
        dynamicRoutesService.setRoutes(routes);
      } catch (err) {
        console.warn('preloadFrontRoutes failed for useSandbox=' + useSandbox, err);
        dynamicRoutesService.setRoutes(minimal_routes);
      }
    };

    // Run initial load (sync) and subscribe to subsequent sandbox toggles
    const initial = applyRoutes(sandboxService.value);
    sandboxService.sandbox$.pipe(skip(1), distinctUntilChanged()).subscribe((nextFlag) => {
      void applyRoutes(nextFlag);
    });
    return initial;
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
    provideHttpClient(),
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
