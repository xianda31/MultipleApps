import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SiteLayoutService {

  constructor() { }

  getAlbums() : Observable<string[]> {
    // Logic to retrieve albums
    return of(['voyage 2025', 'album#1', 'album#2']);
  }
}
