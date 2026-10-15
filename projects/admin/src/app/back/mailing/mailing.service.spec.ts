import { of } from 'rxjs';
import { MailingApiService } from '../services/mailing-api.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { MailingService } from './mailing.service';

describe('MailingService', () => {
  let mailingApi: jasmine.SpyObj<MailingApiService>;
  let service: MailingService;

  beforeEach(() => {
    mailingApi = jasmine.createSpyObj<MailingApiService>('MailingApiService', ['sendEmail', 'sendSurvey']);
    mailingApi.sendEmail.and.resolveTo({ success: true });
    mailingApi.sendSurvey.and.resolveTo({ success: true });
    const systemDataService = {
      get_ui_settings: () => of({ email: { ccEmail: 'suivi@club.fr' } }),
    } as unknown as SystemDataService;

    service = new MailingService(mailingApi, systemDataService);
  });

  it('forwards recipient details and informed copies separately from the club tracking copy', async () => {
    await service.sendEmail({
      to: ['alice@example.fr'],
      recipientDetails: [{ email: 'alice@example.fr', name: 'Alice ADHERENTE' }],
      copyRecipients: [{ email: 'bureau@example.fr', name: 'Bureau' }],
      subject: 'Information',
      bodyHtml: '<p>Bonjour</p>',
    });

    expect(mailingApi.sendEmail).toHaveBeenCalledWith(jasmine.objectContaining({
      to: ['alice@example.fr'],
      recipientDetails: [{ email: 'alice@example.fr', name: 'Alice ADHERENTE' }],
      copyRecipients: [{ email: 'bureau@example.fr', name: 'Bureau' }],
      cc: ['suivi@club.fr'],
    }));
  });

  it('forwards informed copies for personalized surveys', async () => {
    await service.sendSurvey({
      surveyId: 'survey-1',
      subject: 'Sondage',
      surveyBodyHtml: '<p>[SURVEY_LINK]</p>',
      recipients: [{ email: 'alice@example.fr', name: 'Alice ADHERENTE', memberId: 'member-1' }],
      copyRecipients: [{ email: 'bureau@example.fr', name: 'Bureau' }],
    });

    expect(mailingApi.sendSurvey).toHaveBeenCalledWith(jasmine.objectContaining({
      copyRecipients: [{ email: 'bureau@example.fr', name: 'Bureau' }],
      cc: ['suivi@club.fr'],
    }));
  });
});
