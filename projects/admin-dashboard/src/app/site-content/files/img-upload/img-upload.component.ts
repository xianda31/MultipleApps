import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
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
        path: `thumbnails/${file.name}`,
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

        if (width > height) {
          if (width > ImageSize.THUMBNAIL_MAX_WIDTH) {
            height *= ImageSize.THUMBNAIL_MAX_WIDTH / width
            width = ImageSize.THUMBNAIL_MAX_WIDTH
          }
        } else {
          if (height > ImageSize.THUMBNAIL_MAX_HEIGHT) {
            width *= ImageSize.THUMBNAIL_MAX_HEIGHT / height
            height = ImageSize.THUMBNAIL_MAX_HEIGHT
          }
        }
        canvas.width = width
        canvas.height = height
        let ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
    })
  }


}
