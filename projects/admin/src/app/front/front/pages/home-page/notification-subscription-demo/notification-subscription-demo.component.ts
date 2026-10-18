import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NotificationDemoTopic,
  NotificationSubscriptionDemoService,
} from './notification-subscription-demo.service';

type DemoDecision = 'accepted' | 'later' | 'declined';

interface DemoPreference {
  decision: DemoDecision;
  topics: NotificationDemoTopic[];
  updatedAt: string;
}

const STORAGE_KEY = 'bcsto.pushNotificationDemo.preference';

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

  constructor(private demoService: NotificationSubscriptionDemoService) {}

  get hasSelection(): boolean {
    return this.news || this.partner || this.alerts;
  }

  ngOnInit(): void {
    const mode = new URLSearchParams(window.location.search).get('push-demo');
    if (mode === 'reset') {
      this.clearPreference();
    }
    this.visible = true;
  }

  async activate(): Promise<void> {
    const topics = this.selectedTopics();
    if (topics.length === 0 || this.requestingPermission) {
      return;
    }

    this.requestingPermission = true;
    this.errorMessage = '';
    try {
      await this.demoService.requestPermissionAndNotify(topics);
      this.savePreference('accepted', topics);
      this.visible = false;
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Impossible d’afficher la notification de démonstration.';
    } finally {
      this.requestingPermission = false;
    }
  }

  decideLater(): void {
    this.savePreference('later', this.selectedTopics());
    this.visible = false;
  }

  decline(): void {
    this.savePreference('declined', []);
    this.visible = false;
  }

  private selectedTopics(): NotificationDemoTopic[] {
    const topics: NotificationDemoTopic[] = [];
    if (this.news) topics.push('news');
    if (this.partner) topics.push('partner');
    if (this.alerts) topics.push('alerts');
    return topics;
  }

  private savePreference(decision: DemoDecision, topics: NotificationDemoTopic[]): void {
    const preference: DemoPreference = {
      decision,
      topics,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
    } catch {
      this.errorMessage = 'Le choix ne peut pas être mémorisé par ce navigateur.';
    }
  }

  private clearPreference(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The demo can still run when browser storage is unavailable.
    }
  }
}
