import { Injectable } from '@angular/core';
import { DBhandler } from './graphQL.service';
import { AssistanceRequest, AssistanceRequestInput, REQUEST_STATUS } from '../interfaces/assistance-request.interface';
import { BehaviorSubject, Observable, switchMap, tap } from 'rxjs';
import { ToastService } from './toast.service';


@Injectable({ providedIn: 'root' })
export class AssistanceRequestService {
  _requests !: AssistanceRequest[];
  _request$: BehaviorSubject<AssistanceRequest[]> = new BehaviorSubject(this._requests);

  constructor(
    private db: DBhandler,
     private toastService: ToastService) { }

  /**
   * Crée une demande d'assistance automatique pour tracer les pannes de connexion.
   * Utilisé pour les cas où la session est corrompue ou incohérente.
   */
  async reportAuthError(email: string, errorType: string, errorDetails: string) {
    try {
      const input: AssistanceRequestInput = {
        nom: '[SYSTÈME]',
        prenom: 'Auto-rapport',
        email: email || 'inconnu',
        type: 'Problème à la connexion',
        texte: `[Auto-diagnostic] ${errorType}\n\nDétails: ${errorDetails}\n\nDate: ${new Date().toISOString()}\nUser-Agent: ${navigator.userAgent}`,
        status: REQUEST_STATUS.NEW
      };
      await this.db.createAssistanceRequest(input);
      console.log('[AssistanceRequestService] Panne de connexion signalée automatiquement');
    } catch (err) {
      // Ne pas bloquer le flux principal si le rapport échoue
      console.warn('[AssistanceRequestService] Impossible de signaler la panne:', err);
    }
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
      this.toastService.showErrorToast('Erreur', `La création de la demande a échoué.`);
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
      this.toastService.showErrorToast('Erreur', `La mise à jour de la demande a échoué.`);
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
}
