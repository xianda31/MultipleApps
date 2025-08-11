import { Component } from '@angular/core';
import { RmbracketsPipe } from '../../../common/pipes/rmbrackets.pipe';
import { Snippet, SNIPPET_TEMPLATES } from '../../../common/interfaces/snippet.interface';
import { SnippetService } from '../../../common/services/snippet.service';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SnippetModalEditorComponent } from '../snippet-modal-editor/snippet-modal-editor.component';

@Component({
  selector: 'app-snippets',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RmbracketsPipe],
  templateUrl: './snippets.component.html',
  styleUrl: './snippets.component.scss'
})
export class SnippetsComponent {
  snippets: Snippet[] = [];
  snippetForm!: FormGroup;
  modification_mode = false;
  templates = Object.values(SNIPPET_TEMPLATES);
  selected_snippet!: Snippet;

  constructor(
    private snippetService: SnippetService,
    private modalService: NgbModal,
    private fb: FormBuilder
  ) {
    this.snippetForm = this.fb.group({
      id: [''],
      title: ['', Validators.required],
      subtitle: ['', Validators.required],
      content: ['Contenu de l\'article'],
      template: ['', Validators.required],
      featured: [false],
      rank: [0],
      image: ['']
    });
  }

  ngOnInit() {
    this.snippetService.listSnippets().subscribe((snippets) => {
      this.snippets = snippets
        .sort((a, b) => a.rank - b.rank)
        .sort((a, b) => a.template.localeCompare(b.template));
    });
  }

  get form_valid() {
    return this.snippetForm.valid;
  }

  onSaveSnippet() {
    let snippet = this.snippetForm.getRawValue();
    if (this.modification_mode) {
      this.snippetService.updateSnippet(snippet);
    } else {
      this.snippetService.createSnippet(snippet);
    }
    this.modification_mode = false;
    // Reset à des valeurs par défaut
    this.snippetForm.reset({
      id: '',
      title: '',
      subtitle: '',
      content: ['Contenu de l\'article'],
      template: '',
      featured: false,
      rank: 100,
      image: ''
    });
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

}
