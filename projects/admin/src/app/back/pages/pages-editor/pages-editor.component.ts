import { Component } from '@angular/core';
import { PageService } from '../../../common/services/page.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { MENU_TITLES, Page, PAGE_TEMPLATES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { CommonModule } from '@angular/common';
import { Form, FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from '../../../common/services/toast.service';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { map, switchMap } from 'rxjs';

@Component({
  selector: 'app-pages-editor',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule],
  templateUrl: './pages-editor.component.html',
  styleUrl: './pages-editor.component.scss'
})
export class PagesEditorComponent {
  pages: Page[] = [];
  snippets: Snippet[] = [];
  pagesForm !: FormGroup;
  pageTemplates = Object.values(PAGE_TEMPLATES);
  constructor(
    private pageService: PageService,
    private snippetService: SnippetService,
    private fb: FormBuilder,
    private toastService: ToastService
  ) {
    this.pagesForm = this.fb.group({
      pagesArray: this.fb.array([])   // pour eviter les erreurs DOM à l'initialisation
    });
    }
  
  ngOnInit(): void {
    this.pageService.listPages().pipe(
      map(pages =>{
        this.pages = pages;
        this.addMandatoryPages();
      }),
      switchMap(() => this.snippetService.listSnippets())
    )
    .subscribe((snippets: Snippet[]) => {
      this.snippets = snippets;
      this.pages.forEach(page => {
        page.snippets = this.getPageSnippets(page);
        page.snippet_ids = page.snippets.map(snippet => snippet.id);
      });
      this.initFormArray(this.pages);
    });
  }



//getters
get pagesFormArray(): FormArray {
  return this.pagesForm.get('pagesArray') as FormArray;
}
get pageGroups(): FormGroup[] {
  return this.pagesFormArray.controls as FormGroup[];
}

initFormArray(pages: Page[]): void {
  
  this.pagesForm = this.fb.group({
      pagesArray: this.fb.array(pages.map(page => this.fb.group({
        touched: [false],
        id: [page.id],
        title: [page.title],
        template: [page.template],
        snippet_ids: [page.snippet_ids || []],
        snippets: [page.snippets || []]
      })))
    });
  }
    
    
  getPageSnippets(page : Page): Snippet[] {
    return this.snippets.filter(snippet => snippet.template === page.title);
  }
  addMandatoryPages(): void {
    const requiredTitles = Object.values(MENU_TITLES);
    requiredTitles.forEach(title => {
      const pageExists = this.pages.some(page => page.title === title);
      if (!pageExists) {
        this.pages.push({
          id: '',
          title: title,
          template: PAGE_TEMPLATES.X_DEFAULT,
          snippet_ids: []
        });
      }
    });
  }

  savePage(pageGroup: FormGroup): void {

    const isNew = pageGroup.get('id')?.value === '';
    let page: Page = {
      id: pageGroup.get('id')?.value,
      title: pageGroup.get('title')?.value,
      template: pageGroup.get('template')?.value,
      snippet_ids: pageGroup.get('snippet_ids')?.value
    };

    console.log( isNew ? 'Creating new page' : 'Updating existing page', page);

    if(isNew) {
      this.pageService.createPage(page).then(() => {
        this.toastService.showSuccess('Pages', 'Page créée avec succès');
      });
    } else {
      this.pageService.updatePage(page).then(() => {
        this.toastService.showSuccess('Pages', 'Page mise à jour avec succès');
      });
    }
  }

}