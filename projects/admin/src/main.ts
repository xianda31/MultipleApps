import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { registerLocaleData } from '@angular/common';
import * as fr from '@angular/common/locales/fr';
import { Amplify } from 'aws-amplify';
import outputs from '../../../amplify_outputs.json';
import { fetchAuthSession } from 'aws-amplify/auth'
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { sessionStorage } from 'aws-amplify/utils';



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

// Set the session storage for Cognito User Pools token provider
cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
