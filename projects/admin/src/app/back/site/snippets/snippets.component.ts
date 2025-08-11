import { Component } from '@angular/core';
import { Snippet, SNIPPET_TEMPLATES } from '../../../common/interfaces/snippet.interface';
import { SnippetService } from '../../../common/services/snippet.service';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SnippetEditorComponent } from "../snippet-editor/snippet-editor.component";

@Component({
  selector: 'app-snippets',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SnippetEditorComponent],
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
  private fb: FormBuilder
  ) {
    this.snippetForm = this.fb.group({
      id: [''],
      title: [''],
      subtitle: [''],
      content: [''],
      template: [''],
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

onCreateSnippet() {
    let new_snippet = this.snippetForm.getRawValue();
    this.snippetService.createSnippet(new_snippet);
    this.snippetForm.reset();
    this.snippet_selected = false;
  }

  onReadSnippet(snippet: Snippet) {
    this.snippetForm.patchValue(snippet);
    this.snippet_selected = true;
  }
  onEditSnippet() {
    this.selected_snippet = this.snippetForm.getRawValue();
  }

  onModSnippet(snippet: Snippet) {
    // console.log('mod snippet', snippet);
    this.snippetService.updateSnippet(snippet);

  }
  onUpdateSnippet() {
    let snippet = this.snippetForm.getRawValue();
    this.snippetService.updateSnippet(snippet);
    this.snippet_selected = false;
    this.snippetForm.reset();
  }

  onDeleteSnippet(snippet: Snippet) {
    this.snippetService.deleteSnippet(snippet);
    this.snippet_selected = false;
    // let { ...deleted_snippet } = snippet;
    this.snippetForm.patchValue(snippet);   // permet de réafficher le produit supprimé
  }

  onSnippetChange(snippet: Snippet | null): void {
    if (snippet) {
      this.selected_snippet = snippet;
      console.log('Snippet changed:', JSON.stringify(snippet));
      this.snippetService.updateSnippet(snippet);
    this.snippet_selected = false;
    this.snippetForm.reset();
    }
  }

}
