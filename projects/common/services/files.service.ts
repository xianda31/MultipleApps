import { Injectable } from '@angular/core';
import { uploadData } from "aws-amplify/storage";

@Injectable({
  providedIn: 'root'
})
export class FilesService {

  constructor() { }

  // uploadFile(key: string, file: any): Promise<any> {
  //   return new Promise((resolve, reject) => {
  //     Storage.put(key, file, {
  //       level: 'public',
  //       contentType: file.type,
  //       progressCallback(progress: any) {
  //         // console.log(`Uploaded: ${progress.loaded}/${progress.total}`);
  //       },
  //     })
  //       .then((result) => {
  //         this.publicBucket.push({ key: key, lastModified: Date.now(), size: file.size, __isFile: true });
  //         this.bucketLoaded$.next(true);
  //         resolve(result);
  //       })
  //       .catch((err) => {
  //         reject(err);
  //       });
  //   });
  // }
}
