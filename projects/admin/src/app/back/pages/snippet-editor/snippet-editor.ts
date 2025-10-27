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
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './snippet-editor.html',
  styleUrl: './snippet-editor.scss'
})
export class SnippetEditor {
  @Input() snippet !: Snippet;
  // @Input() snippetFreezed : boolean = false;
  // @Output() snippetFreezedChange = new EventEmitter<boolean>();

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
    this.snippetService.updateSnippet(this.snippet)
      .then((updatedSnippet) => {
        this.snippet = updatedSnippet;
      })
      .catch(error => {
        console.error('Error updating snippet:', error);
      });
  }

  //  toggleFreezeViewSnippet() {
  //    this.snippetFreezed = !this.snippetFreezed;
  //   this.snippetFreezedChange.emit(this.snippetFreezed);
  // }
  // onSnippetFreezeChange(freezed: boolean) {
  //   this.snippetFreezed = freezed;
  // }

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

}
