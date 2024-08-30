import { Component } from '@angular/core';
import { ImgUploadComponent } from '../img-upload/img-upload.component';
import { getUrl, list } from 'aws-amplify/storage';
import { CommonModule } from '@angular/common';
import { get } from 'aws-amplify/api';

interface S3ListItem {
  path: string;
  etag?: string;
  lastModified?: Date | undefined;
  size?: number;
  url?: Promise<URL>;
}

@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule, ImgUploadComponent],
  templateUrl: './test.component.html',
  styleUrl: './test.component.scss'
})

export class TestComponent {
  S3listItems: S3ListItem[] = [];
  constructor() {
    this.S3listItems = [];
    this.listFiles();
  }


  listFiles() {

    function getPresignedUrl(path: string): Promise<URL> {
      return new Promise<URL>((resolve, reject) => {
        getUrl({ path: path, options: { validateObjectExistence: false } })
          .then((linkToStorageFile) => {
            resolve(linkToStorageFile.url);
          })
          .catch((error) => {
            reject(error);
          });
      });
    }

    list({ path: 'thumbnails/', options: { listAll: true } })
      .then((data) => {
        console.log(data);
        this.S3listItems = data.items;

        this.S3listItems.forEach((item) => {
          item.url = getPresignedUrl(item.path);
        });
        console.log(this.S3listItems);
      })
  };
}

