import { Injectable } from '@angular/core';
import { getUrl, list, remove } from 'aws-amplify/storage';
import { FileSystemNode, S3Item } from '../interfaces/file.interface';


import { downloadData, uploadData } from 'aws-amplify/storage';
import { ToastService } from '../services/toast.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable } from 'rxjs';

export const S3_BUCKET = 'Bcsto-drive';
export enum S3_ROOT_FOLDERS {
  IMAGES = 'images',
  DOCUMENTS = 'documents',
  ALBUMS = 'albums',
  PORTRAITS = 'portraits',
  THUMBNAILS = 'thumbnails',
  SYSTEM = 'system',
  ACCOUNTING = 'accounting',
  INVOICES = 'invoices',
  ANY = 'any'
}

@Injectable({
  providedIn: 'root'
})
export class FileService {


  constructor(
    private toastService: ToastService,
    private sanitizer: DomSanitizer
  ) { }

  getPresignedUrl$(path: string, silentError: boolean = false): Observable<string> {
    // console.log('getPresignedUrl$ for ', path);
    return new Observable<string>((subscriber) => {
      getUrl({ path: path, options: { validateObjectExistence: true } })
        .then(getUrlOutput => {
          subscriber.next(getUrlOutput.url.href);
          subscriber.complete();
        })
        .catch(error => {
          // Ne logger que si ce n'est pas une erreur silencieuse (comme pour les avatars manquants)
          if (!silentError && !path.includes('portraits/')) {
            console.log('reading %s %s', path,error);
          }
          subscriber.error(error);
        });
    });
  }

  list_files(directory: string): Observable<S3Item[]> {
    return new Observable<S3Item[]>(subscriber => {
      list({ path: directory, options: { listAll: true } })
        .then(result => {
          subscriber.next(result.items.map(item => ({ ...item, size: item.size ?? 0, url$: this.getPresignedUrl$(item.path) }))
            // .filter(item => item.size !== 0)
          );
          subscriber.complete();
        })
        .catch(error => {
          console.log('%s listing %s', error, directory);
          subscriber.error(error);});
    });
  }

  list_folders(directory: string): Observable<string[]> {

    const filter_folders = (s3items: S3Item[]): string[] => {
      let folders = new Set<string>();
      s3items.forEach((s3item) => {
        if (s3item.size) {
          // sometimes files declare a folder with a / within then
          let possibleFolder = s3item.path.split('/').slice(0, -1).join('/');
          if (possibleFolder) folders.add(possibleFolder);
        } else {
          //remove trailing /
          if (s3item.path !== directory) {
            folders.add(s3item.path.replace(/\/$/, ''));
          }
        }
      });
      // console.log('folders : ', Array.from(folders));
      return Array.from(folders);
    }

    return new Observable<string[]>(subscriber => {
      list({ path: directory, options: { listAll: true } })
        .then(result => {
          const folders = filter_folders(result.items as S3Item[]);
          subscriber.next(folders);
          subscriber.complete();
        })
        .catch(error => subscriber.error(error));
    });
  }

  generate_filesystem(response: S3Item[]): FileSystemNode {
    // Build and prune in a single pass
    function insertAndPrune(items: S3Item[], prefix: string = ""): FileSystemNode | null {
      // Group items by their next path segment
      const groups: { [key: string]: S3Item[] } = {};
      for (const item of items) {
        const relPath = item.path.slice(prefix.length);
        const [head, ...tail] = relPath.split('/').filter(Boolean);
        if (!head) continue;
        const groupKey = head;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(item);
      }
      let hasData = false;
      const node: FileSystemNode = {};
      for (const key of Object.keys(groups)) {
        // Find S3Item for this node (folder or file)
        const exact = groups[key].find(item => {
          const relPath = item.path.slice(prefix.length);
          return relPath === key || relPath === key + '/';
        });
        // Recurse for children
        const childTails = groups[key].filter(item => {
          const relPath = item.path.slice(prefix.length);
          return relPath !== key && relPath !== key + '/';
        });
        let childNode: FileSystemNode | null = null;
        if (childTails.length > 0) {
          childNode = insertAndPrune(childTails, prefix + key + '/');
        }
        if (exact || childNode) {
          node[key] = {};
          if (exact) {
            (node[key] as any)['__data'] = exact;
          } else if (childNode) {
            // Generate default __data for folder
            (node[key] as any)['__data'] = { path: prefix + key + '/', size: 0 };
          }
          if (childNode) {
            Object.assign(node[key], childNode);
          }
          hasData = true;
        }
      }
      return hasData ? node : null;
    }
    const tree = insertAndPrune(response);
    return tree || {};
  }

  delete_file(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      remove({ path: path })
        .then((data) => {
          resolve();
        })
        .catch((error) => {
          console.log(error);
          reject(error);
        });
    });
  }

  /**
   * Supprime récursivement un dossier et tout son contenu (fichiers et sous-dossiers)
   */
  async deleteFolderRecursive(path: string): Promise<void> {
    try {
      if (!path.endsWith('/')) path += '/';
      const items = await this.list_files(path).toPromise();
      if (!items) return;
      for (const item of items) {
        if (item.path === path) continue;
        const relative = item.path.replace(path, '');
        if (relative.includes('/') && relative.lastIndexOf('/') !== relative.length - 1) continue;
        if (item.size === 0) {
          await this.deleteFolderRecursive(item.path);
        } else {
          await this.delete_file(item.path);
        }
      }
      await this.delete_file(path);
    } catch (err) {
      throw err;
    }
  }
    // Vérifie que deleteFolderRecursive est bien exportée et accessible

  upload_file(file: File, directory = '',  preventOverwrite: boolean = false): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const options: any = {
        contentType: file.type,
      };
      if (preventOverwrite) {
        options.preventOverwrite = true;
      }

      const s3Path = directory + file.name;
      uploadData({
        data: file,
        path: s3Path,
        options: options
      }).result
        .then(() => {
          // Get the public URL of the uploaded file
          getUrl({ path: s3Path }).then(urlResult => {
            resolve(urlResult.url.toString());
          }).catch(err => reject(err));
        })
        .catch((error) => {
          reject(error);
        });
    });
  }



  async download_file(path: string): Promise<Blob> {
    const result = await downloadData({ path: path }).result;
    return result.body.blob();
  }



  // json upload/download utilities

  async upload_to_S3(data: any, directory: string, filename: string, pretty: boolean = false) {

    let json: string;
    try {
      json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    } catch (e) {
      console.error('upload_to_S3: JSON.stringify failed for', directory + filename, e);
      // console.error('upload_to_S3: payloadSummary', payloadSummary, 'callerStack', callerStack);
      return Promise.reject(e);
    }

    const blob = new Blob([json], { type: 'text/plain' });
    const file = new File([blob], filename);

    // Log intent to upload with minimal payload info.
    // ...

    // Perform upload and attach diagnostics on error so we can trace origin of bad payloads.
    // Use noCache=true for config files to avoid CDN caching issues
    // const isConfigFile = directory.startsWith('system/') || filename.endsWith('_settings.txt');
    return this.upload_file(file, directory).catch((err) => {
      try {
        console.error('upload_to_S3: upload failed for', directory + filename);
      } catch (e) { /* ignore */ }
      return Promise.reject(err);
    });
  }


  async download_json_file(path: string, bypassCache: boolean = true): Promise<any> {
    // Use getUrl to get a presigned URL, then fetch with cache control to bypass browser cache
    try {
      const urlResult = await getUrl({ path: path });
      const urlString = urlResult.url.toString();
      // Ne pas ajouter de paramètre cache-buster à une URL signée !
      const fetchUrl = urlString;
      const response = await fetch(fetchUrl, {
        method: 'GET',
        cache: bypassCache ? 'no-store' : 'default',
        headers: bypassCache ? { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' } : {}
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const raw = await response.text();
      try {
        const data = JSON.parse(raw);
        return data;
      } catch (parseErr) {
        console.error('download_json_file: JSON parse error for', path, parseErr);
        this.toastService.showErrorToast('Configuration système', `Fichier ${path} invalide (erreur de parsing)`);
        throw parseErr;
      }
    } catch (error: any) {
      console.error('download_json_file: failed to download', path, error);
      this.toastService.showErrorToast('Configuration système', 'Impossible de charger le fichier ' + path + ' — ' + (error?.message || error));
      throw error;
    }
  }



  json_to_blob(obj: any): SafeResourceUrl {
    const json = JSON.stringify(obj);
    const blob = new Blob([json], { type: 'text/plain' });
    return this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));
  }


  async downloadBlob(path: string): Promise<Blob> {
    const result = await downloadData({ path: path }).result;
    return result.body.blob()
  }
}

