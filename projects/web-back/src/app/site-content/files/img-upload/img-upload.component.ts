import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { uploadData } from 'aws-amplify/storage';
// import { ImageSize } from '../../../const';
import { map } from 'rxjs';
import { SystemDataService } from '../../../../../../common/services/system-data.service';
import { ImageSize } from '../../../../../../common/system-conf.interface';

@Component({
    selector: 'app-img-upload',
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './img-upload.component.html',
    styleUrl: './img-upload.component.scss'
})
export class ImgUploadComponent {
  @Input() directory: string = '';
  @Input() multiple: boolean = false;
  @Input() ratio_untouched: boolean = false;
  @Output() uploaded = new EventEmitter<string>();
  @ViewChild('fileInput') fileInput!: ElementRef;
  resizedBase64Strings: { base64: string, file: File }[] = [];
  files!: File[];
  uploadPromises: Promise<any>[] = [];
  file_selected: boolean = false;
  thumbnailSize !: ImageSize;

  constructor(
    private systemDataService: SystemDataService
  ) {
    this.systemDataService.get_configuration().subscribe((configuration) => {
      this.thumbnailSize = configuration.thumbnailSize;
    });

  }

  onChange(event: any) {
    this.files = [];
    this.resizedBase64Strings = [];
    for (let i = 0; i < event.target.files.length; i++) {
      this.files.push(event.target.files[i]);
    }
    this.files.forEach((file) => {
      this.readFile(file).then((base64) => {
        this.resizedBase64Strings.push({ base64, file });
      })
    });
    this.file_selected = true;
  }


  readFile(file: File): Promise<string> {
    let promise = new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        this.resizeImage(base64String)
          .then((base64) => {
            // this.resizedBase64String = base64;
            resolve(base64);
          });
      };
    });
    return promise;
  };


  dataUrltoBlob(dataUrl: string): Blob {
    const [meta, data] = dataUrl.split(",")
    // Convert the base64 encoded data to a binary string.
    const byteString = atob(data)
    // Get the MIME type.
    const [mimeTypeWithDataPrefix] = meta.split(";")
    const mimeType = mimeTypeWithDataPrefix.replace("data:", "")
    // Convert the binary string to an ArrayBuffer.
    const arrayBuffer = Uint8Array.from(byteString, (c) => c.charCodeAt(0)).buffer
    // Create a blob from the ArrayBuffer.
    return new Blob([arrayBuffer], { type: mimeType })
  }

  onUpload() {
    this.uploadPromises = [];
    this.resizedBase64Strings.forEach(({ base64, file }) => {
      const blob = this.dataUrltoBlob(base64);
      this.uploadPromises.push(this.upload(blob, new File([blob], file.name)));
    });
    Promise.all(this.uploadPromises).then(() => {
      this.reset_input();
      this.resizedBase64Strings = [];
      this.uploaded.emit('done');
    });
  }

  reset_input() {
    this.fileInput.nativeElement.value = '';
    this.file_selected = false;
  }

  async upload(blob: any, file: File) {
    let promise = new Promise((resolve, reject) => {
      uploadData({
        data: blob,
        path: this.directory + file.name,
        // bucket: 'publicBucket'
        options: {
          contentType: 'image/jpeg',
          metadata: { customKey: 'bcsto' },
        }
      }).result
        .then((result) => { resolve(result); })
        .catch((error) => { reject(error); });
    });
    return promise;
  }

  resizeImage(base64Str: string): Promise<string> {
    return new Promise((resolve) => {
      let img = new Image()
      img.src = base64Str
      img.onload = () => {
        let canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        let sx = 0, sy = 0
        let sw = width, sh = height;
        let dw = width, dh = height

        // mise au ratio
        if (!this.ratio_untouched) {

          if (width > height) {
            let ratio = width / height
            if (ratio > this.thumbnailSize.ratio) {
              sw = height * this.thumbnailSize.ratio
              sh = height
              sx = (width - sw) / 2
              sy = 0
            } else {
              sw = width
              sh = width / this.thumbnailSize.ratio
              sx = 0
              sy = (height - sh) / 2
            }

          } else {
            let ratio = height / width
            if (ratio > this.thumbnailSize.ratio) {
              sw = width
              sh = width / this.thumbnailSize.ratio
              sx = 0
              sy = (height - sh) / 2
            } else {
              sw = height / this.thumbnailSize.ratio
              sh = height
              sx = (width - sw) / 2
              sy = 0
            }
          }
        }
        // reduction de taille proportionnelle

        if (sw > this.thumbnailSize.max_width) {
          dh = sh * this.thumbnailSize.max_width / sw
          dw = this.thumbnailSize.max_width
        } else {
          if (sh > this.thumbnailSize.max_height) {
            dw = sw * this.thumbnailSize.max_height / sh
            dh = this.thumbnailSize.max_height
          }
        }
        canvas.width = dw
        canvas.height = dh

        //  console.log("image %s x %s : \n sx=%s sy=%s sw=%s sh=%s \n final : %s x %s", width, height, sx, sy, sw, sh, width, height);
        let ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
    })
  }
}
