import { Injectable } from '@angular/core';
import { Member } from '../../common/interfaces/member.interface';
import { Product } from '../products/product.interface';
import { SondageService } from '../sondage/sondage.service';
import { TicketingService } from './ticketing.service';

/** Action après vente qui rattache la vente d'un produit à une réservation de billetterie. */
export const SETTLE_TICKETING_RESERVATION = 'SETTLE_TICKETING_RESERVATION';

/**
 * Règle de vente d'un repas ou d'un événement : chaque bénéficiaire (nom porté sur l'article, quel que soit
 * l'acheteur) doit avoir répondu « je viens » au sondage rattaché au produit, et ne l'avoir pas déjà réglé.
 */
@Injectable({ providedIn: 'root' })
export class EventTicketGuardService {
  constructor(
    private readonly sondageService: SondageService,
    private readonly ticketingService: TicketingService,
  ) {}

  /** Motif du refus, ou `null` si la vente est autorisée pour tous les bénéficiaires. */
  async refusalReason(product: Product, beneficiaries: Member[]): Promise<string | null> {
    if (product.fulfillmentAction !== SETTLE_TICKETING_RESERVATION) return null;

    const surveys = (await this.sondageService.listSurveys()).filter((survey) => survey.productTag === product.id);
    if (surveys.length === 0) {
      return `« ${product.name} » ne peut être acheté qu’après réponse à son sondage, et aucun sondage n’y est rattaché.`;
    }
    const surveyTitles = surveys.map((survey) => `« ${survey.title} »`).join(', ');

    const [responses, reservations] = await Promise.all([
      Promise.all(surveys.map((survey) => this.sondageService.listResponsesForSurvey(survey.id))).then((lists) => lists.flat()),
      this.ticketingService.listEventReservations(product.id),
    ]);

    for (const member of beneficiaries) {
      const name = `${member.lastname} ${member.firstname}`.trim();
      const answered = responses.some((response) => response.memberId === member.id
        && response.paymentStatus === 'payable' && response.requiresReconfirmation !== true);
      if (!answered) {
        return `${name} n’a pas répondu « je viens » au sondage ${surveyTitles} : achat impossible.`;
      }
      const paid = reservations.some((reservation) => reservation.reservationKey === `member:${member.id}`
        && reservation.reservationStatus === 'sold');
      if (paid) {
        return `${name} a déjà réglé « ${product.name} ».`;
      }
    }
    return null;
  }
}
