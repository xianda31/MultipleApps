import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ImgService {
  /**
   * Redimensionne une image (File ou base64) en base64, puis retourne un nouveau File allégé avec suffixe w x h.
   * @param file Fichier image d'origine
   * @param width largeur cible
   * @param height hauteur cible
   * @param mimeType type de sortie (par défaut 'image/jpeg')
   */
  async createLightenFile(file: File, width: number, height: number, mimeType = 'image/jpeg'): Promise<File> {
    const base64 = await this.fileToBase64(file);
    const resizedBase64 = await this.resizeBase64Image(base64, width, height, mimeType);
    const dimensions = await this.getBase64Dimensions(resizedBase64);
    const wh = dimensions.width + 'x' + dimensions.height;
    const newBlob = this.base64ToBlob(resizedBase64, mimeType);
    const ext = file.name.split('.').pop();
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const newName = `${baseName}_${wh}.${ext}`;
    return new File([newBlob], newName, { type: newBlob.type });
  }

  imageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise(async (resolve, reject) => {
      const base64 = await this.fileToBase64(file);
      return this.getBase64Dimensions(base64).then(dimensions => {
        resolve(dimensions);
      }).catch(err => { reject(err);
      });
    });
  }

  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  resizeBase64Image(base64Str: string, width: number, height: number, mimeType = 'image/jpeg'): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(mimeType, 0.85));
        } else {
          resolve(base64Str);
        }
      };
      img.src = base64Str;
    });
  }

  getBase64Dimensions(base64: string): Promise<{ width: number, height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.src = base64;
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
    return new Blob(byteArrays, { type: contentType });
  }
}
