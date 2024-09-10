import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { uploadData } from 'aws-amplify/storage';
import { ImageSize } from '../../../const';

@Component({
  selector: 'app-img-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './img-upload.component.html',
  styleUrl: './img-upload.component.scss'
})
export class ImgUploadComponent {
  @Input() directory: string = '';
  @Output() uploaded = new EventEmitter<Blob>();
  resizedBase64String: any;
  file!: File;


  onChange(event: any) {
    this.file = event.target.files[0];
    const reader = new FileReader();
    reader.readAsDataURL(this.file);
    reader.onload = () => {
      const base64String = reader.result as string;

      //resize and set preview image
      this.resizeImage(base64String)
        .then((base64) => {
          this.resizedBase64String = base64;
          // console.log('%s x %s ', height, width);
        });
    };

  }

  imageToBlob(base64: string, filename: string) {
    fetch(base64)
      .then(res => res.blob())
      .then(blob => {
        this.upload(blob, new File([blob], filename)).then(() => {
        });
      });
  }

  onUpload() {
    const img = new Image();
    img.src = this.resizedBase64String;
    img.onload = () => {
      const width = img.width;
      const height = img.height;
      const filename = this.file.name;
      // const filename = this.file.name.split('.')[0] + width + 'x' + height + '.jpg';
      console.log(filename);
      URL.revokeObjectURL(img.src);
      this.imageToBlob(this.resizedBase64String, filename);
    };
  }

  async upload(blob: any, file: File) {
    try {
      uploadData({
        data: blob,
        path: this.directory + file.name,
        // bucket: 'publicBucket'
        options: {
          contentType: 'image/jpeg',
          metadata: { customKey: 'thumbnail' },
        }
      }).result.then((result) => {
        this.uploaded.emit(blob);
      });
    } catch (e) {
      console.log("error", e);
    }
  }

  resizeImage(base64Str: string): Promise<string> {


    return new Promise((resolve) => {
      let img = new Image()
      img.src = base64Str
      img.onload = () => {
        let canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // mise au ratio
        let sx, sy, sw, sh;

        let dw = width, dh = height


        if (width > height) {
          // image horizontale
          //  console.log("image horizontale");
          let ratio = width / height
          if (ratio > ImageSize.THUMBNBAIL_RATIO) {
            // plus large que haut
            //  console.log("%s: plus large que haut ", ratio);
            sw = height * ImageSize.THUMBNBAIL_RATIO
            sh = height
            sx = (width - sw) / 2
            sy = 0
            // dw = height * ImageSize.THUMBNBAIL_RATIO
            // dh = height
          } else {
            // plus haut que large
            //  console.log("%s: plus haut que large ", ratio);
            sw = width
            sh = width / ImageSize.THUMBNBAIL_RATIO
            sx = 0
            sy = (height - sh) / 2
            // dw = width
            // dh = width / ImageSize.THUMBNBAIL_RATIO
          }

        } else {
          // image verticale
          //  console.log("image verticale");
          let ratio = height / width
          if (ratio > ImageSize.THUMBNBAIL_RATIO) {
            // plus haut que large
            //  console.log("%s: trop haute ", ratio);
            sw = width
            sh = width / ImageSize.THUMBNBAIL_RATIO
            sx = 0
            sy = (height - sh) / 2
            // dw = width
            // dh = width / ImageSize.THUMBNBAIL_RATIO
          } else {
            // plus large que haut
            //  console.log("%s: trop large ", ratio);
            sw = height / ImageSize.THUMBNBAIL_RATIO
            sh = height
            sx = (width - sw) / 2
            sy = 0
            // dw = height * ImageSize.THUMBNBAIL_RATIO
            // dh = height
          }
        }

        // reduction de taille proportionnelle

        if (sw > ImageSize.THUMBNAIL_MAX_WIDTH) {
          dh = sh * ImageSize.THUMBNAIL_MAX_WIDTH / sw
          dw = ImageSize.THUMBNAIL_MAX_WIDTH
        } else {
          if (sh > ImageSize.THUMBNAIL_MAX_HEIGHT) {
            dw = sw * ImageSize.THUMBNAIL_MAX_HEIGHT / sh
            dh = ImageSize.THUMBNAIL_MAX_HEIGHT
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
