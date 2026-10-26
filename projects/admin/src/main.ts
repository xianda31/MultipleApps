import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { registerLocaleData } from '@angular/common';
import * as fr from '@angular/common/locales/fr';
import { Amplify } from 'aws-amplify';
import outputs from '../../../amplify_outputs.json';
import { fetchAuthSession, signOut } from 'aws-amplify/auth'
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { defaultStorage } from 'aws-amplify/utils';
import {
  clearAuthSessionPolicy,
  hasValidPersistedAuthSession,
} from './app/common/authentification/auth-session-persistence';
import { environment } from './environments/environment';



registerLocaleData(fr.default);

Amplify.configure(outputs);
const amplifyConfig = Amplify.getConfig();

// Normalize REST API endpoints: remove trailing slash to avoid double-slash in paths
const outputsAny = outputs as any;
const restApiFromConfig = (
  amplifyConfig.API?.REST && Object.keys(amplifyConfig.API.REST as Record<string, any>).length > 0
    ? amplifyConfig.API.REST
    : outputsAny?.custom?.API
) as Record<string, any>;
const restApi = Object.fromEntries(
  Object.entries(restApiFromConfig || {}).map(([name, cfg]) => [
    name,
    { ...cfg, endpoint: typeof cfg?.endpoint === 'string' ? cfg.endpoint.replace(/\/$/, '') : cfg?.endpoint }
  ])
);

Amplify.configure(
  {
    ...amplifyConfig,
    API: {
      ...amplifyConfig.API,
      REST: restApi,
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

cognitoUserPoolsTokenProvider.setKeyValueStorage(defaultStorage);

async function startApplication(): Promise<void> {
  await clearStaleDevelopmentServiceWorker();
  if (!hasValidPersistedAuthSession()) {
    await signOut();
    clearAuthSessionPolicy();
  }

  await bootstrapApplication(AppComponent, appConfig);
}

startApplication().catch((err) => console.error(err));

async function clearStaleDevelopmentServiceWorker(): Promise<void> {
  if (environment.production || !('serviceWorker' in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter(registration => {
        const scriptUrls = [
          registration.active?.scriptURL,
          registration.installing?.scriptURL,
          registration.waiting?.scriptURL,
        ];
        return scriptUrls.some(url => url?.endsWith('/ngsw-worker.js'));
      })
      .map(registration => registration.unregister()),
  );

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(cacheName => cacheName.startsWith('ngsw:'))
        .map(cacheName => caches.delete(cacheName)),
    );
  }
}
