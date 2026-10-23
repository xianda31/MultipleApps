import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NotificationSubscriptionService,
  NotificationTopic,
  shouldPromptForNotifications,
} from './notification-subscription.service';

@Component({
  selector: 'app-notification-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification-subscription.component.html',
  styleUrl: './notification-subscription.component.scss',
})
export class NotificationSubscriptionComponent implements OnInit {
  visible = false;
  requestingPermission = false;
  permissionBlocked = false;
  errorMessage = '';
  news = false;
  partner = false;
  alerts = false;

  constructor(private notificationService: NotificationSubscriptionService) {}

  get hasSelection(): boolean {
    return this.news || this.partner || this.alerts;
  }

  async ngOnInit(): Promise<void> {
    if (!this.notificationService.isSupported) {
      return;
    }

    const mode = new URLSearchParams(window.location.search).get('push');
    if (mode === 'reset') {
      this.notificationService.reset();
    }
    let preferences = this.notificationService.preferences;
    const subscriptionWasAccepted = preferences.decision === 'accepted';
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
    this.permissionBlocked = Notification.permission === 'denied';
    if (this.permissionBlocked) {
      this.errorMessage =
        'Les notifications sont bloquées dans les réglages de ce navigateur. Autorisez-les pour ce site avant de réessayer.';
    }
    this.visible = mode === 'reset'
      || shouldPromptForNotifications(preferences)
      || (subscriptionWasAccepted && this.permissionBlocked)
      || !!this.errorMessage;
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
      this.permissionBlocked = Notification.permission === 'denied';
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
