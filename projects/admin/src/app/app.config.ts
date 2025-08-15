import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { InMemoryScrollingOptions, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';

const scrollConfig: InMemoryScrollingOptions = {
  scrollPositionRestoration: 'enabled'
}
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimations(),
    provideRouter(routes, withInMemoryScrolling(scrollConfig), withComponentInputBinding()),
    { provide: LOCALE_ID, useValue: 'fr-FR' }
  ]
};
