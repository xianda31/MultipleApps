import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { registerLocaleData } from '@angular/common';
import * as fr from '@angular/common/locales/fr';
import { Amplify } from 'aws-amplify';
import outputs from '../../../amplify_outputs.json';
import { fetchAuthSession } from 'aws-amplify/auth'



registerLocaleData(fr.default);

Amplify.configure(outputs);
const amplifyConfig = Amplify.getConfig();
Amplify.configure(
  {
    ...amplifyConfig,
    API: {
      ...amplifyConfig.API,
      REST: outputs.custom.API,
    },
  },
  {
    API: {
      REST: {
        headers: async () => {
          const session = await fetchAuthSession();
          return { Authorization: session.tokens?.idToken ? session.tokens.idToken.toString() : '' };
        }
      },
    }
  }
);


bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
