 

import { Component, signal } from '@angular/core';
import { ViewChild, ElementRef } from '@angular/core';
import { PageService } from '../../../common/services/page.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { MENU_TITLES, Page, PAGE_TEMPLATES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from '../../../common/services/toast.service';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { combineLatest, take } from 'rxjs';
import { CdkDrag, CdkDropList, CdkDragDrop, moveItemInArray, transferArrayItem, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { SnippetEditor } from '../snippet-editor/snippet-editor';


@Component({
  selector: 'app-pages-editor',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SnippetEditor, NgbModule, CdkDrag, CdkDropList, CdkDropListGroup],
  templateUrl: './pages-editor.component.html',
  styleUrl: './pages-editor.component.scss'
})
export class PagesEditorComponent {
  @ViewChild('scrollable') scrollable!: ElementRef;

  resolution_too_small = false;

  pages: Page[] = [];

  snippets: Snippet[] = [];
  selected_snippet: Snippet | null = null;

  view_snippet = signal<boolean>(true);
  snippetFreezed: boolean = false;
  show_trash = false;

  pagesForm !: FormGroup;
  pageTemplates = Object.values(PAGE_TEMPLATES);
  pageTitles = Object.values(MENU_TITLES);
  pageTitles_but_BIN = this.pageTitles.filter(title => title !== MENU_TITLES.POUBELLE);
  selected_pageTitle: string | null = null;
  bin_page_index: number | null = null;
  bin_empty: boolean = false;


  constructor(
    private pageService: PageService,
    private snippetService: SnippetService,
    private fb: FormBuilder,
    private toastService: ToastService,
  ) {
    this.pagesForm = this.fb.group({
      pagesArray: this.fb.array([])   // pour eviter les erreurs DOM à l'initialisation
    });
  }


  ngOnInit(): void {


    this.pageService.listPages().pipe(take(1)).subscribe(pages => {
      // check if all mandatory pages exist
      this.pageTitles.forEach(title => {
        const pageExists = pages.some(page => page.title === title);
        if (!pageExists) {
          this.pageService.createPage({
            id: '',
            title: title,
            template: PAGE_TEMPLATES.PUBLICATION,
            snippet_ids: [],
          });
          this.toastService.showInfo('Pages', `La page "${title}" manquait, et a été créée`);
        }
      });
      // subscribe "normally"
      combineLatest([this.pageService.listPages(), this.snippetService.listSnippets()])
        .subscribe(([pages, snippets]) => {
          this.pages = pages;
          this.snippets = snippets;
          this.pages.forEach(page => {
            page.snippets = this.getPageSnippets(page);
          });
          // force bin_page to be the last page
          const binPage = this.pages.find(page => page.title === MENU_TITLES.POUBELLE);
          if (binPage) {
            this.pages = this.pages.filter(page => page !== binPage).concat(binPage);
          }
          this.bin_page_index = this.pages.findIndex(page => page.title === MENU_TITLES.POUBELLE);

          this.check_bin_empty();
          this.initFormArray(this.pages);
        });
    });
  }



  get dropListIds(): string[] {
    // On ne garde que les pages effectivement affichées (hors corbeille si masquée)
    const ids: string[] = [];
    this.pageGroups.forEach((page, i) => {
      // Si la page est la corbeille et qu'elle n'est pas affichée, on saute
      if (this.is_trash_page(page) && !this.show_trash) return;
      // si la page est la page sélectionnée (ou si aucune n'est sélectionnée), on l'ajoute
      if (this.is_trash_page(page) || page.get('title')?.value === this.selected_pageTitle) {
        ids.push('dropList_' + i);
      }
    });
    return ids;
  }

  get pagesFormArray(): FormArray {
    return this.pagesForm.get('pagesArray') as FormArray;
  }
  get pageGroups(): FormGroup[] {
    return this.pagesFormArray.controls as FormGroup[];
  }

  is_trash_page(page: FormGroup): boolean {
    return page.get('title')?.value === MENU_TITLES.POUBELLE;
  }

  check_bin_empty(): void {
    const bin = this.pages.find(page => page.title === MENU_TITLES.POUBELLE);
    const empty = bin ? bin.snippet_ids.length === 0 : false;
    this.bin_empty = empty;
    // return empty;
  }

  initFormArray(pages: Page[]): void {
    this.pagesForm = this.fb.group({
      pagesArray: this.fb.array(pages.map(page => this.fb.group({
        id: [page.id],
        title: [page.title],
        template: [page.template],
        snippet_ids: [page.snippet_ids || []],
        snippets: [page.snippets || []]
      })))
    });
  }


  getPageSnippets(page: Page): Snippet[] {
    const snippets = page.snippet_ids
      .map(id => this.snippets.find(snippet => snippet.id === id))
      .filter((s): s is Snippet => s !== undefined);
    return snippets ?? [];
  }


  savePage(pageGroup: FormGroup): void {
    const isNew = pageGroup.get('id')?.value === '';
    let page: Page = {
      id: pageGroup.get('id')?.value,
      title: pageGroup.get('title')?.value,
      template: pageGroup.get('template')?.value,
      snippet_ids: pageGroup.get('snippet_ids')?.value
    };

    (isNew ? this.pageService.createPage(page) : this.pageService.updatePage(page))
      .then(() => { });
  }


  
  onPageTitleChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    select.blur();
    this.selected_snippet = null;
    this.snippetFreezed = false;
    
  }

  emptyBin() {
    const bin = this.pages.find(page => page.title === MENU_TITLES.POUBELLE);
    if (bin) {
      const toDelete = bin.snippets || [];
      bin.snippet_ids = [];
      delete bin.snippets;
      this.pageService.updatePage(bin).then(() => {
        this.toastService.showSuccess('Pages', 'Corbeille vidée');
        toDelete.forEach(async snippet => {
          await this.snippetService.deleteSnippet(snippet);
          console.log('Snippet deleted:', snippet.title);
        });
      });
    }
    this.bin_empty = true;
  }



  onSnippetClick(snippet: Snippet) {
    this.selected_snippet = snippet || null;
    this.snippetFreezed = true;
  }

  onHover(snippet?: Snippet) {
    if (this.selected_snippet?.id !== snippet?.id && !this.snippetFreezed) {
      this.selected_snippet = snippet || null;
      // armer un timer qui etendra la visibilité du snippet
      this.view_snippet.set(true);
      setTimeout(() => {
        this.view_snippet.set(false);
      }, 5000);
    }
  }


  // drag and drop handling

  dropSnippet(event: CdkDragDrop<Snippet[]>, pageIndex: number) {
    const originId = event.previousContainer.id; // origin dropList id
    const originPageIndex = +originId.split('_')[1]; // extract pageIndex from id
    if (event.previousContainer === event.container) {
      // Moved within the same list
      const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
      if (snippets) {
        moveItemInArray(snippets, event.previousIndex, event.currentIndex);
        this.pageGroups[pageIndex].get('snippets')?.setValue(snippets);
        this.updateSnippetList(pageIndex);
      }
    } else {
      // Moved between lists
      const originSnippets = this.pageGroups[originPageIndex].get('snippets')?.value;
      const targetSnippets = this.pageGroups[pageIndex].get('snippets')?.value;
      if (originSnippets && targetSnippets) {
        transferArrayItem(
          originSnippets,
          targetSnippets,
          event.previousIndex,
          event.currentIndex
        );


        this.pageGroups[originPageIndex].get('snippets')?.setValue(originSnippets);
        this.updateSnippetList(originPageIndex);
        this.pageGroups[pageIndex].get('snippets')?.setValue(targetSnippets);
        this.updateSnippetList(pageIndex).then(() => {

          console.log('snippet moved from %s to %s',
            this.pageGroups[originPageIndex].get('title')?.value,
            this.pageGroups[pageIndex].get('title')?.value
          );

          this.check_bin_empty();


        });

      }
    }
  }


  cutSnippet(pageIndex: number, snippet: Snippet) {
    this.addSnippet(this.bin_page_index!, snippet);
    this.rmSnippet(pageIndex, snippet);
    this.check_bin_empty();
  }

  async updateSnippetList(pageIndex: number) {
    const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
    const snippet_ids = snippets.map((s: Snippet) => s.id);
    this.pageGroups[pageIndex].get('snippet_ids')?.setValue(snippet_ids);
    await this.savePage(this.pageGroups[pageIndex]);
  }

  rmSnippet(pageIndex: number, snippet: Snippet) {
    const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
    const index = snippets.findIndex((s: Snippet) => s.id === snippet.id);
    if (index === -1) { throw new Error('Snippet not found'); }
    snippets.splice(index, 1);
    this.pageGroups[pageIndex].get('snippets')?.setValue(snippets);
        this.updateSnippetList(pageIndex);

  }
  addSnippet(pageIndex: number, snippet: Snippet) {
    const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
    snippets.push(snippet);
    this.pageGroups[pageIndex].get('snippets')?.setValue(snippets);
    this.updateSnippetList(pageIndex);
  }

  deleteSnippet(pageIndex: number, snippet: Snippet) {
    const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
    const index = snippets.findIndex((s: Snippet) => s.id === snippet.id);
    if (index === -1) { throw new Error('Snippet not found'); }
    snippets.splice(index, 1);
    this.pageGroups[pageIndex].get('snippets')?.setValue(snippets);
    this.updateSnippetList(pageIndex);
    this.snippetService.deleteSnippet(snippet).then(() => {
      this.toastService.showSuccess('Pages', ` "${snippet.title}" a été supprimé définitivement`);
    });
    this.check_bin_empty();
  }

  addWhiteSnippet(pageGroup: FormGroup) {
    const snippet: Snippet = {
      id: '',
      title: 'title',
      subtitle: 'subtitle',
      content: '<p>Nouvelle vignette</p>',
      file: '',
      image: '',
      folder: '',
      featured: false,
      public: true,
    };
    this.snippetService.createSnippet(snippet).then((new_snippet) => {
      pageGroup.get('snippets')?.value.push(new_snippet);
      pageGroup.get('snippet_ids')?.value.push(new_snippet.id);
      this.savePage(pageGroup);
      this.onSnippetClick(new_snippet);
    });
  }
}
