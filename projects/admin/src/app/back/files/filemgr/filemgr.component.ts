import { Component, signal, WritableSignal } from '@angular/core';
import { FileService } from '../../../common/services/files.service';
import { S3Item } from '../../../common/interfaces/file.interface';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { ToastService } from '../../../common/services/toast.service';

@Component({
  selector: 'app-filemgr',
  imports: [CommonModule],
  templateUrl: './filemgr.component.html',
  styleUrl: './filemgr.component.scss'
})
export class FilemgrComponent {
documents_path = 'documents/'
files$: WritableSignal<S3Item[]> = signal<S3Item[]>([]);

constructor(
  private fileService: FileService,
  private toastService: ToastService
) { }

  ngOnInit() {

    this.fileService.list_files(this.documents_path).subscribe({
      next: (files) => {
        this.files$.set(files);
      },
      error: (error) => {
        console.error('Error listing files:', error);
      }
    });
  }

  delete_file(file: S3Item) {
    this.files$.update(files => files.filter(f => f.path !== file.path));
    this.fileService.delete_file(file.path);
  }

  upload_file(event:any) {
    const file = event.target.files[0];
    if (file) {
      this.fileService.upload_file(file, this.documents_path).then(() => {
        this.files$.update(files => [...files, { path: file.name }]);
        this.toastService.showSuccess('Upload', 'Fichier téléchargé avec succès');
      }).catch((error) => {
        this.toastService.showErrorToast('Upload', 'Échec du téléchargement du fichier');
      });
    }
  }
}
