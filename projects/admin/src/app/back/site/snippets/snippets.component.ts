
import { Component } from '@angular/core';
import { RmbracketsPipe } from '../../../common/pipes/rmbrackets.pipe';
import { MENU_TITLES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { SnippetService } from '../../../common/services/snippet.service';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SnippetModalEditorComponent } from '../snippet-modal-editor/snippet-modal-editor.component';
import { FileService } from '../../../common/services/files.service';
import { map, Observable } from 'rxjs';
import { TruncatePipe } from '../../../common/pipes/truncate.pipe';

@Component({
  selector: 'app-snippets',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RmbracketsPipe, TruncatePipe],
  templateUrl: './snippets.component.html',
  styleUrl: './snippets.component.scss'
})
export class SnippetsComponent {
  snippets: Snippet[] = [];
  snippetForm!: FormGroup;
  modification_mode = false;
  menus = Object.values(MENU_TITLES);
  selected_snippet!: Snippet;
  file_paths$ !: Observable<string[]>;
  thumbnails$ !: Observable<string[]>;

  constructor(
    private snippetService: SnippetService,
    private fileService: FileService,
    private modalService: NgbModal,
    private fb: FormBuilder
  ) {
    this.snippetForm = this.fb.group({
      id: [''],
      title: ['', Validators.required],
      subtitle: ['', Validators.required],
      content: ['Contenu de l\'article'],
      template: ['', Validators.required],
      public: [true],
      rank: [0],
      image: [''],
      file: ['']
    });
  }

  ngOnInit() {

    this.file_paths$ = this.fileService.list_files('documents/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );
    this.thumbnails$ = this.fileService.list_files('images/vignettes/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );

    this.snippetService.listSnippets().subscribe((snippets) => {
      this.snippets = snippets;
    });
  }

  get form_valid() {
    return this.snippetForm.valid;
  }

  onSaveSnippet() {
    let snippet = this.snippetForm.getRawValue();
    if (this.modification_mode) {
      this.snippetService.updateSnippet(snippet).then(() => {
        this.snippetForm.reset();
        this.modification_mode = false;
      });
    } else {
      this.snippetService.createSnippet(snippet).then(() => {
        this.snippetForm.reset();
        this.modification_mode = false;
      });
    }
  }


  onSelectSnippet(snippet: Snippet) {
    this.snippetForm.patchValue(snippet);
    if (snippet.content === '') {
      this.snippetForm.patchValue({ content: ['Article vide'] });
    }
    this.modification_mode = true;
  }

  onModalEditSnippetContent() {
    const modalRef = this.modalService.open(SnippetModalEditorComponent, { centered: true });
    modalRef.componentInstance.snippet = this.snippetForm.getRawValue();
    modalRef.result.then((result) => {
      if (result) {
        this.snippetForm.patchValue(result);
      }
    });
  }

  onDeleteSnippet(snippet: Snippet) {
    this.snippetService.deleteSnippet(snippet).then(() => {
      this.snippets = this.snippets.filter(s => s.id !== snippet.id);
    });
  }

  scrollToTableEnd(table: HTMLElement) {
    setTimeout(() => {
      table.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 0);
  }
}
