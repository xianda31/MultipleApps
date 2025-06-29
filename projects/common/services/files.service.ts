import { Injectable } from '@angular/core';
import { getUrl, list, remove } from 'aws-amplify/storage';
import { S3Item } from '../file.interface';
import { BehaviorSubject, Observable } from 'rxjs';
import { downloadData, uploadData } from 'aws-amplify/storage';
import { ToastService } from '../toaster/toast.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';



@Injectable({
  providedIn: 'root'
})
export class FileService {

  constructor(
    private toastService: ToastService,
    private sanitizer: DomSanitizer
  ) { }

  getPresignedUrl(path: string): Promise<URL> {
    return new Promise<URL>((resolve, reject) => {
      getUrl({ path: path, options: { validateObjectExistence: false } })
        .then((linkToStorageFile) => {
          // console.log('linkToStorageFile', linkToStorageFile);
          resolve(linkToStorageFile.url);
        })
        .catch((error) => {
          console.log(error);
          reject(error);
        });
    });
  }

  list(directory: string): Promise<S3Item[]> {
    let promise = new Promise<S3Item[]>((resolve, reject) => {
      list({ path: directory, options: { listAll: true } })
        .then((data) => {
          resolve(data.items);
        }
        ).catch((error) => {
          console.log(error);
          reject(error);
        });
    });
    return promise;
  }


  delete(path: string) {
    remove({ path: path })
      .then((data) => {
        // console.log(data);
        // this.listFiles();
      })
      .catch((error) => {
        console.log(error);
      });
  }

  // json upload/download utilities

  async upload_to_S3(data: any, directory: string, filename: string) {
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'text/plain' });
    const file = new File([blob], filename);
    let promise = new Promise((resolve, reject) => {
      uploadData({
        data: blob,
        path: directory + file.name,
        // bucket: 'publicBucket'
        options: {
          contentType: 'text/plain;charset=utf-8',
          metadata: { customKey: 'bcsto' },
        }
      }).result
        .then((result) => {
          this.toastService.showSuccess('upload '+ directory, 'sauvegarde réussie');
          resolve(result);
        })
        .catch((error) => {
          console.log('error', error);
          this.toastService.showErrorToast('upload '+ directory, 'échec de la sauvegarde');
          reject(error);
        });
    });
    return promise;
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

}

