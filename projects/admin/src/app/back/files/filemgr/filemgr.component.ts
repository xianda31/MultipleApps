import { Component, Input, signal, WritableSignal } from '@angular/core';
import { FileService } from '../../../common/services/files.service';
import { S3Item } from '../../../common/interfaces/file.interface';
import { CommonModule } from '@angular/common';
import { catchError, from, map, Observable, of, tap } from 'rxjs';
import { ToastService } from '../../../common/services/toast.service';
import { ActivatedRoute } from '@angular/router';
import { threedigitsPipe } from '../../../common/pipes/three_digits.pipe';
import { ImageService } from '../../../common/services/image.service';

@Component({
  selector: 'app-filemgr',
  imports: [CommonModule],
  templateUrl: './filemgr.component.html',
  styleUrl: './filemgr.component.scss'
})
export class FilemgrComponent {
  @Input() type: 'documents' | 'photos' | 'vignettes' = 'documents';

  directory = '';

  files$: WritableSignal<S3Item[]> = signal<S3Item[]>([]);

  constructor(
    private fileService: FileService,
    private toastService: ToastService,
    private imageService: ImageService,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {

    this.directory = this.type === 'documents' ? 'documents/' : this.type === 'photos' ? 'images/photos/' : 'images/vignettes/';

    this.fileService.list_files(this.directory).subscribe({
      next: (files) => {
         files.forEach(file => (file.url = this.presigned_url(file.path)));
        this.files$.set(files);
      },
      error: (error) => {
        this.toastService.showErrorToast('Erreur', `Impossible d\'accceder au répertoire '${this.directory}' des fichiers`);
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
      this.fileService.upload_file(file, this.directory).then(() => {
        this.files$.update(files => [...files, { path: this.directory + file.name , url: this.presigned_url(this.directory + file.name) }]);
        this.toastService.showSuccess('Upload', 'Fichier téléchargé avec succès');
      }).catch((error) => {
        this.toastService.showErrorToast('Upload', 'Échec du téléchargement du fichier');
      });
    }
  }

  presigned_url(image_path: string): Observable<string> {
    return (this.fileService.getPresignedUrl(image_path)).pipe(
      map((url: string) => {
        return url;
      }),
      catchError(err => {
        console.error('Error fetching presigned URL:', err);
        return of('bcsto_ffb.jpg');
      })
    );
  }

  image_process(file: S3Item) {
      this.fileService.download_file(file.path).then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          this.imageService.resizeImage(base64).then((resizedBase64) => {
            // console.log('Image resized:', resizedBase64);
            this.imageService.getBase64Dimensions(resizedBase64).then((dimensions) => {
              const wh = dimensions.width.toString() +'x' + dimensions.height.toString();
              let new_blob = this.imageService.base64ToBlob(resizedBase64);

              let resized_file = new File([new_blob], this.add_wh(this.get_filename(file.path), wh), { type: new_blob.type });
              this.fileService.upload_file(resized_file, this.directory).then(() => {
                this.files$.update(files => [...files, { path: this.directory + resized_file.name , url: this.presigned_url(this.directory + resized_file.name) }]);

              });
            });
          });
        };
        reader.readAsDataURL(blob);
      });
  }

  get_filename(path: string): string {
    const parts = path.split('/');
    return parts.pop() || '';
  }

  add_wh(path:string, wh:string): string {
    const newFilename = path.replace('.', `_${wh}.`);
    return newFilename;
  }
   
}
