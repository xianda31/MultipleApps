import { Injectable } from '@angular/core';
import { map, Observable, of, tap } from 'rxjs';
import { FileService } from './files.service';

@Injectable({
  providedIn: 'root'
})
export class SiteLayoutService {

  readonly albums_path  = 'images/albums/';

  constructor(
    private fileService: FileService
  ) { }

  getAlbums(): Observable<string[]> {
    // Logic to retrieve albums
    // return of(['voyage 2025', 'album#1', 'album#2']);

    return this.fileService.list_files(this.albums_path).pipe(
      map((S3items) => this.get_folders(S3items)),
      map((folders) => folders.map(folder => {return folder.replace(this.albums_path, '').replace(/\/$/, '');      })),
      map((folders) => folders.filter(folder => folder !== '')),
      tap((folders) => console.log('Albums found:', folders))
    );
  }
  get_folders(S3items: any[]): string[] {
    const folderSet = new Set<string>();
    console.log('All S3 items:', S3items);
    S3items.forEach(item => {
      let folderPath = '';
      if (item.size === 0) {
        folderPath = item.path.replace(/\/$/, ''); // Remove trailing slash
      } else {
        const pathParts = item.path.split('/');
        folderPath = pathParts.slice(0, -1).join('/');
      }
      if (folderPath && folderPath !== this.albums_path.replace(/\/$/, '')) {
        folderSet.add(folderPath);
      }
    });
    return Array.from(folderSet);
  }
}
