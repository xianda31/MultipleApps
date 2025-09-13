import { Injectable } from '@angular/core';
import { SystemDataService } from './system-data.service';
import { ImageSize } from '../interfaces/system-conf.interface';
import { Image } from 'exceljs';

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  // ratio_untouched = true;
  thumbnailSize !: ImageSize;
  album_thumbnailSize !: ImageSize;
  constructor(
    private systemDataService: SystemDataService
  ) {
    this.systemDataService.get_configuration().subscribe((configuration) => {
      this.thumbnailSize = configuration.thumbnail;
      this.album_thumbnailSize = { width: this.thumbnailSize.width/2, height: this.thumbnailSize.height/2, ratio: this.thumbnailSize.ratio };

    });

  }

  private resize(img: HTMLImageElement, sizing:ImageSize, toggle: boolean): string {

    let canvas = document.createElement('canvas')
    let width = img.width
    let height = img.height
    let sx = 0, sy = 0
    let sw = width, sh = height;
    let dw = width, dh = height

    // mise au ratio

      if (width > height) {
        let ratio = width / height
        if (ratio > sizing.ratio) {
          sw = height * sizing.ratio
          sh = height
          sx = (width - sw) / 2
          sy = 0
        } else {
          sw = width
          sh = width / sizing.ratio
          sx = 0
          sy = (height - sh) / 2
        }

      } else {
        let ratio = height / width
        if (ratio > sizing.ratio) {
          sw = width
          sh = width / sizing.ratio
          sx = 0
          sy = (height - sh) / 2
        } else {
          sw = height / sizing.ratio
          sh = height
          sx = (width - sw) / 2
          sy = 0
        }
      }
    // reduction de taille proportionnelle
    if (!toggle) {
      // Ne pas dépasser sizing.height, respecter le ratio
      if (sh > sizing.height) {
        dh = sizing.height;
        dw = dh * (sw / sh);
      } else {
        dh = sh;
        dw = sw;
      }
    } else {
      // Comportement original : ne pas dépasser sizing.width
      if (sw > sizing.width) {
        dh = sh * sizing.width / sw;
        dw = sizing.width;
      } else {
        if (sh > sizing.height) {
          dw = sw * sizing.height / sh;
          dh = sizing.height;
        }
      }
    }

    canvas.width = dw
    canvas.height = dh

    //  console.log("image %s x %s : \n sx=%s sy=%s sw=%s sh=%s \n final : %s x %s", width, height, sx, sy, sw, sh, dw, dh);
    let ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, 0, 0, dw, dh);
    }
    return (canvas.toDataURL('image/jpeg', 0.8))
  }

resizeImageAtUrl(url: string, toggle: boolean): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        await img.decode();
        resolve(this.resize(img, this.album_thumbnailSize, toggle));
      } catch (err) {
        console.error('Image decode error:', err);
        resolve('');
      }
    };
    img.onerror = (err) => {
      console.error('Error loading image from URL:', err);
      resolve('');
    };
    img.src = url;
  });
}

resizeBase64Image(base64Str: string, toggle: boolean): Promise<string> {
  return new Promise((resolve) => {
    let img = new Image()
    img.src = base64Str

    resolve(this.resize(img, this.thumbnailSize, toggle))

  })
}

getBase64Dimensions(base64: string): Promise < { width: number, height: number } > {
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
