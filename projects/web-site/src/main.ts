import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { Amplify } from 'aws-amplify';
import outputs from '../../../amplify_outputs.json';
import * as fr from '@angular/common/locales/fr';
import { registerLocaleData } from '@angular/common';

import { routes } from './app/app.routes';
import { GenericSimplePageComponent } from './app/generic-simple-page/generic-simple-page.component';



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


routes.push({ path: 'news', component: GenericSimplePageComponent, data: { pageId: 'news' } });

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
