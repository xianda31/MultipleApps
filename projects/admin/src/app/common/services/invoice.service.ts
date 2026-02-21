import { Injectable } from '@angular/core';
import { FileService , S3_ROOT_FOLDERS} from './files.service';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  
    constructor(
      private fileService: FileService,
    ) {}


    delete_invoice(invoice_ref: string, season: string): Promise<void> {
      const seasonDir = season.replace(/\//g, '_');
      const filePath = S3_ROOT_FOLDERS.INVOICES + '/' + seasonDir + '/' + invoice_ref;
      return this.fileService.delete_file(filePath);
    }

    download_invoice(invoice_ref: string, season: string) {
      const seasonDir = season.replace(/\//g, '_');
      const filePath = S3_ROOT_FOLDERS.INVOICES + '/' + seasonDir + '/' + invoice_ref;
      this.fileService.getPresignedUrl$(filePath).subscribe((url) => {
        window.open(url, '_blank');
      });
    }
}
