import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { registerLocaleData } from '@angular/common';
import * as fr from '@angular/common/locales/fr';
import { Amplify } from 'aws-amplify';
import outputs from '../../../amplify_outputs.json';



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


bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
