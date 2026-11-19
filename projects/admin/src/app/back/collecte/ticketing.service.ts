import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../../../amplify/data/resource';

export type TicketingReservation = Schema['TicketingReservation']['type'];
export type TicketingPayment = Schema['TicketingPayment']['type'];

export type TicketingPaymentMode = 'cash' | 'cheque' | 'card' | 'other';
export type TicketingPaymentStatus = 'active' | 'cancelled';
export type TicketingReservationStatus = 'reserved' | 'sold' | 'cancelled';

export interface ReservationImportRow {
  memberId?: string;
  memberName: string;
  isMember: boolean;
  expectedProductId?: string;
}

/** Événement de billetterie : identifié par son produit dédié (ex. « Repas de Noël 2026 »). */
export interface TicketingEventContext {
  productId: string;
  eventTitle: string;
  date: string;
  season: string;
  source?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TicketingService {
  private get models() {
    return (generateClient<Schema>() as any).models;
  }

  /** Toutes les réservations de l'événement, quelle que soit la date d'import ou de paiement. */
  async listEventReservations(productId: string): Promise<TicketingReservation[]> {
    const { data } = await this.models.TicketingReservation.list({ limit: 3000 });
    return (data ?? []).filter(
      (entry: TicketingReservation | null) => !!entry && entry.expectedProductId === productId,
    ) as TicketingReservation[];
  }

  /** Paiements saisis en billetterie pour l'événement. */
  async listEventPayments(productId: string): Promise<TicketingPayment[]> {
    const { data } = await this.models.TicketingPayment.list({ limit: 3000 });
    return (data ?? []).filter(
      (entry: TicketingPayment | null) => !!entry && entry.productId === productId,
    ) as TicketingPayment[];
  }

  async importReservations(
    rows: ReservationImportRow[],
    ctx: TicketingEventContext,
  ): Promise<{ created: number; updated: number }> {
    const existing = await this.listEventReservations(ctx.productId);
    const byKey = new Map(existing.map((entry) => [entry.reservationKey, entry]));

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const reservationKey = this.buildReservationKey(row.memberName, row.memberId);
      const previous = byKey.get(reservationKey);
      if (!previous) {
        await this.models.TicketingReservation.create({
          season: ctx.season,
          date: ctx.date,
          eventTitle: ctx.eventTitle.trim(),
          reservationKey,
          memberId: row.memberId,
          memberName: row.memberName.trim(),
          isMember: row.isMember,
          expectedProductId: ctx.productId,
          reservationStatus: 'reserved',
          source: ctx.source ?? 'csv',
        });
        created += 1;
        continue;
      }

      if (previous.reservationStatus === 'sold') {
        continue;
      }

      await this.models.TicketingReservation.update({
        id: previous.id,
        memberId: row.memberId,
        memberName: row.memberName.trim(),
        isMember: row.isMember,
        source: ctx.source ?? previous.source ?? 'csv',
      });
      updated += 1;
    }

    return { created, updated };
  }

  async createPayment(input: {
    season: string;
    date: string;
    eventTitle: string;
    productId: string;
    paymentMode: TicketingPaymentMode;
    totalAmount: number;
    reservationCount: number;
  }): Promise<TicketingPayment> {
    const { data } = await this.models.TicketingPayment.create({ ...input, status: 'active' });
    return data as TicketingPayment;
  }

  async cancelPayment(payment: TicketingPayment): Promise<void> {
    if (payment.accountedAt) {
      throw new Error('Paiement déjà comptabilisé : annulation interdite.');
    }
    if (payment.status === 'cancelled') {
      return;
    }

    const reservations = payment.productId ? await this.listEventReservations(payment.productId) : [];
    const linkedReservations = reservations.filter((reservation) => reservation.paymentId === payment.id);

    await Promise.all([
      ...linkedReservations.map((reservation) => this.models.TicketingReservation.update({
        id: reservation.id,
        reservationStatus: 'reserved',
        paymentId: null,
        paymentMode: null,
        paidAmount: null,
        paidAccount: null,
        paidProductId: null,
        paidChannel: null,
        paidAt: null,
        accountedAt: null,
      })),
      this.models.TicketingPayment.update({ id: payment.id, status: 'cancelled' }),
    ]);
  }

  async markReservationsSold(input: {
    reservationIds: string[];
    paymentId: string;
    paymentMode: TicketingPaymentMode;
    paidByReservationId: Record<string, { amount: number; account: string; productId: string }>;
  }): Promise<void> {
    const paidAt = new Date().toISOString();
    await Promise.all(
      input.reservationIds.map((id) => {
        const row = input.paidByReservationId[id];
        return this.models.TicketingReservation.update({
          id,
          reservationStatus: 'sold',
          paymentId: input.paymentId,
          paymentMode: input.paymentMode,
          paidAmount: row.amount,
          paidAccount: row.account,
          paidProductId: row.productId,
          paidChannel: 'billetterie',
          paidAt,
        });
      }),
    );
  }

  async markAccounted(input: {
    reservationIds: string[];
    paymentIds: string[];
    bookEntryIdByReservationId?: Record<string, string>;
  }): Promise<void> {
    const accountedAt = new Date().toISOString();
    await Promise.all([
      ...input.reservationIds.map((id) => this.models.TicketingReservation.update({
        id, accountedAt, ...(input.bookEntryIdByReservationId?.[id] ? { bookEntryId: input.bookEntryIdByReservationId[id] } : {}),
      })),
      ...input.paymentIds.map((id) => this.models.TicketingPayment.update({ id, accountedAt })),
    ]);
  }

  /** Réservations réglées par une écriture comptable (vente caisse/en ligne, ou encaissements billetterie comptabilisés). */
  async listReservationsOfBookEntry(bookEntryId: string): Promise<TicketingReservation[]> {
    const { data } = await this.models.TicketingReservation.list({ limit: 3000 });
    return (data ?? []).filter((entry: TicketingReservation | null) =>
      !!entry && entry.bookEntryId === bookEntryId && entry.reservationStatus === 'sold') as TicketingReservation[];
  }

  /**
   * L'écriture qui avait réglé ces réservations est supprimée ou intégralement remboursée :
   * elles redeviennent « réservées » (à payer) et les encaissements billetterie correspondants sont annulés.
   * Retourne les noms des personnes concernées.
   */
  async releaseReservationsOfBookEntry(bookEntryId: string): Promise<string[]> {
    const reservations = await this.listReservationsOfBookEntry(bookEntryId);
    const paymentIds = [...new Set(reservations.map((reservation) => reservation.paymentId).filter((id): id is string => !!id))];
    await Promise.all([
      ...reservations.map((reservation) => this.models.TicketingReservation.update({
        id: reservation.id,
        reservationStatus: 'reserved',
        paymentId: null,
        paymentMode: null,
        paidAmount: null,
        paidAccount: null,
        paidProductId: null,
        paidChannel: null,
        paidAt: null,
        accountedAt: null,
        bookEntryId: null,
      })),
      ...paymentIds.map((id) => this.models.TicketingPayment.update({ id, status: 'cancelled' })),
    ]);
    return reservations.map((reservation) => reservation.memberName);
  }

  buildReservationKey(memberName: string, memberId?: string): string {
    return memberId ? `member:${memberId}` : this.normalizeMemberName(memberName);
  }

  private normalizeMemberName(name: string): string {
    return (name ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
