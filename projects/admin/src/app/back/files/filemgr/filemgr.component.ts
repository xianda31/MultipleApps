import { Component, Input, signal, WritableSignal } from '@angular/core';
import { FileService } from '../../../common/services/files.service';
import { S3Item } from '../../../common/interfaces/file.interface';
import { CommonModule } from '@angular/common';
import { catchError, from, map, Observable, of, tap } from 'rxjs';
import { ToastService } from '../../../common/services/toast.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-filemgr',
  imports: [CommonModule],
  templateUrl: './filemgr.component.html',
  styleUrl: './filemgr.component.scss'
})
export class FilemgrComponent {
  @Input() type: 'documents' | 'image_vignettes' = 'documents';

  documents_path = 'documents/'
  image_vignettes_path = 'images/vignettes/'
  path = '';

  files$: WritableSignal<S3Item[]> = signal<S3Item[]>([]);

  constructor(
    private fileService: FileService,
    private toastService: ToastService,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {

    if (this.type !== 'documents' && this.type !== 'image_vignettes') {
      console.log('Invalid type provided:', this.type);
      return
    }
    this.path = this.type === 'documents' ? this.documents_path : this.image_vignettes_path;
    // console.log('FilemgrComponent initialized with type:', this.type, this.path);

    this.fileService.list_files(this.path).subscribe({
      next: (files) => {
        files.forEach(file => (file.url = this.presigned_url(file.path)));
        this.files$.set(files);
      },
      error: (error) => {
        this.toastService.showErrorToast('Erreur', `Impossible d\'accceder au répertoire '${this.path}' des fichiers`);
        console.error('Error listing files:', error);
      }
    });
  }

  delete_file(file: S3Item) {
    this.files$.update(files => files.filter(f => f.path !== file.path));
    this.fileService.delete_file(file.path);
  }

  upload_file(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.fileService.upload_file(file, this.path).then(() => {
        this.files$.update(files => [...files, { path: file.name , url: this.presigned_url(file.name) }]);
        this.toastService.showSuccess('Upload', 'Fichier téléchargé avec succès');
      }).catch((error) => {
        this.toastService.showErrorToast('Upload', 'Échec du téléchargement du fichier');
      });
    }
  }

  presigned_url(image_path: string): Observable<string> {
    return (this.fileService.getPresignedUrl(image_path)).pipe(
      catchError(err => {
        console.error('Error fetching presigned URL:', err);
        return of('bcsto_ffb.jpg');
      })
    );
  }
}
