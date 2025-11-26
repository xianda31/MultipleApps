import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Snippet } from '../../../common/interfaces/page_snippet.interface';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SnippetService } from '../../../common/services/snippet.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SnippetModalEditorComponent } from '../../site/snippet-modal-editor/snippet-modal-editor.component';
import { map, Observable } from 'rxjs';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-snippet-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './snippet-editor.html',
  styleUrl: './snippet-editor.scss'
})
export class SnippetEditor {
  @Input() snippet !: Snippet;

  file_paths$ !: Observable<string[]>;
  thumbnails$ !: Observable<string[]>;
  albums$ !: Observable<string[]>;

  constructor(
    private snippetService: SnippetService,
    private modalService: NgbModal,
    private fileService: FileService,
    private sanitizer: DomSanitizer


  ) { }

  ngOnInit(): void {

    console.log('SnippetEditor initialized with snippet:', this.snippet.featured);

    // Initialize publishedAt from updatedAt (ISO) converted to YYYY-MM-DD
    if (!this.snippet.publishedAt) {
      this.snippet.publishedAt = this.toDateInputValue(this.snippet.updatedAt) || '';
    }

    this.albums$ = this.fileService.list_folders(S3_ROOT_FOLDERS.ALBUMS + '/');

    this.thumbnails$ = this.fileService.list_files(S3_ROOT_FOLDERS.IMAGES + '/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );
    this.file_paths$ = this.fileService.list_files(S3_ROOT_FOLDERS.DOCUMENTS + '/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );
  }


  saveSnippetSelected() {
    if (!this.snippet) return;
    console.log('Saving snippet:', this.snippet.featured);
    const payload: any = { ...this.snippet };
    console.log('Saving payload:', payload.featured);
    this.snippetService.updateSnippet(payload)
      .then((updatedSnippet) => {
        this.snippet = updatedSnippet;
      })
      .catch(error => {
        console.error('Error updating snippet:', error);
      });
  }

  // Ensure toggles apply the new value before saving: ngModelChange provides the
  // new value as $event but the two-way binding may not have updated the
  // underlying object yet when a handler runs. Apply explicitly and then save.
  onToggle(field: keyof Snippet, value: any) {
    if (!this.snippet) return;
    (this.snippet as any)[field] = value;
    this.saveSnippetSelected();
  }

  onSnippetContentClick(snippet: Snippet) {
    const modalRef = this.modalService.open(SnippetModalEditorComponent, { centered: true });
    modalRef.componentInstance.snippet = snippet;
    modalRef.result.then((result) => {
      if (!result) return;
      this.snippet = result;
      this.saveSnippetSelected();
    });
  }

    stringToSafeHtml(htmlString: string) {
    return this.sanitizer.bypassSecurityTrustHtml(htmlString) ;
  }

  private toDateInputValue(value: any): string | undefined {
    if (!value) return undefined;
    const d = (value instanceof Date) ? value : new Date(value);
    if (isNaN(d.getTime())) return undefined;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }


}
