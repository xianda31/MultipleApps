import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, switchMap, tap, shareReplay } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { DBhandler } from './graphQL.service';
import { Invoice, Invoice_input } from '../interfaces/invoice.interface';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private _invoices: Invoice[] = [];
  private _invoices$ = new BehaviorSubject<Invoice[]>([]);
  private _invoicesLoading$?: Observable<Invoice[]>;

  constructor(
    private toastService: ToastService,
    private dbHandler: DBhandler
  ) {}

  // Create
  async createInvoice(invoice: Invoice_input): Promise<Invoice> {
    try {
      const { id, ...invoiceWithoutId } = invoice as any;
      const createdInvoice = await this.dbHandler.createInvoice(invoiceWithoutId);
      // Ajoute la facture au cache local et notifie
      this._invoices = [createdInvoice, ...this._invoices];
      this._invoices$.next(this._invoices);
      return createdInvoice;
    } catch (error) {
      this.toastService.showErrorToast('Factures', 'Erreur lors de la création');
      return Promise.reject(error);
    }
  }

  // List
  listInvoices(): Observable<Invoice[]> {
    const remote_load$ = this.dbHandler.listInvoices().pipe(
      tap((invoices: Invoice[]) => {
        this._invoices = invoices;
        this._invoices$.next(invoices);
      }),
      switchMap(() => this._invoices$.asObservable())
    );
    return this._invoices && this._invoices.length > 0 ? this._invoices$.asObservable() : remote_load$;
  }

  // Get one
  getInvoice(invoiceId: string): Invoice | undefined {
    return this._invoices.find(invoice => invoice.id === invoiceId);
  }

  // Update
  async updateInvoice(invoice: Invoice): Promise<Invoice> {
    try {
      const updatedInvoice = await this.dbHandler.updateInvoice(invoice);
      this._invoices = this._invoices.map(i => i.id === updatedInvoice.id ? updatedInvoice : i);
      this._invoices$.next(this._invoices);
      return updatedInvoice;
    } catch (error) {
      this.toastService.showErrorToast('Factures', 'Erreur lors de la modification');
      return Promise.reject(error);
    }
  }

  // Delete
  async deleteInvoice(invoice: Invoice): Promise<boolean> {
    try {
      await this.dbHandler.deleteInvoice(invoice.id);
      this._invoices = this._invoices.filter(i => i.id !== invoice.id);
      this._invoices$.next(this._invoices);
      return true;
    } catch (error) {
      this.toastService.showErrorToast('Factures', 'Erreur lors de la suppression');
      return Promise.reject(error);
    }
  }
}
