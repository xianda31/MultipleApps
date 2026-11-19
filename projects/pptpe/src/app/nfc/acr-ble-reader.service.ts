import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { Subject } from 'rxjs';
import { normalizeNfcUid, type MemberTagReader, type TagScan } from './nfc-tag-reader.service';

export type AcrReaderStatus =
  | 'idle'
  | 'unsupported'
  | 'permission'
  | 'scanning'
  | 'not-found'
  | 'ready'
  | 'read-error'
  | 'error'
  | 'stopped';

export interface AcrReaderState {
  status: AcrReaderStatus;
  message: string;
  terminal?: string;
}

interface AcrReaderPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  beep(options: { durations: number[] }): Promise<void>;
  addListener(event: 'status', listener: (state: AcrReaderState) => void): Promise<PluginListenerHandle>;
  addListener(event: 'uid', listener: (scan: { uid: string; terminal: string }) => void): Promise<PluginListenerHandle>;
}

const AcrReader = registerPlugin<AcrReaderPlugin>('AcrReader');

const DUPLICATE_WINDOW_MS = 2000;
const MAX_SCAN_HISTORY = 5;

@Injectable({ providedIn: 'root' })
export class AcrBleReaderService implements MemberTagReader {
  private readonly zone = inject(NgZone);
  private readonly scanSubject = new Subject<TagScan>();
  private listeners: PluginListenerHandle[] = [];
  private resumeListenerAttached = false;
  private lastUid = '';
  private lastUidAt = 0;

  readonly scans$ = this.scanSubject.asObservable();
  readonly state = signal<AcrReaderState>({ status: 'idle', message: 'Lecteur ACR1555U inactif.' });
  readonly scans = signal<readonly TagScan[]>([]);
  readonly readError = signal('');

  async start(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.state.set({ status: 'unsupported', message: 'Lecteur ACR1555U disponible uniquement sur Android.' });
      return;
    }
    try {
      if (this.listeners.length === 0) {
        this.listeners = await Promise.all([
          AcrReader.addListener('status', (state) => this.zone.run(() => this.applyState(state))),
          AcrReader.addListener('uid', ({ uid }) => this.handleUid(uid)),
        ]);
      }
      if (!this.resumeListenerAttached) {
        document.addEventListener('resume', this.onResume);
        this.resumeListenerAttached = true;
      }
      await AcrReader.start();
    } catch (error) {
      console.error('[ppTPE][ACR] Démarrage impossible', error);
      this.zone.run(() => {
        if (this.state().status !== 'permission') {
          this.state.set({
            status: 'error',
            message: error instanceof Error ? error.message : 'Démarrage du lecteur ACR1555U impossible.',
          });
        }
      });
    }
  }

  stop(): void {
    void AcrReader.stop().catch(() => undefined);
    this.listeners.forEach((listener) => void listener.remove());
    this.listeners = [];
    if (this.resumeListenerAttached) {
      document.removeEventListener('resume', this.onResume);
      this.resumeListenerAttached = false;
    }
  }

  /** Fait biper l'ACR1555U (durées en ms) ; sans effet si le lecteur n'est pas connecté. */
  async beep(durations: number[]): Promise<void> {
    const { status } = this.state();
    if (!Capacitor.isNativePlatform() || (status !== 'ready' && status !== 'read-error')) return;
    try {
      await AcrReader.beep({ durations });
    } catch (error) {
      console.warn('[ppTPE][ACR] Bip impossible', error);
    }
  }

  // Relance après l'autorisation Bluetooth accordée au premier lancement.
  private readonly onResume = (): void => {
    const { status } = this.state();
    if (status === 'permission' || status === 'error') void this.start();
  };

  private applyState(state: AcrReaderState): void {
    this.state.set(state);
    if (state.status === 'read-error') {
      this.readError.set(state.message);
    }
  }

  private handleUid(rawUid: string): void {
    let uid: string;
    try {
      uid = normalizeNfcUid(rawUid);
    } catch (error) {
      console.error('[ppTPE][ACR] UID invalide', error);
      this.zone.run(() => this.readError.set(error instanceof Error ? error.message : 'UID NFC invalide.'));
      return;
    }

    const now = Date.now();
    if (uid === this.lastUid && now - this.lastUidAt < DUPLICATE_WINDOW_MS) return;
    this.lastUid = uid;
    this.lastUidAt = now;

    const scan: TagScan = { uid, scannedAt: new Date(now).toISOString() };
    this.zone.run(() => {
      this.readError.set('');
      this.scans.update((history) => [scan, ...history].slice(0, MAX_SCAN_HISTORY));
      this.scanSubject.next(scan);
    });
  }
}
