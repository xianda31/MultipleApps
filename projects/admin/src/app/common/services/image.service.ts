import { Injectable } from '@angular/core';
import { SystemDataService } from './system-data.service';
import { ImageSize } from '../interfaces/system-conf.interface';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  ratio_untouched = true;
  thumbnailSize !: ImageSize;
   constructor(
      private systemDataService: SystemDataService
    ) {
      this.systemDataService.get_configuration().subscribe((configuration) => {
        console.log('ImageService configuration:', configuration);
        this.thumbnailSize = configuration.thumbnail;
        console.log('ImageService initialized with thumbnail size:', this.thumbnailSize);
      });
  
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

        if (sw > this.thumbnailSize.width) {
          dh = sh * this.thumbnailSize.width / sw
          dw = this.thumbnailSize.width
        } else {
          if (sh > this.thumbnailSize.height) {
            dw = sw * this.thumbnailSize.height / sh
            dh = this.thumbnailSize.height
          }
        }
        canvas.width = dw
        canvas.height = dh

        //  console.log("image %s x %s : \n sx=%s sy=%s sw=%s sh=%s \n final : %s x %s", width, height, sx, sy, sw, sh, dw, dh);
        let ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, dw, dh);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
    })
  }

  getBase64Dimensions(base64: string): Promise<{ width: number, height: number }> {
    return new Promise((resolve) => {
      let img = new Image();
      img.src = base64;
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
    });
  }

  base64ToBlob(base64 : string, contentType = 'image/jpeg', sliceSize = 512) : Blob {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);

        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: contentType });
    return blob;
}
}
