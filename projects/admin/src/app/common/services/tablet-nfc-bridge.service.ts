import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Subscription } from 'rxjs';
import type { Schema } from '../../../../../../amplify/data/resource';
import { NfcCaptureTimeoutError, normalizeNtag213Uid, type NfcReaderStatus } from './member-nfc-card.service';

type ReaderSession = Schema['NfcReaderSession']['type'];

const STALE_SECONDS = 45;
const CAPTURE_TIMEOUT_MS = 30_000;
// La tablette abandonne l'attente du verdict après 10 s : inutile de traiter une lecture plus ancienne.
const MAX_SCAN_AGE_MS = 10_000;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export type NfcSource = 'pc' | 'tablet';
const NFC_SOURCE_KEY = 'fees-nfc-source';
const COLLECTOR_HEARTBEAT_MS = 15_000;

/** Source de lecture NFC choisie sur ce navigateur, partagée par le pointage et l'espace NFC. */
export function readStoredNfcSource(): NfcSource {
  try {
    return localStorage.getItem(NFC_SOURCE_KEY) === 'tablet' ? 'tablet' : 'pc';
  } catch {
    return 'pc';
  }
}

export function storeNfcSource(source: NfcSource): void {
  try { localStorage.setItem(NFC_SOURCE_KEY, source); } catch { /* stockage indisponible */ }
}

export function isFreshReaderSession(session: ReaderSession, now = nowSeconds()): boolean {
  return !!session.readerUpdatedAt && now - session.readerUpdatedAt <= STALE_SECONDS;
}

export function toNfcReaderStatus(session: ReaderSession): NfcReaderStatus {
  const ready = session.status === 'ready';
  const checkedAt = new Date((session.readerUpdatedAt ?? nowSeconds()) * 1000).toISOString();
  return {
    version: 'ppTPE',
    readerStatus: ready ? 'Ready' : session.status === 'scanning' ? 'Starting' : 'Disconnected',
    readerName: session.readerName ?? null,
    message: session.message ?? '',
    capturing: false,
    hardwareProbe: {
      state: ready ? 'Responsive' : 'Unresponsive',
      pcdPiccStatus: ready ? 1 : null,
      message: ready ? 'Lecteur connecté à la tablette ppTPE.' : (session.message || 'Lecteur non connecté à la tablette.'),
      checkedAt,
    },
  };
}

/**
 * Badgeuse NFC portée par la tablette ppTPE (ACR1555U en Bluetooth), relayée par AppSync.
 * Les lectures arrivent par abonnement ; fees-collector renvoie l'état de sa session et chaque verdict.
 */
@Injectable({ providedIn: 'root' })
export class TabletNfcBridgeService {
  private sessionId: string | null = null;
  private subscription?: Subscription;
  private queue: { uid: string; scanId: string; receivedAt: number }[] = [];
  private waiter?: () => void;
  private currentScanId: string | null = null;

  private get client() {
    return generateClient<Schema>({ authMode: 'userPool' });
  }

  async status(signal: AbortSignal, sessionId?: string): Promise<NfcReaderStatus & { sessionId: string }> {
    const result = sessionId
      ? await this.client.models.NfcReaderSession.get({ id: sessionId })
      : await this.client.models.NfcReaderSession.list();
    if (signal.aborted) throw signal.reason;
    if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join('; '));
    const sessions = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    const session = sessions
      .filter(item => isFreshReaderSession(item))
      .sort((left, right) => (right.readerUpdatedAt ?? 0) - (left.readerUpdatedAt ?? 0))[0];
    if (!session) {
      throw new Error('Aucune tablette ppTPE connectée : ouvrez ppTPE, connectez-vous et vérifiez le lecteur ACR1555U.');
    }
    return { ...toNfcReaderStatus(session), sessionId: session.id };
  }

  watch(sessionId: string): void {
    if (this.sessionId === sessionId && this.subscription) return;
    this.unwatch();
    this.sessionId = sessionId;
    this.subscription = this.client.models.NfcScan.onCreate({ filter: { sessionId: { eq: sessionId } } }).subscribe({
      next: scan => {
        this.queue.push({ uid: scan.uid, scanId: scan.id, receivedAt: Date.now() });
        this.waiter?.();
      },
      error: error => {
        console.error('[Pointage NFC] Abonnement aux lectures de la tablette interrompu', error);
        this.waiter?.();
      },
    });
  }

  unwatch(): void {
    this.subscription?.unsubscribe();
    this.subscription = undefined;
    this.sessionId = null;
    this.queue = [];
    this.currentScanId = null;
    this.waiter?.();
  }

  async acquire(signal: AbortSignal, timeoutMs = CAPTURE_TIMEOUT_MS): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      if (signal.aborted) throw signal.reason;
      if (!this.subscription || this.subscription.closed) throw new Error('Liaison avec la tablette ppTPE interrompue.');
      const scan = this.queue.shift();
      if (scan) {
        if (Date.now() - scan.receivedAt > MAX_SCAN_AGE_MS) continue;
        this.currentScanId = scan.scanId;
        return normalizeNtag213Uid(scan.uid);
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new NfcCaptureTimeoutError('Aucune carte présentée sur la tablette.');
      await new Promise<void>(resolve => {
        const timer = window.setTimeout(done, remaining);
        const abort = () => done();
        signal.addEventListener('abort', abort, { once: true });
        this.waiter = done;
        function done(): void {
          window.clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          resolve();
        }
      });
      this.waiter = undefined;
    }
  }

  async report(accepted: boolean, message: string): Promise<void> {
    await this.sendResult(accepted ? 'accepted' : 'refused', message);
  }

  /** Lecture sans pointage (test, gestion des cartes) : la tablette affiche « Carte lue ». */
  async reportRead(message: string): Promise<void> {
    await this.sendResult('read', message);
  }

  /**
   * Lit une seule carte sur la tablette hors session de pointage : annonce la lecture à ppTPE
   * (sans quoi la tablette ne transmet pas la carte), attend un UID puis libère la tablette.
   */
  async readOnce(signal: AbortSignal, purpose: string, readMessage: string): Promise<string> {
    const { sessionId, readerStatus, hardwareProbe } = await this.status(signal);
    if (readerStatus !== 'Ready') throw new Error(hardwareProbe?.message || 'Lecteur de la tablette indisponible.');
    this.watch(sessionId);
    const publish = () => void this.publishCollector(sessionId, 'active', purpose);
    publish();
    const heartbeat = window.setInterval(publish, COLLECTOR_HEARTBEAT_MS);
    try {
      const uid = await this.acquire(signal);
      await this.reportRead(readMessage);
      return uid;
    } finally {
      window.clearInterval(heartbeat);
      this.unwatch();
      void this.publishCollector(sessionId, 'stopped', '', '');
    }
  }

  private async sendResult(result: 'accepted' | 'refused' | 'read', message: string): Promise<void> {
    const id = this.currentScanId;
    this.currentScanId = null;
    if (!id) return;
    try {
      await this.client.models.NfcScan.update({ id, result, message });
    } catch (error) {
      console.warn('[Pointage NFC] Verdict non transmis à la tablette', error);
    }
  }

  async publishCollector(
    sessionId: string, status: 'active' | 'paused' | 'stopped', tournament: string, message = '',
  ): Promise<void> {
    try {
      await this.client.models.NfcReaderSession.update({
        id: sessionId,
        collectorStatus: status,
        collectorTournament: tournament,
        collectorMessage: message,
        collectorUpdatedAt: nowSeconds(),
      });
    } catch (error) {
      console.warn('[Pointage NFC] État du pointage non transmis à la tablette', error);
    }
  }
}
