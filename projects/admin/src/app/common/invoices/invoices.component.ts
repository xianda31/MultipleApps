import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';


import { Component, Input, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FileService, S3_ROOT_FOLDERS } from '../services/files.service';
import { CommonModule } from '@angular/common';
import { SafeUrlPipe } from '../pipes/safe-url.pipe';
import { SystemDataService } from '../services/system-data.service';
import { Invoice } from '../interfaces/invoice.interface';
import { InvoiceService } from '../services/invoice.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-invoices',
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.scss'],
  imports: [CommonModule, ReactiveFormsModule, FormsModule]
})
export class InvoicesComponent {
  hoveredInvoice?: Invoice;
  pdfPopupUrl?: SafeResourceUrl;
  season: string = '';
  invoices: (Invoice & { url?: string })[] = [];
  uploading = false;
  invoiceForm: FormGroup;
  pdfPreviewUrl?: string;
  
  @ViewChild('pdfMiniatureCanvas', { static: false }) pdfMiniatureCanvas?: ElementRef<HTMLCanvasElement>;
  pdfMiniatureError = false;

  constructor(
    private systemService: SystemDataService,
    private invoiceService: InvoiceService,
    private fb: FormBuilder,
    private fileService: FileService,
    private cdr: ChangeDetectorRef  ) {
    this.invoiceForm = this.fb.group({
      title: ['', Validators.required],
      amount: ['', [Validators.required, Validators.pattern(/^[\d]+(\.[\d]{1,2})?$/)]],
      author: [''],
      filename: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.season = this.systemService.get_today_season();
    this.invoiceService.listInvoices().subscribe(invoices => {
      const filtered = invoices.filter(inv => inv.season === this.season);
      this.invoices = filtered;
      console.log('Invoices for season', this.season, this.invoices);
    });
  }
    ngAfterViewInit() {
    const offcanvas = document.getElementById('offcanvasCreateInvoice');
    if (offcanvas) {
      offcanvas.addEventListener('hidden.bs.offcanvas', () => {
        this.invoiceForm.reset();
        this.pdfPreviewUrl = undefined;
        this.cdr.detectChanges();
      });
    }
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
      // Générer un hash court (6 caractères hex) à partir du contenu du fichier
      const hash = await this.computeShortHash(file);
      const base = file.name.replace(/\.[^/.]+$/, '');
      const newFileName = `${base} (${hash}).${ext}`;
      const renamedFile = new File([file], newFileName, { type: file.type });
      this.pdfPreviewUrl = await this.fileService.upload_file(renamedFile, s3Path, preventOverwrite);

      this.invoiceForm.patchValue({ filename: newFileName });
      this.invoiceForm.get('filename')?.markAsDirty();
      this.invoiceForm.get('filename')?.updateValueAndValidity();
      this.cdr.detectChanges();
      console.log('patchValue path:', s3Path + newFileName, 'form:', this.invoiceForm.value, 'valid:', this.invoiceForm.valid);


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

  onCreateInvoice() {
    console.log('onCreateInvoice submit', this.invoiceForm.value, 'valid:', this.invoiceForm.valid);
    if (this.invoiceForm.valid) {
      const invoiceData = {
        ...this.invoiceForm.value,
        season: this.season
      };
      this.invoiceService.createInvoice(invoiceData)
        .then(() => {
          this.invoiceForm.reset();
          const offcanvas = document.getElementById('offcanvasCreateInvoice');
          if (offcanvas) {
            // @ts-ignore
            const bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(offcanvas);
            bsOffcanvas.hide();
          }
        })
        .catch((err) => {
          alert('Erreur lors de la création de la facture');
          console.error(err);
        });
    } else {
      this.invoiceForm.markAllAsTouched();
    }
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
  openInvoicePdf(invoice: Invoice) {
    if (invoice.filename) {
      const seasonFolder = this.season.replace('/', '_');
      const s3Path = `${S3_ROOT_FOLDERS.INVOICES}/${seasonFolder}/` + invoice.filename;
      this.getInvoiceUrl(s3Path).subscribe(url => {
        window.open(url, '_blank');
      });
    }
  }

  openPreviewPdf() {
    if (this.pdfPreviewUrl) {
      window.open(this.pdfPreviewUrl, '_blank');
    }
  }
  getInvoiceUrl(path: string): Observable<string> {
    return this.fileService.getPresignedUrl$(path);
  }

    // Génère un hash court (6 caractères hex) à partir du contenu du fichier
  async computeShortHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.slice(0, 3).map(b => b.toString(16).padStart(2, '0')).join('');
  }


  async showPdfPreview(invoice: Invoice) {
    this.hoveredInvoice = invoice;
    this.pdfMiniatureError = false;
    setTimeout(async () => {
      if (!this.pdfMiniatureCanvas) return;
      const canvas = this.pdfMiniatureCanvas.nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (invoice.filename) {
        const seasonFolder = this.season.replace('/', '_');
        const s3Path = `${S3_ROOT_FOLDERS.INVOICES}/${seasonFolder}/` + invoice.filename;
        this.getInvoiceUrl(s3Path).subscribe(async url => {
          try {
            // Chargement PDF.js
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
            this.pdfMiniatureError = true;
          }
        });
      }
    }, 10);
  }


  hidePdfPreview() {
    this.hoveredInvoice = undefined;
    this.pdfMiniatureError = false;
    if (this.pdfMiniatureCanvas) {
      const ctx = this.pdfMiniatureCanvas.nativeElement.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, this.pdfMiniatureCanvas.nativeElement.width, this.pdfMiniatureCanvas.nativeElement.height);
    }
    this.cdr.detectChanges();
  }

}
