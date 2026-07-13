import { CommonModule } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { APP_SANDBOX } from './app.config';
import { filter } from 'rxjs/operators';
import { PageViewService } from './common/services/page-view.service';
import { AuthentificationService } from './common/authentification/authentification.service';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})

export class AppComponent implements OnInit, OnDestroy {
  sandbox: boolean = false;
  canInstallAndroid = false;
  private deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  private readonly onBeforeInstallPrompt = (event: Event): void => {
    if (!this.isAndroidDevice() || this.isStandaloneMode()) {
      return;
    }

    const installEvent = event as BeforeInstallPromptEvent;
    installEvent.preventDefault();
    this.deferredInstallPrompt = installEvent;
    this.canInstallAndroid = true;
  };
  private readonly onAppInstalled = (): void => {
    this.deferredInstallPrompt = null;
    this.canInstallAndroid = false;
  };
  
  constructor(
    @Inject(APP_SANDBOX) sandboxFlag: boolean,
    private router: Router,
    private pageViewService: PageViewService,
    private authService: AuthentificationService,
  ) {
    this.sandbox = sandboxFlag;
  }

  ngOnInit(): void {
    window.addEventListener('beforeinstallprompt', this.onBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', this.onAppInstalled);

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.trackPageNavigation(event.url);
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeinstallprompt', this.onBeforeInstallPrompt as EventListener);
    window.removeEventListener('appinstalled', this.onAppInstalled);
  }

  async installAndroidApp(): Promise<void> {
    if (!this.deferredInstallPrompt) {
      return;
    }

    const installEvent = this.deferredInstallPrompt;
    this.deferredInstallPrompt = null;
    this.canInstallAndroid = false;

    await installEvent.prompt();
    await installEvent.userChoice;
  }

  private trackPageNavigation(url: string): void {
    const member = this.authService.currentMember;
    const userId = member?.license_number ?? undefined;
    this.pageViewService.trackVisit(url, userId);
  }

  private isAndroidDevice(): boolean {
    return /Android/i.test(navigator.userAgent || '');
  }

  private isStandaloneMode(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches;
  }
}
