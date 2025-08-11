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
  snippet_selected = false;
  templates = Object.values(SNIPPET_TEMPLATES);
  selected_snippet!: Snippet;

  constructor(
    private snippetService: SnippetService,
    private modalService: NgbModal,
    private fb: FormBuilder
  ) {
    this.snippetForm = this.fb.group({
      id: [''],
      title: ['',Validators.required],
      subtitle: ['',Validators.required],
      content: ['Contenu de l\'article'],
      template: ['',Validators.required],
      featured: [false],
      rank: [0],
      image: ['']
    });
  }

  ngOnInit() {
    this.snippetService.listSnippets().subscribe((snippets) => {
      this.snippets = snippets;
    });
  }

  get form_valid() {
    return this.snippetForm.valid;
  }

  onSaveSnippet() {
     let snippet = this.snippetForm.getRawValue();
     if(this.snippet_selected) {
       this.snippetService.updateSnippet(snippet);
     } else {
       this.snippetService.createSnippet(snippet);
     }
    this.snippet_selected = false;
    this.snippetForm.reset();
  }


  onSelectSnippet(snippet: Snippet) {
    this.snippetForm.patchValue(snippet);
    this.snippet_selected = true;
  }
  
  onModalEditSnippetContent() {
    const modalRef = this.modalService.open(SnippetModalEditorComponent,{centered: true});
    modalRef.componentInstance.snippet = this.snippetForm.getRawValue();
    modalRef.result.then((result) => {
      console.log('Modal result:', result);
      if (result) {
        this.snippetForm.patchValue(result);
      }
    });
  }


  onDeleteSnippet(snippet: Snippet) {
    this.snippetService.deleteSnippet(snippet);
    this.snippet_selected = false;
    this.snippetForm.patchValue(snippet);   
  }


}
