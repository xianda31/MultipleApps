import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { FileService, S3_ROOT_FOLDERS } from '../../common/services/files.service';
import { ToastService } from '../../common/services/toast.service';

export interface BreakingNewsMessage {
  id: string;
  text: string;
  active: boolean;
  createdAt: Date;
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
  private _visible$ = new BehaviorSubject<boolean>(true);
  visible$ = this._visible$.asObservable();

  private _messages$ = new BehaviorSubject<BreakingNewsMessage[]>([]);
  messages$ = this._messages$.asObservable();

  private S3_PATH = `${S3_ROOT_FOLDERS.SYSTEM}/breaking-news.txt`;

  constructor(
    private fileService: FileService,
    private toastService: ToastService
  ) {
    this.loadMessages();
  }

  toggle() {
    this._visible$.next(!this._visible$.value);
  }

  get isVisible(): boolean {
    return this._visible$.value;
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
            .then((data: any[]) => {
              const messages = data.map(msg => ({
                ...msg,
                createdAt: new Date(msg.createdAt)
              }));
              this._messages$.next(messages);
            })
            .catch(() => {
              this._messages$.next([]);
            });
        },
        error: () => {
          this._messages$.next([]);
        }
      });
  }

  async saveMessages(messages: BreakingNewsMessage[]): Promise<void> {
    try {
      await this.fileService.upload_to_S3(messages, `${S3_ROOT_FOLDERS.SYSTEM}/`, 'breaking-news.txt', true);
      this._messages$.next(messages);
      this.toastService.showInfo('Breaking news sauvegardés', 'success');
    } catch (error) {
      console.error('Error saving breaking news:', error);
      this.toastService.showErrorToast('Erreur lors de la sauvegarde', 'error');
      throw error;
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
