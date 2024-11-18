import { Injectable } from '@angular/core';
import { downloadData, uploadData } from 'aws-amplify/storage';
import { SystemConfiguration } from '../system-conf.interface';
import { from, of } from 'rxjs';
import { Toast } from 'bootstrap';
import { ToastService } from '../toaster/toast.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';



@Injectable({
  providedIn: 'root'
})
export class SystemDataService {
  system_configuration !: SystemConfiguration;

  constructor(
    private toastService: ToastService,
    private sanitizer: DomSanitizer

  ) { }

  // S3 download / upload

  get configuration$() {
    return this.system_configuration ? of(this.system_configuration) : from(this.get_configuration());
  }
  async save_configuration(conf: SystemConfiguration) {
    const json = JSON.stringify(conf);
    const blob = new Blob([json], { type: 'text/plain' });
    const file = new File([blob], 'system_configuration.txt');
    this.upload(blob, 'system/', file).then((data) => {
    });
  }

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
        .catch((error) => {
          console.log('error', error);
          this.toastService.showErrorToast('configuration système', 'erreur de chargement');
          reject(error);
        });
    });
    return promise;
  }


  private async get_configuration(): Promise<SystemConfiguration> {
    let promise = new Promise<SystemConfiguration>((resolve, reject) => {
      downloadData({
        path: 'system/system_configuration.txt',
      }).result
        .then(async (result) => {
          this.system_configuration = JSON.parse(await result.body.text());
          resolve(this.system_configuration);
        })
        .catch((error) => {
          reject(error);
        });
    });
    return promise;
  }

  // local file download / upload

  get_file_url(conf: SystemConfiguration): SafeResourceUrl {
    const json = JSON.stringify(conf);
    const blob = new Blob([json], { type: 'text/plain' });

    return this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));
  }


}
