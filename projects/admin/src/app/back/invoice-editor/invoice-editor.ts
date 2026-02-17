import { Component, Output, EventEmitter, Input, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { S3_ROOT_FOLDERS, FileService } from '../../common/services/files.service';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import * as pdfjsLib from 'pdfjs-dist';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { Member } from '../../common/interfaces/member.interface';
import { Accreditation, Group_priorities } from '../../common/authentification/group.interface';
import { GroupService } from '../../common/authentification/group.service';
import { Invoice, invoicePaymentMethods } from '../../common/interfaces/invoice.interface';
import { Revenue_and_expense_definition } from '../../common/interfaces/system-conf.interface';
import { BookService } from '../services/book.service';

@Component({
  selector: 'app-invoice-editor',
  templateUrl: './invoice-editor.html',
  styleUrls: ['./invoice-editor.scss'],
  imports: [CommonModule, ReactiveFormsModule, FormsModule]

})
export class InvoiceEditor {
  @ViewChild('pdfMiniatureCanvas') pdfMiniatureCanvas!: ElementRef<HTMLCanvasElement>;
  @Input() expenses: Revenue_and_expense_definition[] = [];
  @Input() season: string = '';
  @Input() invoice: Invoice | null = null;
  @Output() invoiceCreated = new EventEmitter<any>();
  @Output() invoiceUpdated = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  editor_in_creation_mode: boolean = true;
  accreditation_levels = Group_priorities;
  user_accreditation: Accreditation | null = null;
  invoiceForm: FormGroup;
  uploading = false;
  pdfPreviewUrl?: string;
  invoicePaymentMethods = invoicePaymentMethods;

  constructor(
    private fb: FormBuilder,
    private authService: AuthentificationService,
    private groupService: GroupService,
    private fileService: FileService,
    private bookService: BookService,
    private cdr: ChangeDetectorRef) {
    this.invoiceForm = this.fb.group({
      id: [''],
      season: [{ value: '', disabled: true }],
      date: [this.getTodayDate(), Validators.required],
      description: ['', Validators.required],
      amount: ['', [Validators.required, Validators.pattern(/^[\d]+(\.[\d]{1,2})?$/)]],
      account: ['', Validators.required],
      filename: ['', Validators.required],
      payee: ['', Validators.required],
      transaction_id: ['', Validators.required],
      book_entry_id: [{ value: '', disabled: true }],
      // deposit_date: [this.getTodayDate()]
    });
  }

  ngOnInit() {
    this.authService.logged_member$.subscribe(async member => {
      if (member) {
        this.user_accreditation = await this.groupService.getUserAccreditation();
      }
    });
    if (this.invoice) {
      this.editor_in_creation_mode = false;
      this.invoiceForm.patchValue(this.invoice);
      // Show PDF preview for existing invoice
      setTimeout(() => {
        if (this.invoice && this.invoice.filename) {
          this.showPdfPreview(this.invoice.filename);
        }
      }, 100);
    } else {
      this.editor_in_creation_mode = true;
    }
  }

  // ngOnChanges() {
  //   this.rebuildAmountsGroup();
  // }

  private getTodayDate(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }


  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (file.type !== 'application/pdf') {
      alert('Veuillez sélectionner un fichier PDF.');
      return;
    }
    this.uploading = true;
    try {
      const seasonFolder = this.season.replace('/', '_');
      const s3Path = `${S3_ROOT_FOLDERS.INVOICES}/${seasonFolder}/`;
      const preventOverwrite = true;
      const ext = file.name.split('.').pop();
      const hash = await this.computeShortHash(file);
      const base = file.name.replace(/\.[^/.]+$/, '');
      const newFileName = `${base} (${hash}).${ext}`;
      const renamedFile = new File([file], newFileName, { type: file.type });
      this.pdfPreviewUrl = await this.fileService.upload_file(renamedFile, s3Path, preventOverwrite);
      this.invoiceForm.patchValue({ filename: newFileName });
      this.invoiceForm.get('filename')?.markAsDirty();
      this.invoiceForm.get('filename')?.updateValueAndValidity();
      this.cdr.detectChanges();
      // Show PDF preview after upload
      setTimeout(() => {
        if (this.invoiceForm.get('filename')?.value) {
          this.showPdfPreview(this.invoiceForm.get('filename')?.value);
        }
      }, 100);
    } catch (err: any) {
      if (err && (err.name === 'PreconditionFailed' || err.statusCode === 412 || (err.message && err.message.includes('PreconditionFailed')))) {
        alert('Ce fichier PDF (même contenu, même nom) existe déjà. Veuillez renommer votre fichier ou en choisir un autre.');
      } else {
        alert('Erreur lors de l\'upload du PDF');
      }
      console.error(err);
    } finally {
      this.uploading = false;
    }
  }


  openInvoicePdf(filename: string) {
    if (filename) {
      const seasonFolder = this.season.replace('/', '_');
      const s3Path = `${S3_ROOT_FOLDERS.INVOICES}/${seasonFolder}/` + filename;
      this.getInvoiceUrl(s3Path).subscribe((url: string) => {
        window.open(url, '_blank');
      });
    }
  }

  getInvoiceUrl(path: string): Observable<string> {
    return this.fileService.getPresignedUrl$(path);
  }

  async showPdfPreview(filename: string) {
    setTimeout(async () => {
      const canvas = this.pdfMiniatureCanvas.nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (filename) {
        const seasonFolder = this.season.replace('/', '_');
        const s3Path = `${S3_ROOT_FOLDERS.INVOICES}/${seasonFolder}/` + filename;
        this.getInvoiceUrl(s3Path).subscribe(async url => {
          try {
            (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const scale = 0.6;
            const viewport = page.getViewport({ scale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport }).promise;
          } catch (e) {
            // this.pdfMiniatureError = true;
          }
        });
      }
    }, 10);
  }

  openPreviewPdf() {
    if (this.pdfPreviewUrl) {
      window.open(this.pdfPreviewUrl, '_blank');
    }
  }

  async computeShortHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.slice(0, 3).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async returnInvoice(validation: boolean = false) {
    if (this.invoiceForm.valid) {
      // Only send allowed fields for update
      const raw = this.invoiceForm.getRawValue();
      const invoice: Invoice = {
        id: raw.id,
        season: this.season,
        date: raw.date,
        description: raw.description,
        amount: raw.amount,
        account: raw.account,
        filename: raw.filename,
        payee: raw.payee,
        transaction_id: raw.transaction_id,
        book_entry_id: raw.book_entry_id,
      };

      if (validation) {
        try {
          const book_entry = await this.bookService.create_entry_from_invoice(invoice);
          invoice.book_entry_id = book_entry.id;
        } catch (err) {
          alert('Erreur lors de la création de l\'écriture comptable à partir de la facture.');
        };
      }

      this.editor_in_creation_mode ? this.invoiceCreated.emit(invoice) : this.invoiceUpdated.emit(invoice);
      this.invoiceForm.markAllAsTouched();
    }
  }

  cancelEditor() {
    this.cancel.emit();
  }



}
