import { Injectable } from '@angular/core';
import { MailingApiService } from '../services/mailing-api.service';
import { SystemDataService } from '../../common/services/system-data.service';
import { MAILING_TEMPLATE } from './mailing-template';

export interface EmailAttachment {
    filename: string;
    content: string;
    contentType: string;
}

export interface SendEmailParams {
    to: string[];
    subject: string;
    bodyHtml: string;
    attachments?: EmailAttachment[];
}

@Injectable({
    providedIn: 'root'
})
export class MailingService {

    private readonly defaultFrom = '"Bridge Club Saint-Orens" <noreply@bridgeclubsaintorens.fr>';
    private readonly defaultReplyTo = '"Bridge Club Saint-Orens" <bridge.saintorens@free.fr>';
    private ccEmail = '';
    private tagline = 'Votre club de bridge convivial et dynamique';

    constructor(
        private mailingApi: MailingApiService,
        private systemDataService: SystemDataService
    ) {
        // Charger la configuration système (ccEmail et tagline) une seule fois
        this.systemDataService.get_ui_settings().subscribe(ui => {
            this.ccEmail = ui?.email?.ccEmail || '';
            this.tagline = ui?.email?.tagline || 'Votre club de bridge convivial et dynamique';
        });
    }

    /**
     * Construit un email HTML complet en remplaçant les placeholders du template
     * @param bodyHtml Le contenu HTML personnalisé
     * @returns Le HTML complet prêt à être envoyé
     */
    buildEmailTemplate(bodyHtml: string): string {
        return MAILING_TEMPLATE
            .replace('{{TAGLINE}}', this.tagline)
            .replace('{{BODY_HTML}}', bodyHtml);
    }

    async sendEmail(params: SendEmailParams): Promise<any> {
        // Valider les paramètres
        if (!params.to || params.to.length === 0) {
            throw new Error('Au moins un destinataire est requis');
        }
        if (!params.subject) {
            throw new Error('Un sujet est requis');
        }
        if (!params.bodyHtml) {
            throw new Error('Un contenu HTML est requis');
        }

        // Préparer le body HTML avec le template
        const fullBodyHtml = this.buildEmailTemplate(params.bodyHtml);

        // Construire la requête d'envoi
        const emailRequest = {
            from: this.defaultFrom,
            to: params.to,
            cc: this.ccEmail ? [this.ccEmail] : undefined,
            subject: params.subject,
            bodyHtml: fullBodyHtml,
            attachments: params.attachments && params.attachments.length > 0 ? params.attachments : undefined,
            replyTo: this.defaultReplyTo
        };

        try {
            const result = await this.mailingApi.sendEmail(emailRequest);
            return result;
        } catch (error: any) {
            throw new Error(error?.error?.error || error?.message || 'Erreur lors de l\'envoi du mail');
        }
    }

    /**
     * Envoie un sondage à une liste de destinataires via ses-mailing (mode survey).
     * Génère un token SurveyToken par destinataire côté Lambda.
     */
    async sendSurvey(params: {
        surveyId: string;
        subject: string;
        surveyBodyHtml: string;   // corps sans template (markers [SURVEY_LINK] inclus)
        closingDate?: string;
        recipients: Array<{ email: string; name: string; memberId?: string; isExternal?: boolean }>;
        attachments?: Array<{filename: string; content: string; contentType: string}>;
    }): Promise<any> {
        if (!params.recipients.length) throw new Error('Aucun destinataire');
        const emailTemplate = this.buildEmailTemplate(params.surveyBodyHtml);
        try {
            return await this.mailingApi.sendSurvey({
                surveyId: params.surveyId,
                subject: params.subject,
                emailTemplate,
                closingDate: params.closingDate,
                recipients: params.recipients,
                from: this.defaultFrom,
                baseUrl: window.location.origin,
                attachments: params.attachments?.length ? params.attachments : undefined,
            });
        } catch (error: any) {
            throw new Error(error?.error?.error || error?.message || 'Erreur lors de l\'envoi du sondage');
        }
    }
}
