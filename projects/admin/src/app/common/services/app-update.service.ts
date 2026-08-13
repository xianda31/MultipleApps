import { Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AppUpdateService {
  private readonly activatedBuildKey = 'app-update-activated-build';
  private updateInProgress = false;

  constructor(private swUpdate: SwUpdate) {
    this.logPreviousActivation();

    this.swUpdate.versionUpdates.subscribe((event) => {
      switch (event.type) {
        case 'VERSION_DETECTED':
          console.log('[AppUpdate] New build detected', {
            currentBuild: environment.buildInfo,
            detectedVersionHash: event.version.hash,
          });
          break;
        case 'VERSION_READY':
          console.log('[AppUpdate] New build ready', {
            currentVersionHash: event.currentVersion.hash,
            latestVersionHash: event.latestVersion.hash,
          });
          break;
        case 'NO_NEW_VERSION_DETECTED':
          console.log('[AppUpdate] Current build is up to date', {
            currentBuild: environment.buildInfo,
            versionHash: event.version.hash,
          });
          break;
        case 'VERSION_INSTALLATION_FAILED':
          console.error('[AppUpdate] New build installation failed', {
            versionHash: event.version.hash,
            error: event.error,
          });
          break;
      }
    });
  }

  async checkAtStartup(): Promise<void> {
    if (!this.swUpdate.isEnabled || this.updateInProgress) {
      console.log('[AppUpdate] Update check skipped', {
        serviceWorkerEnabled: this.swUpdate.isEnabled,
        updateInProgress: this.updateInProgress,
      });
      return;
    }

    try {
      console.log('[AppUpdate] Checking for a new build at startup', environment.buildInfo);
      await navigator.serviceWorker.ready;
      const updateReady = await this.swUpdate.checkForUpdate();

      if (!updateReady) {
        return;
      }

      this.updateInProgress = true;
      console.log('[AppUpdate] Activating new build and reloading');
      sessionStorage.setItem(this.activatedBuildKey, JSON.stringify({
        previousBuild: environment.buildInfo,
        activatedAt: new Date().toISOString(),
      }));
      await this.swUpdate.activateUpdate();
      window.location.reload();
    } catch (error) {
      console.warn('[AppUpdate] Startup update check failed', error);
    }
  }

  private logPreviousActivation(): void {
    const activation = sessionStorage.getItem(this.activatedBuildKey);
    if (!activation) {
      return;
    }

    sessionStorage.removeItem(this.activatedBuildKey);
    console.log('[AppUpdate] New build loaded after automatic reload', {
      currentBuild: environment.buildInfo,
      activation: JSON.parse(activation),
    });
  }
}