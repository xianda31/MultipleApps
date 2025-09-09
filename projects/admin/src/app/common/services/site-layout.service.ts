import { Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { FileService } from './files.service';

@Injectable({
  providedIn: 'root'
})
export class SiteLayoutService {

  constructor(
    private fileService: FileService,

  ) { }

  getAlbums(): Observable<string[]> {
    // Logic to retrieve albums
    // return of(['voyage 2025', 'album#1', 'album#2']);

    return this.fileService.list_files('albums/').pipe(
      map((S3items) => this.get_folders(S3items))
    );
  }
  get_folders(S3items: any[]): string[] {
    const folderSet = new Set<string>();
    S3items.forEach(item => {
      if (item.size === 0) { // Only consider folders (size 0)
        folderSet.add(item.path);
      }
    });
    return Array.from(folderSet);
  }
}
