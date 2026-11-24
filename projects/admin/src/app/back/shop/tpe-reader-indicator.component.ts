import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-tpe-reader-indicator',
  standalone: true,
  template: `
    <img src="/wisepad-3.jpg" class="tpe-reader-img"
      [class.state-connected]="connected"
      [class.state-scanning]="!connected && scanning"
      [class.state-disconnected]="!connected && !scanning"
      [title]="description" [alt]="description"
      [style.cursor]="!remote && !connected && !scanning ? 'pointer' : 'default'"
      (click)="!remote && !connected && !scanning && retry.emit()">
    @if (!remote && connected) {
      <button type="button" class="btn-tpe-disconnect-xs" (click)="disconnect.emit()" title="Déconnecter"
        aria-label="Déconnecter le TPE">
        <i class="bi bi-x-circle" aria-hidden="true"></i>
      </button>
    }
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; gap: 0.25rem; }
    .tpe-reader-img {
      height: 36px;
      width: auto;
      border-radius: 6px;
      transition: filter 0.3s, box-shadow 0.3s, opacity 0.3s;
    }
    .state-connected {
      box-shadow: 0 0 0 2px #198754, 0 0 7px rgba(25, 135, 84, 0.4);
      animation: tpe-blink 3s ease-in-out infinite;
    }
    .state-scanning { animation: tpe-scan-pulse 1.2s ease-in-out infinite; }
    .state-disconnected { filter: grayscale(100%); opacity: 0.4; }
    .btn-tpe-disconnect-xs {
      border: none;
      background: transparent;
      color: #dc3545;
      padding: 0;
      font-size: 0.8rem;
      cursor: pointer;
      line-height: 1;
    }
    .btn-tpe-disconnect-xs:hover { opacity: 0.7; }
    @keyframes tpe-blink {
      0%, 85%, 100% { opacity: 1; }
      90% { opacity: 0.15; }
    }
    @keyframes tpe-scan-pulse {
      0%, 100% { opacity: 0.75; box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
      50% { opacity: 1; box-shadow: 0 0 0 4px rgba(255, 193, 7, 0.3); }
    }
  `],
})
export class TpeReaderIndicatorComponent {
  @Input() connected = false;
  @Input() scanning = false;
  @Input() label = '';
  @Input() remote = true;
  @Output() retry = new EventEmitter<void>();
  @Output() disconnect = new EventEmitter<void>();

  get description(): string {
    if (this.connected) return `TPE connecté : ${this.label || 'WisePad 3'}`;
    if (this.scanning) return 'Recherche du TPE…';
    return this.remote ? 'TPE hors ligne' : 'TPE hors ligne : cliquer pour réessayer';
  }
}
