import { Injectable, NgZone, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { generateClient } from 'aws-amplify/data';
import { Subscription } from 'rxjs';
import type { Schema } from '../../../../../amplify/data/resource';
import { AcrBleReaderService, type AcrReaderState } from './acr-ble-reader.service';

type ReaderSessionStatus = 'scanning' | 'ready' | 'not_found' | 'error' | 'stopped';

export interface CollectorState {
  /** `absent` : aucun heartbeat récent de fees-collector (page fermée, autre source ou PC hors ligne). */
  status: 'active' | 'paused' | 'stopped' | 'absent';
  tournament: string;
  message: string;
}

export interface ScanFeedback {
  uid: string;
  result: 'pending' | 'accepted' | 'refused' | 'read' | 'unanswered';
  message: string;
  at: Date;
}

/** Motifs du buzzer ACR1555U (durées en ms) selon le verdict. */
export const BUZZER_PATTERNS: Record<Exclude<ScanFeedback['result'], 'pending'>, number[]> = {
  accepted: [120],
  refused: [100, 100, 100],
  read: [60],
  unanswered: [500],
};

const BUZZER_KEY = 'pptpe-acr-buzzer';

const HEARTBEAT_MS = 15_000;
const STALE_SECONDS = 45;
const TTL_SECONDS = 3600;
const ANSWER_TIMEOUT_MS = 10_000;
// Même durée que le voyant « Pointage » de fees-collector.
const FEEDBACK_DISPLAY_MS = 3_000;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export function toReaderSessionStatus(status: AcrReaderState['status']): ReaderSessionStatus {
  switch (status) {
    case 'scanning': return 'scanning';
    case 'ready':
    case 'read-error': return 'ready';
    case 'not-found': return 'not_found';
    case 'stopped':
    case 'idle': return 'stopped';
    default: return 'error';
  }
}

/**
 * Relaie le lecteur ACR1555U vers fees-collector via AppSync : publie l'état du lecteur
 * et chaque UID lu, puis affiche l'état de la session de pointage et son verdict.
 */
@Injectable({ providedIn: 'root' })
export class NfcRelayService {
  private readonly zone = inject(NgZone);
  private readonly reader = inject(AcrBleReaderService);
  private readonly readerState$ = toObservable(this.reader.state);
  private client?: ReturnType<typeof generateClient<Schema>>;
  private sessionId: string | null = null;
  private subscriptions: Subscription[] = [];
  private heartbeat?: ReturnType<typeof setInterval>;
  private answerTimer?: ReturnType<typeof setTimeout>;
  private feedbackTimer?: ReturnType<typeof setTimeout>;
  private pendingScanId: string | null = null;
  private collectorStatus: 'active' | 'paused' | 'stopped' | null = null;
  private collectorTournament = '';
  private collectorMessage = '';
  private collectorUpdatedAt = 0;
  private collectorRevision = 0;

  readonly collector = signal<CollectorState>({ status: 'absent', tournament: '', message: '' });
  readonly feedback = signal<ScanFeedback | null>(null);
  readonly lastReading = signal<ScanFeedback | null>(null);
  readonly connected = signal(false);
  readonly buzzerEnabled = signal(readBuzzerSetting());

  setBuzzer(enabled: boolean): void {
    this.buzzerEnabled.set(enabled);
    try { localStorage.setItem(BUZZER_KEY, enabled ? 'on' : 'off'); } catch { /* stockage indisponible */ }
  }

  attach(sessionId: string): void {
    if (this.sessionId === sessionId) return;
    this.detach();
    this.sessionId = sessionId;
    this.client = generateClient<Schema>();
    this.connected.set(true);

    this.subscriptions.push(
      this.readerState$.subscribe(() => void this.publishReader()),
      this.reader.scans$.subscribe((scan) => void this.publishScan(scan.uid)),
      this.client.models.NfcScan.onUpdate({ filter: { sessionId: { eq: sessionId } } }).subscribe({
        next: (scan) => this.zone.run(() => this.applyVerdict(scan)),
        error: (error) => console.warn('[ppTPE][NFC] Abonnement aux verdicts impossible', error),
      }),
      this.client.models.NfcReaderSession.onUpdate({ filter: { id: { eq: sessionId } } }).subscribe({
        next: (session) => this.zone.run(() => this.applyCollector(session)),
        error: (error) => console.warn('[ppTPE][NFC] Abonnement à fees-collector impossible', error),
      }),
    );
    void this.client.models.NfcReaderSession.get({ id: sessionId }).then(({ data }) => {
      if (data) this.zone.run(() => this.applyCollector(data));
    });
    this.heartbeat = setInterval(() => {
      void this.publishReader();
      this.zone.run(() => this.refreshCollector());
    }, HEARTBEAT_MS);
  }

  detach(): void {
    if (this.sessionId && this.client) {
      void this.upsertSession({ status: 'stopped', message: 'ppTPE déconnecté.' });
    }
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];
    clearInterval(this.heartbeat);
    clearTimeout(this.answerTimer);
    clearTimeout(this.feedbackTimer);
    this.sessionId = null;
    this.client = undefined;
    this.pendingScanId = null;
    this.collectorStatus = null;
    this.collectorUpdatedAt = 0;
    this.connected.set(false);
    this.collector.set({ status: 'absent', tournament: '', message: '' });
    this.feedback.set(null);
    this.lastReading.set(null);
  }

  private async publishReader(): Promise<void> {
    const state = this.reader.state();
    await this.upsertSession({
      status: toReaderSessionStatus(state.status),
      message: state.message,
      readerName: state.terminal ?? null,
    });
  }

  private async upsertSession(fields: {
    status: ReaderSessionStatus; message: string; readerName?: string | null;
  }): Promise<void> {
    const id = this.sessionId;
    const client = this.client;
    if (!id || !client) return;
    const payload = { id, ...fields, readerUpdatedAt: nowSeconds(), ttl: nowSeconds() + TTL_SECONDS };
    try {
      // update() ne lève pas d'exception si l'enregistrement n'existe pas : il renvoie des erreurs.
      const { errors } = await client.models.NfcReaderSession.update(payload);
      if (errors?.length) await client.models.NfcReaderSession.create(payload);
    } catch (error) {
      console.warn('[ppTPE][NFC] Publication de l’état du lecteur impossible', error);
    }
  }

  private async publishScan(uid: string): Promise<void> {
    const id = this.sessionId;
    const client = this.client;
    if (!id || !client) return;

    if (!this.isCollectorActive()) {
      // Une demande ponctuelle de l'Espace NFC peut précéder la notification AppSync.
      const revision = this.collectorRevision;
      try {
        const { data, errors } = await client.models.NfcReaderSession.get({ id });
        if (errors?.length) throw new Error(errors.map(error => error.message).join('; '));
        if (this.client !== client || this.sessionId !== id) return;
        if (data && this.collectorRevision === revision) this.applyCollector(data);
      } catch (error) {
        if (this.client !== client || this.sessionId !== id) return;
        if (!this.isCollectorActive()) {
          console.warn('[ppTPE][NFC] Vérification de la demande de lecture impossible', error);
          this.showFeedback({ uid, result: 'unanswered', message: 'Demande de lecture non vérifiée : vérifiez la connexion réseau.' });
          return;
        }
      }
    }

    if (!this.isCollectorActive()) {
      const { status, message } = this.collector();
      const reason = status === 'paused' ? 'pointage suspendu'
        : status === 'stopped' ? 'demande de lecture ou pointage terminé' : 'aucune demande de lecture ni pointage actif';
      this.zone.run(() => this.showFeedback({
        uid, result: 'unanswered', message: `Carte non traitée : ${reason}.${message ? ` ${message}` : ''}`,
      }));
      return;
    }
    this.showFeedback({ uid, result: 'pending', message: 'Vérification par fees-collector…' }, false);
    try {
      const { data, errors } = await client.models.NfcScan.create({
        uid,
        sessionId: id,
        readerName: this.reader.state().terminal ?? null,
        result: 'pending',
        ttl: nowSeconds() + TTL_SECONDS,
      });
      if (errors?.length || !data) throw new Error(errors?.map((error) => error.message).join('; ') || 'Lecture non publiée.');
      this.pendingScanId = data.id;
      clearTimeout(this.answerTimer);
      this.answerTimer = setTimeout(() => this.zone.run(() => {
        if (this.pendingScanId !== data.id) return;
        this.pendingScanId = null;
        this.showFeedback({ uid, result: 'unanswered', message: 'Pas de réponse de fees-collector : vérifiez le pointage sur le PC.' });
      }), ANSWER_TIMEOUT_MS);
    } catch (error) {
      console.warn('[ppTPE][NFC] Publication de la lecture impossible', error);
      this.zone.run(() => this.showFeedback({ uid, result: 'unanswered', message: 'Lecture non transmise : vérifiez la connexion réseau.' }));
    }
  }

  private applyVerdict(scan: Schema['NfcScan']['type']): void {
    if (scan.id !== this.pendingScanId || !scan.result || scan.result === 'pending') return;
    this.pendingScanId = null;
    clearTimeout(this.answerTimer);
    this.showFeedback({ uid: scan.uid, result: scan.result, message: scan.message ?? '' });
  }

  private applyCollector(session: Schema['NfcReaderSession']['type']): void {
    this.collectorRevision++;
    this.collectorStatus = session.collectorStatus ?? null;
    this.collectorTournament = session.collectorTournament ?? '';
    this.collectorMessage = session.collectorMessage ?? '';
    this.collectorUpdatedAt = session.collectorUpdatedAt ?? 0;
    this.refreshCollector();
  }

  private refreshCollector(): void {
    if (this.isCollectorActive()) {
      this.collector.set({ status: 'active', tournament: this.collectorTournament, message: '' });
    } else if (this.collectorStatus === 'paused' || this.collectorStatus === 'stopped') {
      // Un arrêt reste affiché tel quel : fees-collector ne republie plus de heartbeat dans cet état.
      this.collector.set({ status: this.collectorStatus, tournament: this.collectorTournament, message: this.collectorMessage });
    } else {
      this.collector.set({ status: 'absent', tournament: '', message: '' });
    }
  }

  private isCollectorActive(): boolean {
    return this.collectorStatus === 'active' && nowSeconds() - this.collectorUpdatedAt <= STALE_SECONDS;
  }

  private showFeedback(feedback: Omit<ScanFeedback, 'at'>, expires = true): void {
    clearTimeout(this.feedbackTimer);
    const shown = { ...feedback, at: new Date() };
    this.feedback.set(shown);
    if (expires) {
      this.lastReading.set(shown);
      if (this.buzzerEnabled() && feedback.result !== 'pending') {
        void this.reader.beep(BUZZER_PATTERNS[feedback.result]);
      }
      this.feedbackTimer = setTimeout(() => this.zone.run(() => this.feedback.set(null)), FEEDBACK_DISPLAY_MS);
    }
  }
}

function readBuzzerSetting(): boolean {
  try {
    return localStorage.getItem(BUZZER_KEY) !== 'off';
  } catch {
    return true;
  }
}
