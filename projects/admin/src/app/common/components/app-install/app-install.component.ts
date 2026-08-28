import { Component, inject, signal } from '@angular/core';
import { AppInstallService } from '../../services/app-install.service';

@Component({
  selector: 'app-install-app',
  standalone: true,
  templateUrl: './app-install.component.html',
  styleUrl: './app-install.component.scss'
})
export class AppInstallComponent {
  private readonly appInstallService = inject(AppInstallService);

  readonly state = this.appInstallService.state;
  readonly installing = signal(false);
  readonly showManualInstructions = signal(false);

  get platformLabel(): string {
    switch (this.state().platform) {
      case 'android': return 'Android';
      case 'windows': return 'Windows';
      case 'macos': return 'macOS';
      default: return 'cet appareil';
    }
  }

  get platformIcon(): string {
    switch (this.state().platform) {
      case 'android': return 'bi-android2';
      case 'windows': return 'bi-windows';
      case 'macos': return 'bi-apple';
      default: return 'bi-window-plus';
    }
  }

  get manualInstructions(): string {
    switch (this.state().platform) {
      case 'windows':
        return "Dans Chrome ou Edge, utilisez l'icône d'installation dans la barre d'adresse, ou ouvrez le menu du navigateur puis choisissez Installer bcsto.";
      case 'android':
        return "Dans Chrome, ouvrez le menu du navigateur puis choisissez Installer l'application ou Ajouter à l'écran d'accueil.";
      case 'macos':
        return this.isSafari()
          ? 'Dans Safari, ouvrez le menu Fichier puis choisissez Ajouter au Dock.'
          : "Dans Chrome ou Edge, utilisez l'icône d'installation dans la barre d'adresse, ou choisissez Installer bcsto dans le menu du navigateur.";
      default:
        return "Utilisez la commande d'installation proposée dans le menu de votre navigateur.";
    }
  }

  async runInstall(): Promise<void> {
    if (this.state().mode === 'manual') {
      this.showManualInstructions.set(true);
      return;
    }

    this.installing.set(true);
    try {
      await this.appInstallService.install();
    } finally {
      this.installing.set(false);
    }
  }

  closeInstructions(): void {
    this.showManualInstructions.set(false);
  }

  private isSafari(): boolean {
    const userAgent = navigator.userAgent;
    return /Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox/i.test(userAgent);
  }
}