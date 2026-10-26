import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { SystemConfiguration } from '../../common/interfaces/system-conf.interface';
import { SystemDataService } from '../../common/services/system-data.service';
import { ToastService } from '../../common/services/toast.service';
import { NotificationSubscriptionService } from '../../front/front/pages/home-page/notification-subscription/notification-subscription.service';
import { WebPushAdminComponent } from './web-push-admin.component';
import { WebPushAdminService } from './web-push-admin.service';

describe('WebPushAdminComponent', () => {
  let component: WebPushAdminComponent;
  let modalService: jasmine.SpyObj<NgbModal>;
  let webPushAdminService: jasmine.SpyObj<WebPushAdminService>;

  beforeEach(() => {
    modalService = jasmine.createSpyObj<NgbModal>('NgbModal', ['open']);
    webPushAdminService = jasmine.createSpyObj<WebPushAdminService>('WebPushAdminService', ['send']);
    webPushAdminService.send.and.resolveTo({
      selected: 1,
      sent: 1,
      expired: 0,
      failed: 0,
      failures: [],
    });

    TestBed.configureTestingModule({
      imports: [WebPushAdminComponent],
      providers: [
        { provide: NgbModal, useValue: modalService },
        { provide: WebPushAdminService, useValue: webPushAdminService },
        {
          provide: NotificationSubscriptionService,
          useValue: {
            reconcileAcceptedSubscription: () => Promise.resolve({
              decision: 'accepted',
              topics: ['alerts'],
              subscriptionId: 'current-browser-id',
              updatedAt: '2026-10-26T17:00:00.000Z',
            }),
          },
        },
        {
          provide: SystemDataService,
          useValue: {
            get_configuration: () => of({ web_push_active: true } as SystemConfiguration),
          },
        },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['showSuccess', 'showWarning', 'showError']) },
      ],
    });

    component = TestBed.createComponent(WebPushAdminComponent).componentInstance;
  });

  it('sends a test to the current browser subscription', async () => {
    await component.ngOnInit();
    component.form.controls.body.setValue('Notification de test');

    await component.send();

    expect(webPushAdminService.send).toHaveBeenCalledOnceWith({
      topic: 'alerts',
      title: 'Bridge Club Saint-Orens',
      body: 'Notification de test',
      url: '/front/accueil',
      subscriptionId: 'current-browser-id',
    });
    expect(component.result?.sent).toBe(1);
  });

  it('requires confirmation and removes individual targeting for a topic send', async () => {
    modalService.open.and.returnValue({
      componentInstance: {},
      result: Promise.resolve(true),
    } as never);
    await component.ngOnInit();
    component.form.patchValue({
      target: 'topic',
      topic: 'news',
      body: 'Actualité de test',
    });

    await component.send();

    expect(modalService.open).toHaveBeenCalled();
    expect(webPushAdminService.send).toHaveBeenCalledOnceWith({
      topic: 'news',
      title: 'Bridge Club Saint-Orens',
      body: 'Actualité de test',
      url: '/front/accueil',
      subscriptionId: undefined,
    });
  });
});
