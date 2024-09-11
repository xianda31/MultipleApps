import { Injectable } from '@angular/core';
import { getUrl, list, remove } from 'aws-amplify/storage';
import { S3Item } from '../file.interface';
import { BehaviorSubject, Observable } from 'rxjs';



@Injectable({
  providedIn: 'root'
})
export class FileService {

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

}

