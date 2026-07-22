import { Injectable } from '@angular/core';
import { DBhandler } from './graphQL.service';
import { AssistanceRequest, AssistanceRequestInput, REQUEST_STATUS } from '../interfaces/assistance-request.interface';
import { BehaviorSubject, Observable, switchMap, tap, map } from 'rxjs';
import { ToastService } from './toast.service';


@Injectable({ providedIn: 'root' })
export class AssistanceRequestService {
  _requests !: AssistanceRequest[];
  _request$: BehaviorSubject<AssistanceRequest[]> = new BehaviorSubject(this._requests);

  private readonly AUTH_REPORT_SCHEMA_VERSION = '2';

  constructor(
    private db: DBhandler,
     private toastService: ToastService) { }

  /**
   * Crée une demande d'assistance automatique pour tracer les pannes de connexion.
   * Utilisé pour les cas où la session est corrompue ou incohérente.
   */
  async reportAuthError(
    email: string,
    summary: string,
    errorDetails: string,
    context?: {
      stage?: string;
      memberId?: string;
      loginId?: string;
      recoveryAttempted?: boolean;
      retryAttempted?: boolean;
      errorName?: string;
      source?: string;
    }
  ) {
    try {
      const nowIso = new Date().toISOString();
      const safeEmail = (email || 'inconnu').trim().toLowerCase();
      const stage = context?.stage || 'inconnue';
      const fingerprint = this.buildFingerprint(safeEmail, summary, errorDetails, stage);

      const lines = [
        `[Auto-diagnostic Auth v${this.AUTH_REPORT_SCHEMA_VERSION}] ${summary}`,
        `Etape: ${stage}`,
        `Email: ${safeEmail}`,
        `member_id: ${context?.memberId || 'absent'}`,
        `loginId: ${context?.loginId || 'absent'}`,
        `Recovery tentee: ${context?.recoveryAttempted ? 'oui' : 'non'}`,
        `Retry tente: ${context?.retryAttempted ? 'oui' : 'non'}`,
        `Nom erreur: ${context?.errorName || 'non fourni'}`,
        `Source: ${context?.source || 'authentification.service'}`,
        `Fingerprint: ${fingerprint}`,
        '',
        `Details techniques: ${errorDetails}`,
        `Date: ${nowIso}`,
        `User-Agent: ${navigator.userAgent}`,
      ];

      const input: AssistanceRequestInput = {
        nom: '[SYSTÈME]',
        prenom: 'Auto-rapport',
        email: safeEmail,
        type: 'Problème à la connexion',
        texte: lines.join('\n'),
        status: REQUEST_STATUS.NEW
      };
      await this.db.createAssistanceRequest(input);
      console.log('[AssistanceRequestService] Panne de connexion signalée automatiquement');
    } catch (err) {
      // Ne pas bloquer le flux principal si le rapport échoue
      console.warn('[AssistanceRequestService] Impossible de signaler la panne:', err);
    }
  }

  private buildFingerprint(email: string, summary: string, details: string, stage: string): string {
    const seed = `${email}|${summary}|${details}|${stage}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return `AUTH-${hash.toString(16).toUpperCase().padStart(8, '0')}`;
  }

  async createRequest(input: AssistanceRequestInput) {
    try {
       const newRequest = await this.db.createAssistanceRequest(input);
       this.toastService.showSuccess('Demande créée', `Votre demande a bien été enregistrée.`);
       if (this._requests) {  // is probably not initialized because front do not load all requests
       this._requests.push(newRequest);
       this._request$.next(this._requests);
       }
    } catch (error) {
      this.toastService.showError('Erreur', `La création de la demande a échoué.`);
      console.error('Error creating assistance request:', error);
    }
  }

  async updateRequest(request: AssistanceRequest) {
    try {
      const updatedRequest = await this.db.updateAssistanceRequest(request);
      const index = this._requests.findIndex(r => r.id === updatedRequest.id);
      if (index !== -1) {
        this._requests[index] = updatedRequest;
        this._request$.next(this._requests);
        this.toastService.showSuccess('Demande mise à jour', `La demande a bien été mise à jour.`);
      }
    } catch (error) {
      this.toastService.showError('Erreur', `La mise à jour de la demande a échoué.`);
    }
  }

  async deleteRequest(id: string) {
    try {
      await this.db.deleteAssistanceRequest(id);
      if (this._requests) {
        this._requests = this._requests.filter((request) => request.id !== id);
        this._request$.next(this._requests);
      }
      this.toastService.showSuccess('Demande supprimée', `La demande a bien été supprimée.`);
    } catch (error) {
      this.toastService.showError('Erreur', `La suppression de la demande a échoué.`);
    }
  }

  getAllRequests(): Observable<AssistanceRequest[]> {

    let remote_loads$ = this.db.listAssistanceRequests().pipe(
      tap((requests) => {
        this._requests = requests;
        this._request$.next(this._requests);
      }),
      switchMap(() => this._request$.asObservable())
    );

    return this._requests ? this._request$.asObservable() : remote_loads$;
  }

  getOpenRequestsCount(): Observable<number> {
    return this.getAllRequests().pipe(
      map((requests) => requests.filter((r) => r.status !== REQUEST_STATUS.RESOLVED).length)
    );
  }
}
