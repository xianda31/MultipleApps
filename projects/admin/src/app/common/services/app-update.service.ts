import { Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

@Injectable({
  providedIn: 'root'
})
export class AppUpdateService {
  private updateInProgress = false;

  constructor(private swUpdate: SwUpdate) { }

  async checkAtStartup(): Promise<void> {
    if (!this.swUpdate.isEnabled || this.updateInProgress) {
      return;
    }

    try {
      await navigator.serviceWorker.ready;
      const updateReady = await this.swUpdate.checkForUpdate();

      if (!updateReady) {
        return;
      }

      this.updateInProgress = true;
      await this.swUpdate.activateUpdate();
      window.location.reload();
    } catch (error) {
      console.warn('[AppUpdate] Startup update check failed', error);
    }
  }
}