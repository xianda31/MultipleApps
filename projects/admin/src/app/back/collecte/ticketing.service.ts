import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../../../amplify/data/resource';

export type TicketingReservation = Schema['TicketingReservation']['type'];
export type TicketingPayment = Schema['TicketingPayment']['type'];

export type TicketingPaymentMode = 'cash' | 'cheque' | 'card' | 'other';
export type TicketingPaymentStatus = 'active' | 'cancelled';
export type TicketingReservationStatus = 'reserved' | 'sold' | 'cancelled';

export interface ReservationImportRow {
  memberName: string;
  isMember: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class TicketingService {
  private get models() {
    return (generateClient<Schema>() as any).models;
  }

  async listReservations(date: string, eventTitle: string): Promise<TicketingReservation[]> {
    const { data } = await this.models.TicketingReservation.list({ limit: 3000 });
    return (data ?? []).filter(
      (entry: TicketingReservation | null) =>
        !!entry && entry.date === date && this.normalizeEventTitle(entry.eventTitle) === this.normalizeEventTitle(eventTitle),
    ) as TicketingReservation[];
  }

  async listReservationsForDate(date: string): Promise<TicketingReservation[]> {
    const { data } = await this.models.TicketingReservation.list({ limit: 3000 });
    return (data ?? []).filter(
      (entry: TicketingReservation | null) => !!entry && entry.date === date,
    ) as TicketingReservation[];
  }

  async listPayments(date: string, eventTitle: string): Promise<TicketingPayment[]> {
    const { data } = await this.models.TicketingPayment.list({ limit: 3000 });
    return (data ?? []).filter(
      (entry: TicketingPayment | null) =>
        !!entry && entry.date === date && this.normalizeEventTitle(entry.eventTitle) === this.normalizeEventTitle(eventTitle),
    ) as TicketingPayment[];
  }

  async listPaymentsForDate(date: string): Promise<TicketingPayment[]> {
    const { data } = await this.models.TicketingPayment.list({ limit: 3000 });
    return (data ?? []).filter(
      (entry: TicketingPayment | null) => !!entry && entry.date === date,
    ) as TicketingPayment[];
  }

  async importReservations(
    rows: ReservationImportRow[],
    ctx: { date: string; season: string; eventTitle: string; source?: string },
  ): Promise<{ created: number; updated: number }> {
    const existing = await this.listReservations(ctx.date, ctx.eventTitle);
    const byKey = new Map(existing.map((entry) => [entry.reservationKey, entry]));

    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const reservationKey = this.buildReservationKey(row.memberName);
      const previous = byKey.get(reservationKey);
      if (!previous) {
        await this.models.TicketingReservation.create({
          season: ctx.season,
          date: ctx.date,
          eventTitle: ctx.eventTitle.trim(),
          reservationKey,
          memberName: row.memberName.trim(),
          isMember: row.isMember,
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

    const reservations = await this.listReservations(payment.date, payment.eventTitle);
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
          paidAt,
        });
      }),
    );
  }

  async markAccounted(input: {
    reservationIds: string[];
    paymentIds: string[];
  }): Promise<void> {
    const accountedAt = new Date().toISOString();
    await Promise.all([
      ...input.reservationIds.map((id) => this.models.TicketingReservation.update({ id, accountedAt })),
      ...input.paymentIds.map((id) => this.models.TicketingPayment.update({ id, accountedAt })),
    ]);
  }

  buildReservationKey(memberName: string): string {
    return this.normalizeMemberName(memberName);
  }

  private normalizeMemberName(name: string): string {
    return (name ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeEventTitle(title: string): string {
    return (title ?? '').trim().toLowerCase();
  }
}
