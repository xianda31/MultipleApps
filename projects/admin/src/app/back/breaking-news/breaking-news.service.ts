import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map, shareReplay } from 'rxjs';
import { FileService, S3_ROOT_FOLDERS } from '../../common/services/files.service';
import { ToastService } from '../../common/services/toast.service';

export interface BreakingNewsMessage {
  id: string;
  text: string;
  active: boolean;
  createdAt: Date;
}

export interface BreakingNewsConfig {
  authorizationFlag: boolean; // Flag de définition du droit d'afficher le bandeau
  messages: BreakingNewsMessage[];
}

export const EMOJI_SUGGESTIONS = [
  { emoji: '📅', label: 'Calendrier' },
  { emoji: '🏆', label: 'Trophée/Résultat' },
  { emoji: '💳', label: 'Finance/Paiement' },
  { emoji: '📣', label: 'Annonce' },
  { emoji: '⚠️', label: 'Attention' },
  { emoji: '✅', label: 'Confirmation' },
  { emoji: '🔔', label: 'Notification' },
  { emoji: '📢', label: 'Haut-parleur' },
  { emoji: '👥', label: 'Personnes/Adhérents' },
  { emoji: '💼', label: 'Bureau/Professionnel' },
  { emoji: '🎉', label: 'Célébration' },
  { emoji: 'ℹ️', label: 'Information' },
  { emoji: '🚀', label: 'Nouveau/Démarrage' },
  { emoji: '⏰', label: 'Horaire/Délai' },
  { emoji: '📝', label: 'Administration/Formulaire' },
  { emoji: '🎲', label: 'Compétition/Loisir' }
];

@Injectable({ providedIn: 'root' })
export class BreakingNewsService {
  private _authorizationFlag$ = new BehaviorSubject<boolean>(true); // Flag d'autorisation - persisté en S3
  private _globalVisible$ = new BehaviorSubject<boolean>(true); // Switch d'affichage (navbar)
  private _componentActive$ = new BehaviorSubject<boolean>(false); // Contrôle local (composant)
  
  // Visible si: authorizationFlag=true ET globalVisible=true ET componentActive=true
  visible$ = combineLatest([this._authorizationFlag$, this._globalVisible$, this._componentActive$]).pipe(
    map(([auth, global, component]) => auth && global && component),
    shareReplay(1)
  );

  private _messages$ = new BehaviorSubject<BreakingNewsMessage[]>([]);
  messages$ = this._messages$.asObservable();

  private S3_PATH = `${S3_ROOT_FOLDERS.SYSTEM}/breaking-news.txt`;

  constructor(
    private fileService: FileService,
    private toastService: ToastService
  ) {
    this.loadMessages();
  }

  // Contrôle du flag d'autorisation (persisté en S3)
  setAuthorizationFlag(authorized: boolean): void {
    this._authorizationFlag$.next(authorized);
    this.saveAuthorizationFlag();
  }

  get isAuthorizationFlagSet(): boolean {
    return this._authorizationFlag$.value;
  }

  get authorizationFlag$(): Observable<boolean> {
    return this._authorizationFlag$.asObservable();
  }

  // Contrôle global (navbar switch)
  toggleView(): void {
    this._globalVisible$.next(!this._globalVisible$.value);
  }

  setGlobalVisible(visible: boolean): void {
    this._globalVisible$.next(visible);
  }

  get isGlobalVisible(): boolean {
    return this._globalVisible$.value;
  }

  // Contrôle local (composant)
  activate(): void {
    this._componentActive$.next(true);
  }

  deactivate(): void {
    this._componentActive$.next(false);
  }

  get isComponentActive(): boolean {
    return this._componentActive$.value;
  }

  // Hérité du service
  toggle() {
    this.toggleView();
  }

  get isVisible(): boolean {
    return this._globalVisible$.value && this._componentActive$.value;
  }

  get messages(): BreakingNewsMessage[] {
    return this._messages$.value;
  }

  loadMessages(): void {
    this.fileService.getPresignedUrl$(this.S3_PATH, true)
      .subscribe({
        next: (url) => {
          fetch(url)
            .then(response => {
              if (!response.ok) throw new Error('Failed to load');
              return response.json();
            })
            .then((data: any) => {
              
              // Charger le flag d'autorisation
              if (typeof data.authorizationFlag === 'boolean') {
                this._authorizationFlag$.next(data.authorizationFlag);
              }
              
              // Charger les messages
              const messages = (data.messages || []).map((msg: any) => ({
                ...msg,
                createdAt: new Date(msg.createdAt)
              }));
              // s'il ny a qu'un seul message, on rajoute un message fantôme pour éviter les problèmes d'animation du ticker
              if (messages.length === 1) {
                messages.push({
                  id: 'dummy',
                  text: '',
                  active: false,
                  createdAt: new Date()
                });
              }

              this._messages$.next(messages);
            })
            .catch((err) => {
              console.error('[BreakingNewsService] Error loading data:', err);
              this._authorizationFlag$.next(true); // Valeur par défaut
              this._messages$.next([]);
            });
        },
        error: (err) => {
          console.error('[BreakingNewsService] Error getting S3 URL:', err);
          this._authorizationFlag$.next(true); // Valeur par défaut
          this._messages$.next([]);
        }
      });
  }

  async saveMessages(messages: BreakingNewsMessage[]): Promise<void> {
    try {
      const config: BreakingNewsConfig = {
        authorizationFlag: this._authorizationFlag$.value,
        messages: messages
      };
      await this.fileService.upload_to_S3(config, `${S3_ROOT_FOLDERS.SYSTEM}/`, 'breaking-news.txt', true);
      this._messages$.next(messages);
      this.toastService.showInfo('Breaking news sauvegardés', 'success');
    } catch (error) {
      console.error('Error saving breaking news:', error);
      this.toastService.showErrorToast('Erreur lors de la sauvegarde', 'error');
      throw error;
    }
  }

  private async saveAuthorizationFlag(): Promise<void> {
    try {
      const config: BreakingNewsConfig = {
        authorizationFlag: this._authorizationFlag$.value,
        messages: this._messages$.value
      };
      await this.fileService.upload_to_S3(config, `${S3_ROOT_FOLDERS.SYSTEM}/`, 'breaking-news.txt', true);
    } catch (error) {
      console.error('Error saving authorization flag:', error);
    }
  }

  addMessage(text: string): void {
    const newMessage: BreakingNewsMessage = {
      id: Date.now().toString(),
      text,
      active: true,
      createdAt: new Date()
    };
    const updated = [...this.messages, newMessage];
    this.saveMessages(updated);
  }

  updateMessage(id: string, text: string): void {
    const updated = this.messages.map(msg =>
      msg.id === id ? { ...msg, text } : msg
    );
    this.saveMessages(updated);
  }

  toggleMessage(id: string): void {
    const updated = this.messages.map(msg =>
      msg.id === id ? { ...msg, active: !msg.active } : msg
    );
    this.saveMessages(updated);
  }

  deleteMessage(id: string): void {
    const updated = this.messages.filter(msg => msg.id !== id);
    this.saveMessages(updated);
  }
}
