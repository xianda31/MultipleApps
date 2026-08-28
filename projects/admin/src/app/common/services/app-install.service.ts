import { Injectable, signal } from '@angular/core';

type InstallPlatform = 'android' | 'windows' | 'macos' | 'other';
type InstallMode = 'hidden' | 'prompt' | 'manual';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface AppInstallState {
  mode: InstallMode;
  platform: InstallPlatform;
}

type CapacitorWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
};

const DISMISSED_UNTIL_KEY = 'bcsto.install.dismissedUntil';
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class AppInstallService {
  private readonly stateSignal = signal<AppInstallState>({ mode: 'hidden', platform: 'other' });
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly state = this.stateSignal.asReadonly();

  constructor() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }

    const platform = this.detectPlatform();
    this.stateSignal.set({ mode: 'hidden', platform });

    if (this.isInstalled() || this.isNativeApp() || this.isDismissed()) {
      return;
    }

    if (platform !== 'other') {
      this.stateSignal.set({ mode: 'manual', platform });
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.stateSignal.set({ mode: 'prompt', platform });
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.stateSignal.set({ mode: 'hidden', platform });
      this.clearDismissal();
    });
  }

  async install(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    const prompt = this.deferredPrompt;
    this.deferredPrompt = null;
    await prompt.prompt();
    const choice = await prompt.userChoice;

    if (choice.outcome === 'accepted') {
      this.stateSignal.update((state) => ({ ...state, mode: 'hidden' }));
      return true;
    }

    this.dismiss();
    return false;
  }

  dismiss(): void {
    try {
      localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + DISMISS_DURATION_MS));
    } catch {
      // Storage may be unavailable in private browsing.
    }
    this.stateSignal.update((state) => ({ ...state, mode: 'hidden' }));
  }

  private detectPlatform(): InstallPlatform {
    const userAgent = navigator.userAgent;
    if (/Android/i.test(userAgent)) return 'android';
    if (/Windows/i.test(userAgent)) return 'windows';
    if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macos';
    return 'other';
  }

  private isInstalled(): boolean {
    const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
    return window.matchMedia('(display-mode: standalone)').matches || standaloneNavigator.standalone === true;
  }

  private isNativeApp(): boolean {
    const capacitor = (window as CapacitorWindow).Capacitor;
    return /Electron/i.test(navigator.userAgent) || capacitor?.isNativePlatform?.() === true;
  }

  private isDismissed(): boolean {
    try {
      const dismissedUntil = Number(localStorage.getItem(DISMISSED_UNTIL_KEY));
      return Number.isFinite(dismissedUntil) && dismissedUntil > Date.now();
    } catch {
      return false;
    }
  }

  private clearDismissal(): void {
    try {
      localStorage.removeItem(DISMISSED_UNTIL_KEY);
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }
}