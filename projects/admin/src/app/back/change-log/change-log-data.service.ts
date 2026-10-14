import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import rawChangeLogEntries from './change-log.data.json';
import {
  ChangeLogEntry,
  sortChangeLogEntries,
  validateChangeLogEntries,
} from './change-log.model';

@Injectable({ providedIn: 'root' })
export class ChangeLogDataService {
  private readonly editorApiUrl = '/api/changelog';

  constructor(private http: HttpClient) {}

  getPublishedEntries(): ChangeLogEntry[] {
    return sortChangeLogEntries(validateChangeLogEntries(rawChangeLogEntries));
  }

  loadEditorEntries(): Observable<ChangeLogEntry[]> {
    return this.http.get<unknown>(this.editorApiUrl).pipe(
      map((value) => sortChangeLogEntries(validateChangeLogEntries(value))),
    );
  }

  saveEditorEntries(entries: ChangeLogEntry[]): Observable<ChangeLogEntry[]> {
    const validatedEntries = sortChangeLogEntries(validateChangeLogEntries(entries));
    return this.http.put<unknown>(this.editorApiUrl, validatedEntries).pipe(
      map((value) => sortChangeLogEntries(validateChangeLogEntries(value))),
    );
  }
}
