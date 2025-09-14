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
    const width = img.width;
    const height = img.height;
    const imgRatio = width / height;
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');

    if (imgRatio >= 1) { // LANDSCAPE
      // Centrer l'image sur un fond transparent sizing.width x sizing.height
      canvas.width = sizing.width;
      canvas.height = sizing.height;
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Calculer la taille réduite de l'image pour tenir dans sizing.width x sizing.height
        let scale = Math.min(sizing.width / width, sizing.height / height);
        let dw = width * scale;
        let dh = height * scale;
        let dx = (sizing.width - dw) / 2;
        let dy = (sizing.height - dh) / 2;
        ctx.drawImage(img, 0, 0, width, height, dx, dy, dw, dh);
      }
      return canvas.toDataURL('image/png', 0.95); // PNG pour transparence
    } else { // PORTRAIT
      if (!both) {
        // 1. Rogner au centre pour obtenir le ratio 1/sizing.ratio
        const targetRatio = 1 / sizing.ratio;
        let cropWidth = width;
        let cropHeight = height;
        let sx = 0, sy = 0;
        if (imgRatio > targetRatio) {
          cropWidth = height * targetRatio;
          sx = (width - cropWidth) / 2;
        } else {
          cropHeight = width / targetRatio;
          sy = (height - cropHeight) / 2;
        }
        // 2. Réduire la hauteur à sizing.height
        const dh = sizing.height;
        const dw = cropWidth * (dh / cropHeight);
        canvas.width = Math.round(dw);
        canvas.height = Math.round(dh);
        if (ctx) {
          ctx.drawImage(img, sx, sy, cropWidth, cropHeight, 0, 0, dw, dh);
        }
        return canvas.toDataURL('image/jpeg', 0.8);
      } else {
        // 1. Centrer l'image sur un fond transparent de taille sizing.width x sizing.height
        canvas.width = sizing.width;
        canvas.height = sizing.height;
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Calculer la taille réduite de l'image pour tenir dans sizing.width x sizing.height
          let scale = Math.min(sizing.width / width, sizing.height / height);
          let dw = width * scale;
          let dh = height * scale;
          let dx = (sizing.width - dw) / 2;
          let dy = (sizing.height - dh) / 2;
          ctx.drawImage(img, 0, 0, width, height, dx, dy, dw, dh);
        }
        return canvas.toDataURL('image/png', 0.95); // PNG pour transparence
      }
    }
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
