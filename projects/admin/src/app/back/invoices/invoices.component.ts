import { SafeResourceUrl } from '@angular/platform-browser';


import { Component, ViewChild, ElementRef } from '@angular/core';
import { FileService, S3_ROOT_FOLDERS } from '../../common/services/files.service';
import { CommonModule } from '@angular/common';
import { SystemDataService } from '../../common/services/system-data.service';
import { Invoice, invoicePaymentMethods } from '../../common/interfaces/invoice.interface';
import { InvoiceService } from '../../common/services/invoice.service';
import { Observable } from 'rxjs';
import { Revenue_and_expense_definition } from '../../common/interfaces/system-conf.interface';
import { InvoiceEditor } from '../invoice-editor/invoice-editor';

@Component({
  selector: 'app-invoices',
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.scss'],
  imports: [CommonModule, InvoiceEditor]
})
export class InvoicesComponent {
  selectedInvoice: Invoice | null = null;
  hoveredInvoice?: Invoice;
  pdfPopupUrl?: SafeResourceUrl;
  season: string = '';
  invoices: (Invoice & { url?: string })[] = [];
  expenses: Revenue_and_expense_definition[] = [];
  invoicePaymentMethods = invoicePaymentMethods;

  uploading = false;
  pdfPreviewUrl?: string;

  @ViewChild('pdfMiniatureCanvas', { static: false }) pdfMiniatureCanvas?: ElementRef<HTMLCanvasElement>;
  pdfMiniatureError = false;
  showInvoiceEditor = false;


  constructor(
    private systemDataService: SystemDataService,
    private invoiceService: InvoiceService,
    private fileService: FileService,

  ) { }



  ngOnInit() {
    this.season = this.systemDataService.get_today_season();
    this.systemDataService.get_configuration().subscribe(config => {
      if (config) {
        this.expenses = config.revenue_and_expense_tree.expenses;
      }
    });
    this.invoiceService.listInvoices().subscribe(invoices => {
      const filtered = invoices.filter(inv => inv.season === this.season);
      this.invoices = filtered;
      console.log('Invoices for season', this.season, this.invoices);
    });
  }
  editInvoice(invoice: Invoice | null) {
    this.selectedInvoice = invoice;
    this.showInvoiceEditor = true;
  }

  get_payment_mode(invoice: Invoice): string {
    return this.invoicePaymentMethods[invoice.transaction_id] || invoice.transaction_id;
  }

  // CRUD actions 

  async onCreateInvoice(invoice: Invoice) {
    try {
      await this.invoiceService.createInvoice(invoice)
      this.closeInvoiceEditor();
    } catch (err) {
      alert('Erreur lors de la création de la facture');
      console.error(err);
    }
  }

  async onUpdateInvoice(updatedInvoice: Invoice) {
    try {
      await this.invoiceService.updateInvoice(updatedInvoice);
      this.closeInvoiceEditor();
    } catch (err) {
      alert('Erreur lors de la mise à jour de la facture');
      console.error(err);
    }
    // Update invoice in the list or reload
    this.selectedInvoice = null;
    this.showInvoiceEditor = false;
    // Optionally refresh invoice list
  }

  async onDeleteInvoice(invoice: Invoice) {
    if (!confirm('Supprimer cette facture et son PDF associé ?')) return;
    try {
      await this.invoiceService.deleteInvoice(invoice);
      if (invoice.filename) {
        const seasonFolder = this.season.replace('/', '_');
        const s3Path = `${S3_ROOT_FOLDERS.INVOICES}/${seasonFolder}/` + invoice.filename;
        await this.fileService.delete_file(s3Path);
      }
    } catch (err) {
      alert('Erreur lors de la suppression de la facture ou du fichier');
      console.error(err);
    }
  }




  getInvoiceUrl(path: string): Observable<string> {
    return this.fileService.getPresignedUrl$(path);
  }

  openInvoiceEditor() {
    this.showInvoiceEditor = true;
  }

  closeInvoiceEditor() {
    this.showInvoiceEditor = false;
  }



}
