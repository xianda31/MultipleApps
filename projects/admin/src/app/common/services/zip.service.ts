import JSZip from 'jszip';
import { Injectable } from '@angular/core';
import { FileService } from './files.service';

@Injectable({ providedIn: 'root' })
export class ZipService {
  constructor(private fileService: FileService) {}

  /**
   * Télécharge tout le contenu d'un dossier (fichiers et sous-dossiers) sous forme de zip
   * @param folderPath Chemin du dossier à zipper (ex: 'images/2023/')
   * @param zipName Nom du fichier zip à générer
   */
  async downloadFolderAsZip(folderPath: string, zipName: string = 'archive.zip') {
    // Force le slash final pour la racine
    if (!folderPath.endsWith('/')) folderPath += '/';
    const zip = new JSZip();
    await this.addFolderToZip(zip, folderPath, '');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  private async addFolderToZip(zip: JSZip, folderPath: string, relativePath: string) {
    const items = await this.fileService.list_files(folderPath).toPromise();
    if (!items) return;
    for (const item of items) {
      if (item.path === folderPath) continue;
      // Calcul du chemin relatif
      let rel = item.path.startsWith(folderPath) ? item.path.substring(folderPath.length) : item.path;
      if (item.size === 0) {
        // Dossier : s'assurer que le chemin se termine par un slash
        let folderRel = rel.endsWith('/') ? rel : rel + '/';
        await this.addFolderToZip(zip, item.path, relativePath + folderRel);
      } else {
        // Fichier : garder le nom complet avec extension
        const blob = await this.fileService.download_file(item.path);
        zip.file(relativePath + rel, blob);
      }
    }
  }
}
