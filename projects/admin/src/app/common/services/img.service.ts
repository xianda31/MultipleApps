import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ImgService {
  /**
   * Génère toutes les versions allégées d'un fichier image selon les tailles cibles
   */
  async createLighterFiles(file: File, card_img_sizes: Array<{ width: number, height: number, ratio?: number }>): Promise<Array<{ file: File, size: { width: number, height: number, ratio?: number } }>> {
    const original_dimensions = await this.imageDimensions(file);
    if (!original_dimensions) return [];
    const new_sizes = this.select_new_sizes(original_dimensions, card_img_sizes);
    const lighterFiles: Array<{ file: File, size: { width: number, height: number, ratio?: number } }> = [];
    for (const size of new_sizes) {
      const lighterFile = await this.createLightenFile(file, size.width, size.height);
      if (lighterFile) {
        lighterFiles.push({ file: lighterFile, size });
      }
    }
    return lighterFiles;
  }

  /**
   * Sélectionne la ou les tailles cibles optimales pour une image donnée
   */
  select_new_sizes(original_dimensions: { width: number; height: number }, card_img_sizes: Array<{ width: number, height: number, ratio?: number }>): Array<{ width: number, height: number, ratio?: number }> {
    const isPortrait = original_dimensions.height > original_dimensions.width;
    const original_ratio = original_dimensions.width / original_dimensions.height;
    let candidateSizes = card_img_sizes;
    if (isPortrait) {
      const portraitSizes = card_img_sizes.map((s) => ({ width: s.height, height: s.width, ratio: +(s.height / s.width).toFixed(2) }));
      candidateSizes = [...card_img_sizes, ...portraitSizes].filter((s, idx, arr) =>
        arr.findIndex(t => t.width === s.width && t.height === s.height) === idx
      );
    }
    let bestSize: { width: number, height: number, ratio?: number } | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const size of candidateSizes) {
      const sizeIsPortrait = size.height > size.width;
      if (isPortrait !== sizeIsPortrait) continue;
      const sizeW = size.width;
      const sizeH = size.height;
      if (sizeW < original_dimensions.width && sizeH < original_dimensions.height) {
        const sizeRatio = sizeW / sizeH;
        const delta = Math.abs(sizeRatio - original_ratio) / original_ratio;
        if (delta <= 0.1 && delta < bestDelta) {
          bestDelta = delta;
          bestSize = size;
        }
      }
    }
    if (bestSize) return [bestSize];
    bestSize = null;
    bestDelta = Number.POSITIVE_INFINITY;
    for (const size of candidateSizes) {
      const sizeW = size.width;
      const sizeH = size.height;
      if (sizeW < original_dimensions.width && sizeH < original_dimensions.height) {
        const sizeRatio = sizeW / sizeH;
        const delta = Math.abs(sizeRatio - original_ratio) / original_ratio;
        if (delta < bestDelta) {
          bestDelta = delta;
          bestSize = size;
        }
      }
    }
    return bestSize ? [bestSize] : [];
  }



  async createLightenFile(file: File, width: number, height: number, mimeType = 'image/jpeg'): Promise<File> {
    const base64 = await this.fileToBase64(file);
    // Charger l'image source
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = base64;
    });

    // Calcul du crop centré au ratio cible
    const srcW = img.width;
    const srcH = img.height;
    const targetRatio = width / height;
    const srcRatio = srcW / srcH;
    let cropW = srcW;
    let cropH = srcH;
    let cropX = 0;
    let cropY = 0;
    if (srcRatio > targetRatio) {
      // Image trop large, crop horizontal
      cropW = Math.round(srcH * targetRatio);
      cropX = Math.round((srcW - cropW) / 2);
    } else if (srcRatio < targetRatio) {
      // Image trop haute, crop vertical
      cropH = Math.round(srcW / targetRatio);
      cropY = Math.round((srcH - cropH) / 2);
    }

    // Dessiner le crop centré et resize
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, width, height);
    const resizedBase64 = canvas.toDataURL(mimeType, 1.0);
    const dimensions = await this.getBase64Dimensions(resizedBase64);
    const wh = dimensions.width + 'x' + dimensions.height;
    const ratio = (dimensions.width / dimensions.height).toFixed(2).replace(',', '.');
    const newBlob = this.base64ToBlob(resizedBase64, mimeType);
    const ext = file.name.split('.').pop();
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const newName = `${baseName}_${wh}_${ratio}.${ext}`;
    return new File([newBlob], newName, { type: newBlob.type });
  }

  imageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise(async (resolve, reject) => {
      const base64 = await this.fileToBase64(file);
      return this.getBase64Dimensions(base64).then(dimensions => {
        resolve(dimensions);
      }).catch(err => {
        reject(err);
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
          // Test qualité maximale pour éviter tout effet de clarté
          resolve(canvas.toDataURL(mimeType, 1.0));
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