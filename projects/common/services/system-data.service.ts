import { Injectable } from '@angular/core';
import { downloadData, uploadData } from 'aws-amplify/storage';
import { SystemConfiguration } from '../system-conf.interface';
import { from, of } from 'rxjs';



@Injectable({
  providedIn: 'root'
})
export class SystemDataService {
  system_configuration !: SystemConfiguration;

  constructor() { }

  private async upload(blob: any, directory: string, file: File) {
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
        .then((result) => { resolve(result); })
        .catch((error) => { reject(error); });
    });
    return promise;
  }

  async save_configuration(conf: SystemConfiguration) {
    const json = JSON.stringify(conf);
    const blob = new Blob([json], { type: 'text/plain' });
    const file = new File([blob], 'system_configuration.txt');
    this.upload(blob, 'system/', file).then((data) => {
    });
  }

  private async download(): Promise<string> {
    let promise = new Promise<string>((resolve, reject) => {
      downloadData({
        path: 'system/system_configuration.txt',
      }).result
        .then((result) => { resolve(result.body.text()); })
        .catch((error) => { reject(error); });
    });
    return promise;
  }

  private async download_configuration(): Promise<SystemConfiguration> {
    let promise = new Promise<SystemConfiguration>((resolve, reject) => {
      this.download()
        .then(async (data) => {
          this.system_configuration = JSON.parse(data);
          resolve(this.system_configuration);
        })
        .catch((error) => { reject(error); });
    });
    return promise;
  }

  read_configuration() {
    return from(this.download_configuration());
  }

  get configuration$() {
    return this.system_configuration ? of(this.system_configuration) : from(this.download_configuration());
  }



}
