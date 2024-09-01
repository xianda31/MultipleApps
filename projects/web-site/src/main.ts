/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
// import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { Amplify } from 'aws-amplify';
import outputs from '../../../amplify_outputs.json';
import * as fr from '@angular/common/locales/fr';
import { registerLocaleData } from '@angular/common';
import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { DynamicRoutesService } from './app/dynamic.routes.service';
import { LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';

registerLocaleData(fr.default);
Amplify.configure(outputs);
const existingConfig = Amplify.getConfig();
Amplify.configure({
  ...existingConfig,
  API: {
    ...existingConfig.API,
    REST: outputs.custom.API,
  },
});

export function initializeAppRoutes(dynamicRoutesService: DynamicRoutesService) {
  return () => dynamicRoutesService.initRoutes();
}

const routeConfig: ApplicationConfig = {
  providers: [
    DynamicRoutesService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAppRoutes,
      multi: true,
      deps: [DynamicRoutesService],
    },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: LOCALE_ID, useValue: 'fr-FR' }
  ]
};


bootstrapApplication(AppComponent, routeConfig)
  .catch((err) => console.error(err));
