import { Component } from '@angular/core';
import { of } from 'rxjs';
import { SystemDataService } from '../../../common/services/system-data.service';
import { BookService } from '../../services/book.service';
import { TransactionService } from '../../services/transaction.service';
import { BookEntry, TRANSACTION_ID } from '../../../common/interfaces/accounting.interface';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InvoiceSelectComponent } from './invoice-select/invoice-select';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';

@Component({
  templateUrl: './invoices.html',
  styleUrl: './invoices.scss',
  imports: [CommonModule],
})
export class InvoicesComponent {
  loaded: boolean = false;
  season: string = '';
  book_entries!: BookEntry[];
  missing_invoices_number: number = 0;
  truncature = '1.2-2';  // '1.0-0';// '1.2-2';  //
  isMobilePortrait: boolean = false;

  constructor(
    private bookService: BookService,
    private systemDataService: SystemDataService,
    private transactionService: TransactionService,
    private modalService: NgbModal,
    private fileService: FileService

  ) {
  }

  ngOnInit() {
    this.loaded = false;
    // this.checkMobilePortrait();
    this.systemDataService.get_configuration().subscribe(
      (conf) => { this.season = conf.season; }
    );


    this.bookService.list_book_entries()
      .subscribe(
        (book_entries) => {
          this.book_entries = book_entries.filter(
            (entry) => this.need_invoice(entry.transaction_id)
          );
          this.missing_invoices_number = this.book_entries.reduce((count, entry) => count + (entry.invoice_ref ? 0 : 1), 0);
          this.loaded = true;
        }),
      (err: any) => {
        console.error('Error loading book entries:', err);
        this.loaded = true; // still loaded, but no entries
        return of([]);
      }

  }
  need_invoice(transaction_id: TRANSACTION_ID): boolean {
    const transaction = this.transactionService.get_transaction(transaction_id);
    return transaction ? transaction.invoice_required : false;
  }

  sum_amounts(amounts: { [key: string]: number }): number {
    return Object.values(amounts).reduce((sum, value) => sum + value, 0);
  }

  openInvoiceSelectModal(directory: string = 'invoices_') {
    const modalRef = this.modalService.open(InvoiceSelectComponent, { size: 'lg' });
    modalRef.componentInstance.directory = directory.replace(/\//g, '_');
  }

  async add_invoice_ref(entry: BookEntry) {
    const ref = 'FAC' + entry.id.slice(0, 8).toUpperCase();
    // entry.invoice_ref = ref;
    const modalRef = this.modalService.open(InvoiceSelectComponent, { size: 'lg' });
    const seasonDir = this.season.replace(/\//g, '_');
    modalRef.componentInstance.directory = seasonDir;
    modalRef.componentInstance.invoiceSelected.subscribe(async (filename: string) => {
      try {
         modalRef.close();
        entry.invoice_ref = filename;
        const updated_entry = await this.bookService.update_book_entry(entry);
        console.log('Book entry updated with invoice ref:', updated_entry);
      } catch (err) {
        console.error('Error updating book entry with invoice ref:', err);
      }
    });
  }

  async remove_pdf(entry: BookEntry) {
    if (!entry.invoice_ref) return;
    const seasonDir = this.season.replace(/\//g, '_');
    const filePath = S3_ROOT_FOLDERS.INVOICES + '/' + seasonDir + '/' + entry.invoice_ref;
    try {
      await this.fileService.delete_file(filePath);
      entry.invoice_ref = '';
      await this.bookService.update_book_entry(entry);
    } catch (err) {
      console.error('Erreur lors de la suppression du PDF:', err);
    }
  }

  download_pdf(invoice_ref: string) {
    const seasonDir = this.season.replace(/\//g, '_');
    const filePath = S3_ROOT_FOLDERS.INVOICES + '/' + seasonDir + '/' + invoice_ref;
    this.fileService.getPresignedUrl$(filePath).subscribe(
      (url) => {
        window.open(url, '_blank');
      },
      (err) => {
        console.error('Error getting file URL:', err);
      }
    );
  }

}
