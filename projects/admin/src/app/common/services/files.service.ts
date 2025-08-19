import { Injectable } from '@angular/core';
import { getUrl, list, remove } from 'aws-amplify/storage';
import { S3Item } from '../interfaces/file.interface';

// Add FileSystem interface with index signature

import { downloadData, uploadData } from 'aws-amplify/storage';
import { ToastService } from '../services/toast.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, of } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class FileService {

  constructor(
    private toastService: ToastService,
    private sanitizer: DomSanitizer
  ) { }

  getPresignedUrl(path: string): Observable<string> {
    return new Observable<string>((subscriber) => {
      getUrl({ path: path, options: { validateObjectExistence: true } })
        .then(getUrlOutput => {
          subscriber.next(getUrlOutput.url.href);
          subscriber.complete();
        })
        .catch(error => {
          console.log(error);
          subscriber.error(error);
        });
    });
  }

  list_files(directory: string): Observable<S3Item[]> {
    return new Observable<S3Item[]>(subscriber => {
      list({ path: directory, options: { listAll: true } })
        .then(result => {
          subscriber.next(result.items.filter(item => item.size !== 0));
          subscriber.complete();
        })
        .catch(error => subscriber.error(error));
    });
  }

  upload_file(file: File, directory = ''): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      uploadData({
        data: file,
        path: directory + file.name,
        options: {
          contentType: file.type,
        }
      }).result
        .then(() => {
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  delete_file(path: string) {
    remove({ path: path })
      .then((data) => {
      })
      .catch((error) => {
        console.log(error);
      });
  }


  async download_file(path: string): Promise<Blob> {
    const result = await downloadData({ path: path }).result;
    return result.body.blob();
  }



  // json upload/download utilities

  async upload_to_S3(data: any, directory: string, filename: string) {
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'text/plain' });
    const file = new File([blob], filename);
    return this.upload_file(file, directory);
  }


  async download_json_file(path: string): Promise<any> {
    let promise = new Promise<any>((resolve, reject) => {
      downloadData({
        path: path,
      }).result
        .then(async (result) => {
          const data = JSON.parse(await result.body.text());
          // console.log('%s : downloaded data', path, data);
          resolve(data);
        })
        .catch((error) => {
          this.toastService.showErrorToast('Configuration système', 'Impossible de charger le fichier ' + path);
          console.warn('impossible de charger le fichier %s', path);
          reject(error);
        });
    });
    return promise;
  }



  json_to_blob(obj: any): SafeResourceUrl {
    const json = JSON.stringify(obj);
    const blob = new Blob([json], { type: 'text/plain' });
    return this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));
  }


  async downloadBlob(path: string): Promise<Blob> {
    const result = await downloadData({ path: path }).result;
    return result.body.blob()
  }
}

