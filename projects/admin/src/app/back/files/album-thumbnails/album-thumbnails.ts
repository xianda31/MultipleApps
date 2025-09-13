import { Injectable } from '@angular/core';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { S3Item } from '../../../common/interfaces/file.interface';
import { S3 } from 'aws-cdk-lib/aws-ses-actions';
import { from, map, mergeMap, Observable, of } from 'rxjs';
import { ImageService } from '../../../common/services/image.service';
import { ToastService } from '../../../common/services/toast.service';

@Injectable({
  providedIn: 'root'
})
export class ThumbnailsService {

  albums_folder = S3_ROOT_FOLDERS.ALBUMS;
  S3items: S3Item[] = [];

  constructor(
    private fileService: FileService,
    private imageService: ImageService,
    private toastService: ToastService
  ) { }

  process() {
    // Logic to regenerate album thumbnails

    this.toastService.showInfo('Albums' ,'Regéneration des vignettes démarrée...');

    // clear album_thumbnails folder

    this.clear_thumbnails().subscribe({
      next: (status) => {
        // console.log(status);

        // list albums images from S3
        this.fileService.list_files(this.albums_folder + '/').subscribe((S3items) => {
          this.S3items = S3items.filter(item => item.size > 0 && (item.path.endsWith('.jpg') || item.path.endsWith('.jpeg') || item.path.endsWith('.png')));

          // for each image, check if thumbnail exists
          let processed = 0;
          const total = this.S3items.length;
          this.S3items.forEach(item => {
            const thumbnailPath = S3_ROOT_FOLDERS.THUMBNAILS + '/' + item.path.split('/').pop();
            if (!this.S3items.find(i => i.path === thumbnailPath)) {
              // Generate thumbnail & upload to S3
              this.generate_thumbnail(item.path).subscribe(async (file) => {
                await this.fileService.upload_file(file, thumbnailPath)
                  .catch((err) => {
                    console.error(`Error uploading thumbnail for ${item.path}: ${err}`);
                  })
                  .finally(() => {
                    processed++;
                    if (processed === total) {
                      this.toastService.showSuccess('Albums', 'Regéneration des vignettes terminée');
                    }
                  });
              });
            } else {
              console.log(item.path);
              processed++;
              if (processed === total) {
                this.toastService.showSuccess('Albums', 'Regéneration des vignettes terminée');
              }
            }
          });
        });
      }

    });
  }



  generate_thumbnail(imagePath: string): Observable<File> {

    const add_wh = (path: string, wh: string): string => {
      const newFilename = path.replace('.', `_${wh}.`);
      return newFilename;
    }

    const get_filename = (path: string): string => {
      const parts = path.split('/');
      return parts.pop() || '';
    }
    // Logic to generate a thumbnail for the given imagePath
    return new Observable<File>((subscriber) => {
      this.fileService.getPresignedUrl(imagePath).subscribe({
        next: async (url) => {

            await this.imageService.resizeImageAtUrl(url,false).then(async (resizedBase64) => {
              await this.imageService.getBase64Dimensions(resizedBase64).then((dimensions) => {
                const wh = dimensions.width.toString() + 'x' + dimensions.height.toString();
                let new_blob = this.imageService.base64ToBlob(resizedBase64);

                let resized_file = new File([new_blob], get_filename(imagePath), { type: new_blob.type });
                subscriber.next(resized_file);
              });
            });
          },
        error: (err) => {
          subscriber.error(`Error generating thumbnail for ${imagePath}: ${err}`);
        }
      });

    });
  }

  clear_thumbnails(): Observable<string> {
    return this.fileService.list_files(S3_ROOT_FOLDERS.THUMBNAILS + '/').pipe(
      map((S3items) => {
        if (S3items.length === 0) {
          return [];
        }
        let observables: Observable<void>[] = S3items.map(item => {
          return from(this.fileService.delete_file(item.path));
        });
        return observables;
      }),
      mergeMap((observables) => {

        if (observables.length === 0) {
          return of('No thumbnails to delete');
        }

        return new Observable<string>((subscriber) => {
          let completed = 0;
          let total = observables.length;

          observables.forEach(obs => {
            obs.subscribe({
              next: () => {
                completed++;
                if (completed === total) {
                  subscriber.next('All ' + total + ' thumbnails deleted');
                  subscriber.complete();
                }
              },
              error: (err) => {
                subscriber.error(err);
              }
            });
          });
        });
      })
    );
  }




}

