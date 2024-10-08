import { Injectable } from '@angular/core';
import { downloadData, uploadData } from 'aws-amplify/storage';
import { SystemConfiguration } from './system-conf.interface';



@Injectable({
  providedIn: 'root'
})
export class SystemDataService {

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
      console.log('data : ', data);
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

  async read_configuration(): Promise<SystemConfiguration> {
    return this.download().then(async (data) => {
      console.log('data : ', data);
      const conf: SystemConfiguration = JSON.parse(data);
      console.log('conf : ', conf);
      return conf;
    });
  }




}
