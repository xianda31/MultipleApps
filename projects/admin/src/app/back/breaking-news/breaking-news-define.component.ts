import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BreakingNewsService, BreakingNewsMessage, EMOJI_SUGGESTIONS } from './breaking-news.service';

@Component({
  selector: 'app-breaking-news-define',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './breaking-news-define.component.html',
  styleUrl: './breaking-news-define.component.scss'
})
export class BreakingNewsDefineComponent implements OnInit, OnDestroy {
  messages: BreakingNewsMessage[] = [];
  newMessageText = '';
  editingId: string | null = null;
  editingText = '';
  saving = false;
  emojis = EMOJI_SUGGESTIONS;
  showEmojiPicker = false;
  showEditEmojiPicker = false;

  constructor(private breakingNewsService: BreakingNewsService) {}

  ngOnInit(): void {
    this.breakingNewsService.activate();
    this.breakingNewsService.messages$.subscribe(messages => {
      this.messages = messages;
    });
  }

  ngOnDestroy(): void {
    this.breakingNewsService.deactivate();
  }

  addMessage(): void {
    if (this.newMessageText.trim()) {
      this.saving = true;
      this.breakingNewsService.saveMessages([
        ...this.messages,
        {
          id: Date.now().toString(),
          text: this.newMessageText.trim(),
          active: true,
          createdAt: new Date()
        }
      ]).then(() => {
        this.newMessageText = '';
        this.saving = false;
      }).catch(() => {
        this.saving = false;
      });
    }
  }

  startEdit(message: BreakingNewsMessage): void {
    this.editingId = message.id;
    this.editingText = message.text;
    this.showEditEmojiPicker = false;
  }

  saveEdit(): void {
    if (this.editingId && this.editingText.trim()) {
      this.saving = true;
      const updated = this.messages.map(msg =>
        msg.id === this.editingId ? { ...msg, text: this.editingText.trim() } : msg
      );
      this.breakingNewsService.saveMessages(updated).then(() => {
        this.editingId = null;
        this.editingText = '';
        this.saving = false;
      }).catch(() => {
        this.saving = false;
      });
    }
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editingText = '';
    this.showEditEmojiPicker = false;
  }

  toggleActive(id: string): void {
    this.saving = true;
    const updated = this.messages.map(msg =>
      msg.id === id ? { ...msg, active: !msg.active } : msg
    );
    this.breakingNewsService.saveMessages(updated).then(() => {
      this.saving = false;
    }).catch(() => {
      this.saving = false;
    });
  }

  deleteMessage(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
      this.saving = true;
      const updated = this.messages.filter(msg => msg.id !== id);
      this.breakingNewsService.saveMessages(updated).then(() => {
        this.saving = false;
      }).catch(() => {
        this.saving = false;
      });
    }
  }

  insertEmoji(emoji: string): void {
    this.newMessageText = `${emoji} ${this.newMessageText}`;
    this.showEmojiPicker = false;
  }

  insertEmojiInEdit(emoji: string): void {
    this.editingText = `${emoji} ${this.editingText}`;
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }
}
