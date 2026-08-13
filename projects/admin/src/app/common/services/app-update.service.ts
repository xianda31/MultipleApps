import { Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AppUpdateService {
  private updateInProgress = false;

  constructor(private swUpdate: SwUpdate) {
    this.swUpdate.versionUpdates.subscribe((event) => {
      switch (event.type) {
        case 'VERSION_DETECTED':
          console.info('[AppUpdate] New build detected', {
            currentBuild: environment.buildInfo,
            detectedVersionHash: event.version.hash,
          });
          break;
        case 'VERSION_READY':
          console.info('[AppUpdate] New build ready', {
            currentVersionHash: event.currentVersion.hash,
            latestVersionHash: event.latestVersion.hash,
          });
          break;
        case 'NO_NEW_VERSION_DETECTED':
          console.info('[AppUpdate] Current build is up to date', {
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
      console.info('[AppUpdate] Update check skipped', {
        serviceWorkerEnabled: this.swUpdate.isEnabled,
        updateInProgress: this.updateInProgress,
      });
      return;
    }

    try {
      console.info('[AppUpdate] Checking for a new build at startup', environment.buildInfo);
      await navigator.serviceWorker.ready;
      const updateReady = await this.swUpdate.checkForUpdate();

      if (!updateReady) {
        return;
      }

      this.updateInProgress = true;
  console.info('[AppUpdate] Activating new build and reloading');
      await this.swUpdate.activateUpdate();
      window.location.reload();
    } catch (error) {
      console.warn('[AppUpdate] Startup update check failed', error);
    }
  }
}