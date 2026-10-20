import { Injectable, NgZone, inject, signal } from '@angular/core';
import { NFC, type NfcStatus } from '@exxili/capacitor-nfc';
import { Observable, Subject } from 'rxjs';

export interface TagScan {
  uid: string;
  scannedAt: string;
}

export interface MemberTagReader {
  readonly scans$: Observable<TagScan>;
  start(): Promise<void>;
  stop(): void;
}

export type NfcReaderStatus = 'checking' | 'ready' | 'disabled' | 'unsupported' | 'error';

export interface NfcReaderState {
  status: NfcReaderStatus;
  message: string;
}

const DUPLICATE_WINDOW_MS = 2000;
const MAX_SCAN_HISTORY = 5;

export function normalizeNfcUid(value: string): string {
  const normalized = value.replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (normalized.length < 8 || normalized.length % 2 !== 0) {
    throw new Error(`UID NFC invalide : ${value || 'vide'}`);
  }
  return normalized;
}

@Injectable({ providedIn: 'root' })
export class NfcTagReaderService implements MemberTagReader {
  private readonly zone = inject(NgZone);
  private readonly scanSubject = new Subject<TagScan>();
  private unsubscribeRead: (() => void) | null = null;
  private startPromise: Promise<void> | null = null;
  private lastUid = '';
  private lastUidAt = 0;
  private resumeListenerAttached = false;

  readonly scans$ = this.scanSubject.asObservable();
  readonly state = signal<NfcReaderState>({
    status: 'checking',
    message: 'Vérification du lecteur NFC…',
  });
  readonly scans = signal<readonly TagScan[]>([]);
  readonly readError = signal('');

  async start(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.initialize();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  stop(): void {
    this.unsubscribeRead?.();
    this.unsubscribeRead = null;
    if (this.resumeListenerAttached) {
      document.removeEventListener('resume', this.onResume);
      this.resumeListenerAttached = false;
    }
  }

  private async initialize(): Promise<void> {
    this.state.set({ status: 'checking', message: 'Vérification du lecteur NFC…' });
    this.readError.set('');

    try {
      const { status } = await NFC.getStatus();
      this.applyStatus(status);
      if (status !== 'ENABLED') return;

      if (!this.unsubscribeRead) {
        this.unsubscribeRead = NFC.onRead((result) => {
          const uid = result.string().tagInfo?.uid;
          if (!uid) {
            this.zone.run(() => {
              this.readError.set('La carte a été détectée, mais son UID est absent.');
            });
            return;
          }
          this.handleUid(uid);
        });
      }
      if (!this.resumeListenerAttached) {
        document.addEventListener('resume', this.onResume);
        this.resumeListenerAttached = true;
      }
    } catch (error) {
      console.error('[ppTPE][NFC] Initialisation impossible', error);
      this.state.set({
        status: 'error',
        message: error instanceof Error ? error.message : 'Initialisation NFC impossible.',
      });
    }
  }

  private readonly onResume = (): void => {
    void this.start();
  };

  private applyStatus(status: NfcStatus): void {
    if (status === 'ENABLED') {
      this.state.set({ status: 'ready', message: 'Approchez une carte NTAG du téléphone.' });
    } else if (status === 'DISABLED') {
      this.state.set({ status: 'disabled', message: 'Activez le NFC dans les réglages Android.' });
    } else {
      this.state.set({ status: 'unsupported', message: 'Cet appareil ne dispose pas de NFC.' });
    }
  }

  private handleUid(rawUid: string): void {
    let uid: string;
    try {
      uid = normalizeNfcUid(rawUid);
    } catch (error) {
      console.error('[ppTPE][NFC] UID invalide', error);
      this.zone.run(() => {
        this.readError.set(error instanceof Error ? error.message : 'UID NFC invalide.');
      });
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
      navigator.vibrate?.(80);
    });
  }
}
