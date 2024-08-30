import { Injectable } from '@angular/core';
import { getUrl, list, remove } from 'aws-amplify/storage';
import { S3Item } from '../file.interface';
import { BehaviorSubject, Observable } from 'rxjs';



@Injectable({
  providedIn: 'root'
})
export class FileService {

  _S3Items: S3Item[] = [];
  private _S3Items$: BehaviorSubject<S3Item[]> = new BehaviorSubject<S3Item[]>(this._S3Items);

  constructor() {
    this.listFiles();
  }

  get S3Items(): Observable<S3Item[]> {
    return this._S3Items$.asObservable();
  }

  placeholderUrl(): Promise<URL> {
    return new Promise<URL>((resolve, reject) => {
      resolve(new URL("../../admin-dashboard/public/images/bcsto.png"));
    });
  }

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

  listFiles() {
    list({ path: 'thumbnails/', options: { listAll: true } })
      .then((data) => {
        this._S3Items = data.items;

        this._S3Items.forEach((item) => {
          item.url = this.getPresignedUrl(item.path);
        });
        this._S3Items$.next(this._S3Items);
      })
  };

  delete(path: string) {
    remove({ path: path })
      .then((data) => {
        // console.log(data);
        this.listFiles();
      })
      .catch((error) => {
        console.log(error);
      });
  }

  add(path: string) {
    this.listFiles();
  }
}

