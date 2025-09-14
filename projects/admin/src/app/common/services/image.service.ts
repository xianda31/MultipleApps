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
      this.album_thumbnailSize = { width: this.thumbnailSize.width / 2, height: this.thumbnailSize.height / 2, ratio: this.thumbnailSize.ratio };

    });

  }

  private resize(img: HTMLImageElement, sizing: ImageSize, both: boolean): string {

    let canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;
    let sx = 0, sy = 0;
    let sw = width, sh = height;
    let dw, dh;

    // 1. Rogner au ratio sizing.ratio (landscape) ou 1/ratio (portrait), centré
    let targetRatio: number;
    const imgRatio = width / height;
    if (imgRatio >= 1) {
      // Landscape or square: use sizing.ratio
      targetRatio = sizing.ratio;
    } else {
      // Portrait: use 1/ratio
      targetRatio = 1 / sizing.ratio;
    }
    if (imgRatio > targetRatio) {
      // Image trop large, crop horizontal
      sw = height * targetRatio;
      sh = height;
      sx = (width - sw) / 2;
      sy = 0;
    } else {
      // Image trop haute, crop vertical
      sw = width;
      sh = width / targetRatio;
      sx = 0;
      sy = (height - sh) / 2;
    }

    // 2. Réduire la largeur à sizing.width
    if (sw > sizing.width) {
      dw = sizing.width;
      dh = sh * (dw / sw);
    } else {
      dw = sw;
      dh = sh;
    }

    // 3. Si both=true, réduire aussi la hauteur à sizing.height
    if (both && dh > sizing.height) {
      dh = sizing.height;
      dw = sw * (dh / sh);
    }

    canvas.width = Math.round(dw);
    canvas.height = Math.round(dh);

    let ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    }
    return canvas.toDataURL('image/jpeg', 0.8);
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

  getBase64Dimensions(base64: string): Promise<{ width: number, height: number }> {
    return new Promise((resolve) => {
      let img = new Image();
      img.src = base64;
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
    });
  }

  base64ToBlob(base64: string, contentType = 'image/jpeg', sliceSize = 512): Blob {
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
