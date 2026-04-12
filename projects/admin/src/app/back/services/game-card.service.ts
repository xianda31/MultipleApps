import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable, switchMap } from 'rxjs';
import { GameCard, MAX_STAMPS, PlayBook_input } from '../game-cards/game-card.interface';
import { Member } from '../../common/interfaces/member.interface';
import { ToastService } from '../../common/services/toast.service';
import { MembersService } from '../../common/services/members.service';
import { DBhandler } from '../../common/services/graphQL.service';
import { MailingService } from '../mailing/mailing.service';


@Injectable({
  providedIn: 'root'
})
export class GameCardService {

  readonly LOW_CREDIT_THRESHOLD = 2; // seuil critique de droits de table restants pour alerter le joueur (en nombre de tampons)
  private members: Member[] = [];
  private _gameCards!: GameCard[];
  private gameCards$: BehaviorSubject<GameCard[]> = new BehaviorSubject<GameCard[]>(this._gameCards);

  constructor(
    private membersService: MembersService,
    private toastService: ToastService,
    private mailingService: MailingService,
    private dbHandler: DBhandler
  ) { }

  // interfaces haut niveau



  check_solvencies(members: Member[]): Observable<Map<string, number>> {
    let solvencies = new Map<string, number>()
    let card_set = new Set<GameCard>([]);

    const share = (card: GameCard, member: Member, members: Member[]): number => {
      let count = card.owners.reduce((acc, owner) => acc += members.find(m => m.id === owner.id) ? 1 : 0, 0);
      if (count === 0) { throw new Error('algorithm failure !!!'); }
      return count;
    }

    const member_credit = (member: Member): number => {
      return Array.from(card_set)
        .filter(card => card.owners.some(owner => owner.license_number === member.license_number))
        .reduce((total, card) => total + (card.initial_qty - card.stamps.length) / share(card, member, members), 0);
    };

    return this.gameCards$.pipe(
      map((cards) => {
        card_set.clear();
        // recherche des cartes de membres
        members.forEach(member => {
          const memberCards = cards.filter(card => card.owners.some(owner => owner.license_number === member.license_number));
          if (memberCards.length > 0) { memberCards.forEach(card => card_set.add(card)) }
        })

        // calcul du solde de chaque membre

        members.forEach(member => {
          const credit = member_credit(member);
          solvencies.set(member.license_number, credit);
        });

        return solvencies;
      })
    );
  }


  get_member_credit(member_license: string): number {
    return this._gameCards
      .filter(c => c.owners.some(owner => owner.license_number === member_license))
      .reduce((total, card) => total + (card.initial_qty - card.stamps.length), 0);
  }

  // get_current_card(member_license: string): GameCard | null {
  //   const memberCards = this._gameCards.filter(c => c.owners.some(owner => owner.license_number === member_license));
  //   if (memberCards.length === 0) {
  //     return null;
  //   }
  //   let current_card= memberCards.sort((a, b) => (a.initial_qty - a.stamps.length) - (b.initial_qty - b.stamps.length))[0];
  //   return current_card;
  // }



  async stamp_member_card(member: Member, stamp_date: string, double: boolean): Promise<boolean> {

    let cards = this._gameCards.filter(c => c.owners.some(owner => (owner.license_number === member.license_number) && (c.stamps.length < c.initial_qty)));
    if (cards.length === 0) {
      this.toastService.showErrorToast('Gestion des cartes', `Aucune carte de tournoi trouvée pour ${member.firstname} ${member.lastname}`);
      return false;
    }
    cards = cards.sort((a, b) => ((a.initial_qty - a.stamps.length) - (b.initial_qty - b.stamps.length)));

    // Calculate credit before stamping
    const creditBefore = this._gameCards
      .filter(c => c.owners.some(owner => owner.license_number === member.license_number))
      .reduce((total, card) => total + (card.initial_qty - card.stamps.length), 0);

    cards[0].stamps.push(stamp_date);
    await this.updateCard(cards[0])
      .catch(error => { console.error('Error stamping member card:', error); })
      .finally(() => {
        if (cards[0].stamps.length >= cards[0].initial_qty) {
          cards.shift(); // remove the card if it is full
        }
      });

    if (double) { // add a second stamp if double
      cards[0].stamps.push(stamp_date);
      await this.updateCard(cards[0])
        .catch(error => {
          console.error('Error stamping member card:', error);
        });
    }

    // Calculate credit after stamping
    const creditAfter = this._gameCards
      .filter(c => c.owners.some(owner => owner.license_number === member.license_number))
      .reduce((total, card) => total + (card.initial_qty - card.stamps.length), 0);

    // Return true if credit crossed below threshold
    // For shared cards, use a higher threshold since each owner will likely stamp
    const threshold = cards[0].owners.length > 1 
      ? this.LOW_CREDIT_THRESHOLD * cards[0].owners.length 
      : this.LOW_CREDIT_THRESHOLD;
    
    const low_credit = creditBefore > threshold && creditAfter <= threshold;
    if (low_credit) {
      this.low_credit_message(cards[0]);
    }
    return low_credit;
  }


  low_credit_message(card: GameCard): void {
    const emails = card.owners.map(owner => owner.email).filter(email => email);
    const cardHtml = this.buildCardHtml(card);
    
    this.mailingService.sendEmail({
      to: emails,
      subject: 'Votre carte de droits de table est presque vide - Pensez à recharger !',
      bodyHtml: `
        <p>Cher ${card.owners.map(owner => owner.firstname).join(', ')},</p>
        
        <p>Le nombre de droits de tables restant sur ta carte de droits de table est bas :</p>
        <p>Merci de penser à la recharger pour continuer à participer aux tournois.</p>
        
        <p>A très bientôt,<br>Le comité du club de bridge</p>
        
        ${cardHtml}

      `
    }).catch(error => {
      console.error('Error sending low credit email:', error);
    });
  }

  private buildCardHtml(card: GameCard): string {
    const ownersHtml = card.owners
      .map(owner => `${owner.lastname} ${owner.firstname}`)
      .join(' &nbsp;et&nbsp; ');
    
    const remainingCredits = card.initial_qty - card.stamps.length;
    const createdDate = card.createdAt ? new Date(card.createdAt).toLocaleDateString('fr-FR') : 'N/A';

    // Grille 4 colonnes par ligne via <table> (seul compatible email)
    const COLS = 4;
    let rows = '';
    for (let row = 0; row < Math.ceil(card.initial_qty / COLS); row++) {
      let cells = '';
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col;
        if (i >= card.initial_qty) {
          cells += '<td></td>';
          continue;
        }
        const isStamped = i < card.stamps.length;
        const label = isStamped
          ? new Date(card.stamps[i]).toLocaleDateString('fr-FR')
          : `n°${i + 1}`;
        const bgColor = isStamped ? '#f8f9fa' : '#ffffff';
        const fontWeight = isStamped ? 'bold' : 'normal';
        const color = isStamped ? '#333' : '#999';
        cells += `
          <td style="padding: 2px;">
            <div style="background-color: ${bgColor}; border: 1px solid #dee2e6; border-radius: 3px; padding: 10px 4px; text-align: center; width: 70px;">
              <small style="font-weight: ${fontWeight}; color: ${color}; font-size: 11px;">${label}</small>
            </div>
          </td>`;
      }
      rows += `<tr>${cells}</tr>`;
    }

    return `
      <div style="border: 1px solid #dee2e6; border-radius: 4px; font-family: Arial, sans-serif; margin: 15px 0; overflow: hidden;">
        
        <!-- En-tête carte -->
        <div style="padding: 12px 16px 8px; border-bottom: 1px solid #dee2e6;">
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">
            Carte de ${card.initial_qty} droits de table
          </div>
          <div style="color: #6c757d; font-size: 13px; margin-bottom: 8px;">
            <strong>titulaire(s) :</strong> ${ownersHtml}
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color: #6c757d; font-size: 13px;">
                <strong>créée le :</strong> ${createdDate}
              </td>
              <td style="text-align: center; color: #6c757d; font-size: 13px;">
                <strong>crédit restant :</strong>
                <span style="background-color: #198754; color: #fff; font-size: 12px; font-weight: bold; padding: 2px 8px; border-radius: 10px; margin-left: 4px;">${remainingCredits}</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Corps : grille des cases -->
        <div style="padding: 12px 16px;">
          <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
            <tbody>${rows}</tbody>
          </table>
        </div>

      </div>
    `;
  }

  //  interfaces editeur

  get gameCards(): Observable<GameCard[]> {
    return this._gameCards ? this.gameCards$.asObservable() : this.listCards().pipe(
      switchMap(() => this.gameCards$.asObservable()));
  }

  async createCard(owners: Member[], qty?: number): Promise<GameCard> {
    const card_input: PlayBook_input = {
      licenses: owners.map((member) => member.license_number),
      initial_qty: qty ?? MAX_STAMPS,
      stamps: []
    };
    try {
      const createdPlayBook = await this.dbHandler.createPlayBook(card_input);
      const new_card: GameCard = {
        id: createdPlayBook.id,
        owners: owners,
        initial_qty: createdPlayBook.initial_qty,
        stamps: createdPlayBook.stamps.filter((stamp): stamp is string => stamp !== null),
        licenses: createdPlayBook.licenses,
        createdAt: createdPlayBook.createdAt,
      };
      if (this._gameCards) {   // cache update if exists
        this._gameCards.push(new_card);
        this.gameCards$.next(this._gameCards);
        let ownersNames = new_card.owners.map(owner => `${owner.firstname} ${owner.lastname}`).join(', ');

        this.toastService.showSuccess('Gestion des cartes', 'Carte de ' + ownersNames + ' créée');
      }
      return new_card;
    } catch (errors) {
      if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
        if ((errors[0] as any).errorType === 'Unauthorized') {
          this.toastService.showErrorToast('Gestion des cartes', 'Vous n\'êtes pas autorisé à créer une carte de tournoi');
          return Promise.reject('Unauthorized');
        }
      }

      this.toastService.showErrorToast('Gestion des cartes', 'Une erreur est survenue lors de la création de la carte de tournoi');
      return Promise.reject('Error creating game card');
    }
  }

  async updateCard(card: GameCard): Promise<GameCard> {
    try {
      const { owners, ...playBook } = card; // Destructure to remove owners
      const updatedBook = await this.dbHandler.updatePlayBook(playBook);
      const updatedGameCard: GameCard = {
        id: updatedBook.id,
        licenses: updatedBook.licenses.filter((license): license is string => license !== null),
        stamps: updatedBook.stamps.filter((stamp): stamp is string => stamp !== null),
        owners: card.owners,
        initial_qty: updatedBook.initial_qty,
        createdAt: updatedBook.createdAt,
      };
      this._gameCards = this._gameCards.filter(c => c.id !== card.id);
      this._gameCards.push(updatedGameCard);
      this._gameCards.sort((a, b) => a.owners[0].lastname.localeCompare(b.owners[0].lastname));

      this.gameCards$.next(this._gameCards);
      let ownersNames = updatedGameCard.owners.map(owner => `${owner.firstname} ${owner.lastname}`).join(', ');
      this.toastService.showSuccess('Gestion des cartes', 'Carte de ' + ownersNames + ' mise à jour');
      return updatedGameCard;

    } catch (errors) {
      if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
        if ((errors[0] as any).errorType === 'Unauthorized') {
          this.toastService.showErrorToast('Gestion des cartes', 'Vous n\'êtes pas autorisé à modifier une carte de tournoi');
          return Promise.reject('Unauthorized');
        }
      }
      this.toastService.showErrorToast('Gestion des cartes', 'Une erreur est survenue lors de la modification de la carte de tournoi');
      return Promise.reject('Error updating game card');
    }
  }

  async deleteCard(card: GameCard): Promise<boolean> {
    try {
      const done = await this.dbHandler.deletePlayBook(card);
      if (done) {
        this._gameCards = this._gameCards.filter(c => c.id !== card.id);
        this.gameCards$.next(this._gameCards);
        let ownersNames = card.owners.map(owner => `${owner.firstname} ${owner.lastname}`).join(', ');

        this.toastService.showSuccess('Gestion des cartes', 'La carte de ' + ownersNames + ' a été supprimée');
        this.toastService.showInfo('Gestion des cartes', 'Supprimez la recette associée si nécessaire');
        return true;
      }
      return false;
    } catch (error) {
      this.toastService.showErrorToast('Gestion des cartes', 'La suppression de la carte de tournoi a échoué');
      console.error('Error deleting game card:', error);
      throw error;
    }
  }

  async deleteNullCards(): Promise<void> {
    const delNullPromises: Promise<boolean>[] = this._gameCards.filter(card => card.stamps.length === card.initial_qty).map(async (card) => {
      return this.deleteCard(card);
    });
    if (delNullPromises.length === 0) {
      this.toastService.showInfo('Gestion des cartes', 'Aucune carte vide à supprimer');
      return;
    }
    await Promise.all(delNullPromises);
  }

  // use of query Observable  !!! //
  private listCards(): Observable<GameCard[]> {
    return this.membersService.listMembers().pipe(
      switchMap((members) => {
        this.members = members;
        return this.dbHandler.queryPlayBooks().pipe(
          map((cards) => {
            this._gameCards = cards.map(card => {
              const owners = card.licenses
                .filter((license): license is string => license !== null)
                .map((license) => this.members.find(member => member.license_number === license))
                .filter((owner): owner is Member => owner !== undefined);

              if (owners.length === 0) {
                this.toastService.showWarning('Gestion des cartes', `Carte sans adhérent répertorié ${card.licenses}.`);
                let unknownMember = {} as Member;
                unknownMember.lastname = '@_ORPHELINE';
                unknownMember.firstname = card.licenses.join(',');
                owners.push(unknownMember);
              }
              return {
                id: card.id,
                owners: owners,
                initial_qty: card.initial_qty,
                stamps: (card.stamps ?? []).filter((stamp): stamp is string => stamp !== null),
                licenses: card.licenses.filter((license): license is string => license !== null),
                createdAt: card.createdAt,
                updatedAt: card.updatedAt
              };
            });

            this._gameCards.sort((a, b) => a.owners[0].lastname.localeCompare(b.owners[0].lastname));

            this.gameCards$.next(this._gameCards);
            return this._gameCards;
          })
        );
      })
    );
  }
}
