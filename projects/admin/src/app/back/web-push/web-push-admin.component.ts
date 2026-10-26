import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { firstValueFrom } from 'rxjs';
import { GetConfirmationComponent } from '../../common/modals/get-confirmation.component';
import {
  NotificationSubscriptionService,
  NotificationTopic,
} from '../../front/front/pages/home-page/notification-subscription/notification-subscription.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';
import {
  WebPushAdminService,
  WebPushSendResult,
} from './web-push-admin.service';

type WebPushTarget = 'current-browser' | 'topic';

@Component({
  selector: 'app-web-push-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './web-push-admin.component.html',
  styleUrl: './web-push-admin.component.scss',
})
export class WebPushAdminComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);

  readonly topics: { value: NotificationTopic; label: string; description: string }[] = [
    { value: 'news', label: 'Actualités', description: 'Nouvelles publications du club.' },
    { value: 'partner', label: 'Partenaires', description: 'Recherches de partenaire pour un tournoi.' },
    { value: 'alerts', label: 'Alertes', description: 'Reports, annulations et changements importants.' },
  ];

  readonly form = this.formBuilder.nonNullable.group({
    target: ['current-browser' as WebPushTarget, Validators.required],
    topic: ['alerts' as NotificationTopic, Validators.required],
    title: ['Bridge Club Saint-Orens', [Validators.required, Validators.maxLength(80)]],
    body: ['', [Validators.required, Validators.maxLength(240)]],
    url: ['/front/accueil', [Validators.required, Validators.maxLength(512), Validators.pattern(/^\/(?!\/).+/)]],
  });

  webPushActive = false;
  loading = true;
  sending = false;
  currentSubscriptionId: string | null = null;
  currentTopics: NotificationTopic[] = [];
  currentBrowserError = '';
  sendError = '';
  result: WebPushSendResult | null = null;

  constructor(
    private modalService: NgbModal,
    private notificationSubscriptionService: NotificationSubscriptionService,
    private systemDataService: SystemDataService,
    private toastService: ToastService,
    private webPushAdminService: WebPushAdminService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const configuration = await firstValueFrom(this.systemDataService.get_configuration());
      this.webPushActive = configuration.web_push_active ?? false;
      if (!this.webPushActive) return;

      try {
        const preferences = await this.notificationSubscriptionService.reconcileAcceptedSubscription();
        this.currentSubscriptionId = preferences.subscriptionId ?? null;
        this.currentTopics = preferences.topics;
      } catch (error) {
        console.error('[WebPushAdmin] Unable to reconcile the current browser subscription:', error);
        this.currentBrowserError = 'L’abonnement Push de ce navigateur n’a pas pu être vérifié.';
      }
    } catch (error) {
      console.error('[WebPushAdmin] Unable to load system configuration:', error);
      this.sendError = 'La configuration système n’a pas pu être chargée.';
    } finally {
      this.loading = false;
    }
  }

  get target(): WebPushTarget {
    return this.form.controls.target.value;
  }

  get topic(): NotificationTopic {
    return this.form.controls.topic.value;
  }

  get currentBrowserAcceptsTopic(): boolean {
    return !!this.currentSubscriptionId && this.currentTopics.includes(this.topic);
  }

  get canSend(): boolean {
    return this.webPushActive
      && !this.sending
      && this.form.valid
      && (this.target === 'topic' || this.currentBrowserAcceptsTopic);
  }

  async send(): Promise<void> {
    this.form.markAllAsTouched();
    if (!this.canSend) return;

    if (this.target === 'topic' && !await this.confirmCollectiveSend()) {
      return;
    }

    this.sending = true;
    this.sendError = '';
    this.result = null;
    const values = this.form.getRawValue();
    try {
      this.result = await this.webPushAdminService.send({
        topic: values.topic,
        title: values.title.trim(),
        body: values.body.trim(),
        url: values.url.trim(),
        subscriptionId: values.target === 'current-browser'
          ? this.currentSubscriptionId!
          : undefined,
      });
      if (this.result.failed > 0) {
        this.toastService.showWarning(
          'Test Web Push',
          `${this.result.sent} envoi(s) réussi(s), ${this.result.failed} en échec.`,
        );
      } else {
        this.toastService.showSuccess(
          'Test Web Push',
          `${this.result.sent} notification(s) envoyée(s).`,
        );
      }
    } catch (error) {
      console.error('[WebPushAdmin] Send failed:', error);
      this.sendError = error instanceof Error ? error.message : String(error);
      this.toastService.showError('Test Web Push', 'La notification n’a pas pu être envoyée.');
    } finally {
      this.sending = false;
    }
  }

  private async confirmCollectiveSend(): Promise<boolean> {
    const topicLabel = this.topics.find(topic => topic.value === this.topic)?.label ?? this.topic;
    const modalRef = this.modalService.open(GetConfirmationComponent, { centered: true });
    modalRef.componentInstance.title = 'Confirmer l’envoi collectif';
    modalRef.componentInstance.subtitle = `La notification sera envoyée à tous les abonnements du thème « ${topicLabel} ».`;
    modalRef.componentInstance.message = 'Utilisez ce mode uniquement pour un test collectif contrôlé.';
    modalRef.componentInstance.confirmLabel = 'Envoyer';
    modalRef.componentInstance.cancelLabel = 'Annuler';
    modalRef.componentInstance.confirmButtonClass = 'btn-danger';
    modalRef.componentInstance.cancelButtonClass = 'btn-outline-secondary';
    return modalRef.result.catch(() => false);
  }
}
