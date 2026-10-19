import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NotificationSubscriptionService,
  NotificationTopic,
} from './notification-subscription-demo.service';

@Component({
  selector: 'app-notification-subscription-demo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-subscription-demo.component.html',
  styleUrl: './notification-subscription-demo.component.scss',
})
export class NotificationSubscriptionDemoComponent implements OnInit {
  visible = false;
  requestingPermission = false;
  errorMessage = '';
  news = false;
  partner = false;
  alerts = false;

  constructor(private notificationService: NotificationSubscriptionService) {}

  get hasSelection(): boolean {
    return this.news || this.partner || this.alerts;
  }

  async ngOnInit(): Promise<void> {
    const mode = new URLSearchParams(window.location.search).get('push-demo');
    if (mode === 'reset') {
      this.notificationService.reset();
    }
    let preferences = this.notificationService.preferences;
    try {
      preferences = await this.notificationService.reconcileAcceptedSubscription();
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Impossible de vérifier l’abonnement Push de ce navigateur.';
    }
    this.news = preferences.topics.includes('news');
    this.partner = preferences.topics.includes('partner');
    this.alerts = preferences.topics.includes('alerts');
    this.visible = mode === 'reset' || preferences.decision === 'later' || !!this.errorMessage;
  }

  async activate(): Promise<void> {
    const topics = this.selectedTopics();
    if (topics.length === 0 || this.requestingPermission) {
      return;
    }

    this.requestingPermission = true;
    this.errorMessage = '';
    try {
      await this.notificationService.subscribe(topics);
      this.visible = false;
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Impossible d’activer les notifications.';
    } finally {
      this.requestingPermission = false;
    }
  }

  decideLater(): void {
    this.notificationService.decideLater(this.selectedTopics());
    this.visible = false;
  }

  decline(): void {
    this.notificationService.decline();
    this.visible = false;
  }

  private selectedTopics(): NotificationTopic[] {
    const topics: NotificationTopic[] = [];
    if (this.news) topics.push('news');
    if (this.partner) topics.push('partner');
    if (this.alerts) topics.push('alerts');
    return topics;
  }

}
