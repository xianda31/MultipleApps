import { Injectable } from '@angular/core';
import { map, Observable, of, tap } from 'rxjs';
import { FileService, S3_ROOT_FOLDERS } from './files.service';

@Injectable({
  providedIn: 'root'
})
export class SiteLayoutService {

  // readonly albums_path  = S3_ROOT_FOLDERS.ALBUMS + '/';

  constructor(
    private fileService: FileService
  ) { }

  getAlbums(): Observable<string[]> {
    const albums_path = S3_ROOT_FOLDERS.ALBUMS + '/';
    return this.fileService.list_files(albums_path).pipe(
      map((S3items) => this.get_folders(S3items)),
      map((folders) => folders.map(folder => {return folder.replace(albums_path, '').replace(/\/$/, '');      })),
      map((folders) => folders.filter(folder => folder !== '')),
    );
  }
  get_folders(S3items: any[]): string[] {
    const albums_path = S3_ROOT_FOLDERS.ALBUMS + '/';
    const folderSet = new Set<string>();
    S3items.forEach(item => {
      let folderPath = '';
      if (item.size === 0) {
        folderPath = item.path.replace(/\/$/, ''); // Remove trailing slash
      } else {
        const pathParts = item.path.split('/');
        folderPath = pathParts.slice(0, -1).join('/');
      }
      if (folderPath && folderPath !== albums_path.replace(/\/$/, '')) {
        folderSet.add(folderPath);
      }
    });
    return Array.from(folderSet);
  }
}
