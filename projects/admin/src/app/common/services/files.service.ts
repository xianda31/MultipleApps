
import { Injectable } from '@angular/core';
import { getUrl, list, remove } from 'aws-amplify/storage';
import { FileSystemNode, S3Item } from '../interfaces/file.interface';


import { downloadData, uploadData } from 'aws-amplify/storage';
import { ToastService } from '../services/toast.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable, of } from 'rxjs';

export const S3_BUCKET = 'Bcsto-drive';
export enum S3_ROOT_FOLDERS {
  IMAGES = 'images',
  DOCUMENTS = 'documents',
  ALBUMS = 'albums',
  PORTRAITS = 'portraits',
  THUMBNAILS = 'thumbnails',
  SYSTEM = 'system',
  ACCOUNTING = 'accounting'
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

  upload_file(file: File, directory = ''): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      uploadData({
        data: file,
        path: directory + file.name,
        options: {
          contentType: file.type,
        }
      }).result
        .then(() => {
          resolve();
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

  async upload_to_S3(data: any, directory: string, filename: string) {
    // Defensive: do not upload undefined. JSON.stringify(undefined) produces undefined
    // which would create a blob containing the string "undefined" on S3. Add enhanced
    // diagnostics (stack + payload preview) so we can trace the caller if this happens.
    // const now = new Date().toISOString();
    // const callerStack = (new Error('upload_to_S3: stack trace')).stack;
    // if (data === undefined) {
    //   const err = new Error('upload_to_S3: data is undefined, aborting upload for ' + directory + filename + ' @' + now);
    //   console.error(err);
    //   console.error('upload_to_S3: caller stack', callerStack);
    //   return Promise.reject(err);
    // }

    // Build a small preview to help debugging without logging full payloads.
    // const payloadSummary: { type: string; preview?: string; length?: number } = { type: typeof data };
    // try {
    //   if (typeof data === 'string') {
    //     payloadSummary.preview = (data as string).slice(0, 200);
    //     payloadSummary.length = (data as string).length;
    //   } else if (data instanceof File || data instanceof Blob) {
    //     payloadSummary.type = data.constructor.name;
    //     try { payloadSummary.length = (data as any).size; } catch (e) { /* ignore */ }
    //   } else {
    //     // Try a safe stringify for objects; fall back silently on circular structures
    //     try {
    //       const s = JSON.stringify(data);
    //       payloadSummary.preview = s && s.slice ? s.slice(0, 200) : undefined;
    //       payloadSummary.length = s ? s.length : undefined;
    //     } catch (e) {
    //       payloadSummary.preview = undefined;
    //     }
    //   }
    // } catch (e) {
    //   // Never throw from logging heuristics
    // }

    let json: string;
    try {
      json = JSON.stringify(data);
    } catch (e) {
      console.error('upload_to_S3: JSON.stringify failed for', directory + filename, e);
      // console.error('upload_to_S3: payloadSummary', payloadSummary, 'callerStack', callerStack);
      return Promise.reject(e);
    }

    const blob = new Blob([json], { type: 'text/plain' });
    const file = new File([blob], filename);

    // Log intent to upload with minimal payload info.
    // console.debug('upload_to_S3: uploading', { path: directory + filename, timestamp: now, payloadSummary });

    // Perform upload and attach diagnostics on error so we can trace origin of bad payloads.
    return this.upload_file(file, directory).catch((err) => {
      try {
        console.error('upload_to_S3: upload failed for', directory + filename);
      } catch (e) { /* ignore */ }
      return Promise.reject(err);
    });
  }


  async download_json_file(path: string): Promise<any> {
    let promise = new Promise<any>((resolve, reject) => {
      downloadData({
        path: path,
      }).result
        .then(async (result) => {
          // Read raw body text first so we can log it on parse failure
          const raw = await result.body.text();
          try {
            const data = JSON.parse(raw);
            // console.log('%s : downloaded data', path, data);
            resolve(data);
          } catch (parseErr) {
            // Provide detailed diagnostics to help investigate corrupt or invalid files
            console.error('download_json_file: JSON parse error for', path, parseErr);
            try {
              console.debug('download_json_file: raw content snippet:', path, raw && raw.slice ? raw.slice(0, 200) : raw);
            } catch (e) { /* ignore */ }
            this.toastService.showErrorToast('Configuration système', `Fichier ${path} invalide (erreur de parsing)`);
            reject(parseErr);
          }
        })
        .catch((error) => {
          // Log full error object to capture HTTP/S3 status, code and message
          console.error('download_json_file: failed to download', path, error);
          try { this.toastService.showErrorToast('Configuration système', 'Impossible de charger le fichier ' + path + ' — ' + (error?.message || error)); } catch (e) { /* ignore */ }
          reject(error);
        });
    });
    return promise;
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

