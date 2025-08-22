import { Component, WritableSignal, Signal, signal } from '@angular/core';
import { PageService } from '../../../common/services/page.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { MENU_TITLES, Page, PAGE_TEMPLATES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../common/services/toast.service';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { combineLatest, map, Observable, take, timer } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SnippetModalEditorComponent } from '../../site/snippet-modal-editor/snippet-modal-editor.component';
import { FileService } from '../../../common/services/files.service';
import {CdkDrag,CdkDropList, CdkDragDrop, moveItemInArray} from '@angular/cdk/drag-drop';


@Component({
  selector: 'app-pages-editor',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule, CdkDrag,CdkDropList],
  templateUrl: './pages-editor.component.html',
  styleUrl: './pages-editor.component.scss'
})
export class PagesEditorComponent {
  pages: Page[] = [];
  snippets: Snippet[] = [];
  selected_snippet: Snippet | null = null;
  selected_snippet_image: string = '';
  selected_snippet_file: string = '';

  view_snippet = signal<boolean>(true);
  freeze_view_snippet = signal<boolean>(false);

  pagesForm !: FormGroup;
  pageTemplates = Object.values(PAGE_TEMPLATES);

  newSnippetForm !: FormGroup;

  file_paths$ !: Observable<string[]>;
  thumbnails$ !: Observable<string[]>;

  constructor(
    private pageService: PageService,
    private snippetService: SnippetService,
    private fb: FormBuilder,
    private toastService: ToastService,
    private modalService: NgbModal,
    private fileService: FileService
  ) {
    this.pagesForm = this.fb.group({
      pagesArray: this.fb.array([])   // pour eviter les erreurs DOM à l'initialisation
    });
  }

  ngOnInit(): void {

    this.newSnippetForm = this.fb.group({
      title: ['', Validators.required],
      subtitle: ['', Validators.required],
      content: [''],
      image_url: [''],
      file: [''],
      public: [true]
    });

    this.file_paths$ = this.fileService.list_files('documents/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );
    this.thumbnails$ = this.fileService.list_files('images/vignettes/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );


    this.pageService.listPages().pipe(take(1)).subscribe(pages => {

      // check if all mandatory pages exist

      const requiredTitles = Object.values(MENU_TITLES);
      requiredTitles.forEach(title => {
        const pageExists = pages.some(page => page.title === title);
        if (!pageExists) {
          this.pageService.createPage({
            id: '',
            title: title,
            template: PAGE_TEMPLATES.X_DEFAULT,
            snippet_ids: []
          });
          this.toastService.showInfo('Pages', `La page "${title}" manquait, et à été créée`);
        }
      });
      // subscribe "normally"

      combineLatest([this.pageService.listPages(), this.snippetService.listSnippets()])
        .subscribe(([pages, snippets]) => {
          this.pages = pages;
          this.snippets = snippets;
          this.pages.forEach(page => {
            page.snippets = this.getPageSnippets(page);
            // page.snippet_ids = page.snippets.map(snippet => snippet.id);
          });
          this.initFormArray(this.pages);
        });
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


  getPageSnippets(page: Page): Snippet[] {
    return page.snippet_ids.map(id => this.snippets.find(snippet => snippet.id === id)).filter((s): s is Snippet => s !== undefined);
  }


  savePage(pageGroup: FormGroup): void {

    const isNew = pageGroup.get('id')?.value === '';
    let page: Page = {
      id: pageGroup.get('id')?.value,
      title: pageGroup.get('title')?.value,
      template: pageGroup.get('template')?.value,
      snippet_ids: pageGroup.get('snippet_ids')?.value
    };

    if (isNew) {
      this.pageService.createPage(page).then(() => {
        this.toastService.showSuccess('Pages', 'Page créée avec succès');
      });
    } else {
      this.pageService.updatePage(page).then(() => {
        this.toastService.showSuccess('Pages', 'Page mise à jour avec succès');
      });
    }
  }

  addSnippet(pageGroup: FormGroup) {
    if (this.newSnippetForm.valid) {
      const snippet: Snippet = {
        id: '',
        title: this.newSnippetForm.get('title')?.value,
        subtitle: this.newSnippetForm.get('subtitle')?.value,
        content: '<p>Nouvelle vignette</p>',
        file: this.newSnippetForm.get('file')?.value,
        image: this.newSnippetForm.get('image_url')?.value,
        public: this.newSnippetForm.get('public')?.value,

        template: 'n/a',
        rank: 'n/a',
      };
      this.snippetService.createSnippet(snippet).then((new_snippet) => {
        this.toastService.showSuccess('Snippets', 'Snippet créé avec succès');
        pageGroup.get('snippets')?.value.push(new_snippet);
        pageGroup.get('snippet_ids')?.value.push(new_snippet.id);
        this.savePage(pageGroup);
        this.newSnippetForm.reset();
      });
    }
  }

  onSnippetClick(snippet: Snippet) {
    this.selected_snippet = snippet || null;
    this.freeze_view_snippet.set(true);
  }

  toggleFreezeViewSnippet() {
    this.freeze_view_snippet.set(!this.freeze_view_snippet());
  }

  onHover(snippet?: Snippet) {
    if(this.selected_snippet?.id !== snippet?.id && !this.freeze_view_snippet()) {
      this.selected_snippet = snippet || null;
      // armer un timer qui etendra la visibilité du snippet
      this.view_snippet.set(true);
      setTimeout(() => {
        this.view_snippet.set(false);
      }, 5000);
    }
  }


  onSnippetContentClick(snippet: Snippet) {
    const modalRef = this.modalService.open(SnippetModalEditorComponent, { centered: true });
    modalRef.componentInstance.snippet = snippet;
    modalRef.result.then((result) => {
      console.log('Snippet content modified:', result);
      if (result) {
        this.selected_snippet = result;
        this.snippetService.updateSnippet(result)
          .then(() => { })
          .catch(error => {
            console.error('Error updating snippet:', error);
          });
      }
    });
  }

  onImageChange() {
    console.log('Image changed:', this.selected_snippet_image);
    if (this.selected_snippet) {
      this.selected_snippet.image = this.selected_snippet_image;
      this.snippetService.updateSnippet(this.selected_snippet)
        .then((snippet) => {
          this.selected_snippet_image = '';
          this.selected_snippet = snippet; // force refresh
        })
        .catch(error => {
          console.error('Error updating snippet:', error);
        });
    }
  }

  onFileChange() {
    console.log('File changed:', this.selected_snippet_file);
    if (this.selected_snippet) {
      this.selected_snippet.file = this.selected_snippet_file;
      this.snippetService.updateSnippet(this.selected_snippet)
        .then((snippet) => {
          this.selected_snippet_file = '';
          this.selected_snippet = snippet; // force refresh
        })
        .catch(error => {
          console.error('Error updating snippet:', error);
        });
      }
    }

    onPublicChange() {
      if (this.selected_snippet) {
        // this.selected_snippet.public = !this.selected_snippet.public;
        this.snippetService.updateSnippet(this.selected_snippet)
          .then((snippet) => {
            this.selected_snippet = snippet; // force refresh
          })
          .catch(error => {
            console.error('Error updating snippet:', error);
          });
      }
    }

    // drag and drop handling

    dropSnippet(event: CdkDragDrop<Snippet[]>, pageIndex: number) {
      const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
      if (snippets) {
        moveItemInArray(snippets, event.previousIndex, event.currentIndex);
        this.pageGroups[pageIndex].get('snippets')?.setValue(snippets);
        this.updateSnippetList(pageIndex);
      }
    }

    binSnippet(event: CdkDragDrop<Snippet[]>, pageIndex: number) {
      const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
      if (snippets) {
        const removed = snippets.splice(event.previousIndex, 1);
        this.pageGroups[pageIndex].get('snippets')?.setValue(snippets);
        this.updateSnippetList(pageIndex);
      }
    }

    updateSnippetList(pageIndex: number) {
      const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
      const snippet_ids = snippets.map((s: Snippet) => s.id);
      this.pageGroups[pageIndex].get('snippet_ids')?.setValue(snippet_ids);
      this.savePage(this.pageGroups[pageIndex]);
    }
  }