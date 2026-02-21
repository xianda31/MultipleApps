import { Component, Input, Output } from '@angular/core';
import { FileService, S3_ROOT_FOLDERS } from '../../../../common/services/files.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { EventEmitter } from '@angular/core';
import { ToastService } from '../../../../common/services/toast.service';

@Component({
  selector: 'app-invoice-select',
  imports: [CommonModule, FormsModule],
  templateUrl: './invoice-select.html',
  styleUrl: './invoice-select.scss'
})
export class InvoiceSelectComponent {
  // @Input() directory: string = '';
  // @Input() bookEntry: BookEntry | null = null;
  @Input() directory: string = '';
  @Output() invoiceSelected = new EventEmitter< string>();
  selectedFile: File | null = null;
  uploadError: string | null = null;
  uploadSuccess: boolean = false;

  constructor(
    private fileService: FileService,
    private activeModal: NgbActiveModal,
    private toastService: ToastService,
  ) {}

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      this.uploadError = null;
    } else {
      this.selectedFile = null;
      this.uploadError = 'Veuillez sélectionner un fichier PDF.';
    }
    this.uploadSuccess = false;
  }

  
  
  async uploadInvoice() {
    this.uploadError = null;
    this.uploadSuccess = false;
    if (!this.selectedFile ) return;
    try {
      const hash = await this.computeHash(this.selectedFile);
      const originalName = this.selectedFile.name;
      const dotIndex = originalName.lastIndexOf('.pdf');
      let filename: string;
      if (dotIndex !== -1) {
        filename = originalName.slice(0, dotIndex) + '_' + hash + '.pdf';
      } else {
        filename = originalName + '_' + hash;
      }
      const directory = S3_ROOT_FOLDERS.INVOICES + '/' + this.directory.replace(/\//g, '_') +'/';
      // Check existence
      const files$ = this.fileService.list_files(directory);
      const files = await files$.toPromise();
      if (files && files.some((f: any) => f.path.endsWith(filename))) {
        this.uploadError = 'Un fichier avec ce titre et contenu existe déjà.';
        return;
      }
      // Upload
      const fileToUpload = new File([this.selectedFile], filename, { type: 'application/pdf' });
      await this.fileService.upload_file(fileToUpload, directory);
      this.uploadSuccess = true;
      this.toastService.showSuccess('Chargement facture', filename + ' a été chargé avec succès.');
      this.invoiceSelected.emit(fileToUpload.name);
      this.activeModal.close(null);
    } catch (err) {
      this.uploadError = 'Erreur lors de l\'upload: ' + err;
    }
  }
  
  close() {
    this.activeModal.close(null);
  }

  private async computeHash(file: File): Promise<string> {
   const buffer = await file.arrayBuffer();
   const content = new Uint8Array(buffer);
   const encoder = new TextEncoder();
   const nameBytes = encoder.encode(file.name);
   const combined = new Uint8Array(nameBytes.length + content.length);
   combined.set(nameBytes, 0);
   combined.set(content, nameBytes.length);
   const hashBuffer = await window.crypto.subtle.digest('SHA-256', combined);
   return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 6);
 }
  
}
