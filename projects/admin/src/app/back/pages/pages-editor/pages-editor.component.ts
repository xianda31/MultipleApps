
import { Component, signal } from '@angular/core';
import { ViewChild, ElementRef } from '@angular/core';
import { PageService } from '../../../common/services/page.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { MENU_TITLES, Page, PAGE_TEMPLATES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../common/services/toast.service';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { combineLatest, map, Observable, take, tap } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SnippetModalEditorComponent } from '../../site/snippet-modal-editor/snippet-modal-editor.component';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { CdkDrag, CdkDropList, CdkDragDrop, moveItemInArray, transferArrayItem, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { FileSystemNode } from '../../../common/interfaces/file.interface';


@Component({
  selector: 'app-pages-editor',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbModule, CdkDrag, CdkDropList, CdkDropListGroup],
  templateUrl: './pages-editor.component.html',
  styleUrl: './pages-editor.component.scss'
})
export class PagesEditorComponent {
  @ViewChild('scrollable') scrollable!: ElementRef;

  resolution_too_small = false;

  pages: Page[] = [];
  bin_page_index: number | null = null;

  snippets: Snippet[] = [];
  selected_snippet: Snippet | null = null;

  ctrlPressed = false;

  view_snippet = signal<boolean>(true);
  freeze_view_snippet = signal<boolean>(false);
  show_trash = false;

  pagesForm !: FormGroup;
  pageTemplates = Object.values(PAGE_TEMPLATES);

  fileSystemNode !: FileSystemNode;
  file_paths$ !: Observable<string[]>;
  thumbnails$ !: Observable<string[]>;
  albums$ !: Observable<string[]>;


  current_node_childs = signal<FileSystemNode | null>(null);
  // node_stack: FileSystemNode[] = [];
  // returned_value : any;

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
    window.addEventListener('keydown', this.ctrlKeyListener, true);
    window.addEventListener('keyup', this.ctrlKeyListener, true);
    
    
    if (window.innerWidth < 768) {
      this.resolution_too_small = true;
    }

    this.file_paths$ = this.fileService.list_files(S3_ROOT_FOLDERS.DOCUMENTS + '/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );

    this.thumbnails$ = this.fileService.list_files(S3_ROOT_FOLDERS.IMAGES + '/').pipe(
      map((S3items) => S3items.map(item => item.path))
    );

    this.albums$ = this.fileService.list_folders(S3_ROOT_FOLDERS.ALBUMS + '/');

    this.pageService.listPages().pipe(take(1)).subscribe(pages => {
      // check if all mandatory pages exist
      const requiredTitles = Object.values(MENU_TITLES);
      requiredTitles.forEach(title => {
        const pageExists = pages.some(page => page.title === title);
        if (!pageExists) {
          this.pageService.createPage({
            id: '',
            title: title,
            template: PAGE_TEMPLATES.PUBLICATIONS,
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
          // force bin_page to be the first page
          const binPage = this.pages.find(page => page.title === MENU_TITLES.POUBELLE);
          if (binPage) {
            this.pages = [binPage].concat(this.pages.filter(page => page !== binPage));
          }
          this.bin_page_index = this.pages.findIndex(page => page.title === MENU_TITLES.POUBELLE);
          
          this.initFormArray(this.pages);
        });
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.ctrlKeyListener, true);
    window.removeEventListener('keyup', this.ctrlKeyListener, true);
  }

  ctrlKeyListener = (event: KeyboardEvent) => {
    this.ctrlPressed = event.ctrlKey;
  };

 
  //getters

  getNextSnippetGroup(page: FormGroup): FormGroup {
    return page.get('next_snippet') as FormGroup;
  }
  get dropListIds(): string[] {
    // On ne garde que les pages effectivement affichées (hors corbeille si masquée)
    const ids: string[] = ['trash_'];
    this.pageGroups.forEach((page, i) => {
      // Si la page est la corbeille et qu'elle n'est pas affichée, on saute
      if (this.is_trash_page(page) && !this.show_trash) return;
      ids.push('dropList_' + i);
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

  is_trash_empty(): boolean {
    const bin = this.pages.find(page => page.title === MENU_TITLES.POUBELLE);
    return bin ? bin.snippet_ids.length === 0 : false;
  }

  initFormArray(pages: Page[]): void {

    this.pagesForm = this.fb.group({
      pagesArray: this.fb.array(pages.map(page => this.fb.group({
        id: [page.id],
        title: [page.title],
        template: [page.template],
        snippet_ids: [page.snippet_ids || []],
        snippets: [page.snippets || []],
        next_snippet: this.fb.group({
          next_title: ['', Validators.required],
          next_subtitle: ['', Validators.required]
        })
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
  }


  addSnippet(pageGroup: FormGroup) {
    if (!pageGroup.get('next_snippet')?.valid) { return; }
    const nextSnippetGroup = pageGroup.get('next_snippet');
    if (!nextSnippetGroup) { return; }

    const snippet: Snippet = {
      id: '',
      title: nextSnippetGroup.get('next_title') ? nextSnippetGroup.get('next_title')?.value : '',
      subtitle: nextSnippetGroup.get('next_subtitle') ? nextSnippetGroup.get('next_subtitle')?.value : '',
      content: '<p>Nouvelle vignette</p>',
      file: '',
      image: '',
      folder: '',
      featured: false,
      public: true,
    };
    this.snippetService.createSnippet(snippet).then((new_snippet) => {
      // this.toastService.showSuccess('Snippets', 'Snippet créé avec succès');
      pageGroup.get('snippets')?.value.push(new_snippet);
      pageGroup.get('snippet_ids')?.value.push(new_snippet.id);
      this.savePage(pageGroup);

      nextSnippetGroup.reset();

    });
  }

  onSnippetClick(snippet: Snippet) {
    this.selected_snippet = snippet || null;
    this.freeze_view_snippet.set(true);
  }

  toggleFreezeViewSnippet() {
    this.freeze_view_snippet.set(!this.freeze_view_snippet());
  }

  onHover(snippet?: Snippet) {
    if (this.selected_snippet?.id !== snippet?.id && !this.freeze_view_snippet()) {
      this.selected_snippet = snippet || null;
      // armer un timer qui etendra la visibilité du snippet
      this.view_snippet.set(true);
      setTimeout(() => {
        this.view_snippet.set(false);
      }, 5000);
    }
  }

  saveSnippetSelected() {
    if (!this.selected_snippet) return;
    this.snippetService.updateSnippet(this.selected_snippet)
      .then((updatedSnippet) => {
        this.selected_snippet = updatedSnippet;
      })
      .catch(error => {
        console.error('Error updating snippet:', error);
      });
  }


  onSnippetContentClick(snippet: Snippet) {
    const modalRef = this.modalService.open(SnippetModalEditorComponent, { centered: true });
    modalRef.componentInstance.snippet = snippet;
    modalRef.result.then((result) => {
      this.selected_snippet = result;
      this.saveSnippetSelected();
    });
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
        if (this.ctrlPressed) {
          // COPY: créer un vrai nouveau snippet
          const original = originSnippets[event.previousIndex];
          const copy: Snippet = {
           id: '',
           title: original.title ,
           subtitle: original.subtitle,
           content: original.content,
           public: original.public,
           file: original.file, 
           image: original.image,
           folder: original.folder,
            featured: original.featured,
           //
          };
          this.snippetService.createSnippet(copy)
          .then((new_snippet) => {
            targetSnippets.splice(event.currentIndex, 0, new_snippet);
            this.pageGroups[pageIndex].get('snippets')?.setValue(targetSnippets);
            this.updateSnippetList(pageIndex);
          })
          .catch(error => {
            console.error('Error copying snippet:', error);
          });
        } else {
          // MOVE: comportement normal
          transferArrayItem(
            originSnippets,
            targetSnippets,
            event.previousIndex,
            event.currentIndex
          );
          this.pageGroups[originPageIndex].get('snippets')?.setValue(originSnippets);
          this.updateSnippetList(originPageIndex);
          this.pageGroups[pageIndex].get('snippets')?.setValue(targetSnippets);
          this.updateSnippetList(pageIndex);
        }
      }
    }
  }

  binSnippet(event: CdkDragDrop<Snippet[]>) {
    const originId = event.previousContainer.id; // origin dropList id
    const pageIndex = +originId.split('_')[1]; // extract pageIndex from id
    const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
    if (!snippets) { throw new Error('No snippets found'); }
    const binSnippets = this.pageGroups[this.bin_page_index!].get('snippets')?.value;
    if (!binSnippets) { throw new Error('No bin snippets found'); }

    const removed = snippets.splice(event.previousIndex, 1)[0];
    binSnippets.push(removed);
    this.pageGroups[pageIndex].get('snippets')?.setValue(snippets);

    this.updateSnippetList(pageIndex);
    this.updateSnippetList(this.bin_page_index!);
  }


  updateSnippetList(pageIndex: number) {
    const snippets = this.pageGroups[pageIndex].get('snippets')?.value;
    const snippet_ids = snippets.map((s: Snippet) => s.id);
    this.pageGroups[pageIndex].get('snippet_ids')?.setValue(snippet_ids);
    this.savePage(this.pageGroups[pageIndex]);
  }


  forceScrollDown(event?: any): void {
    if (this.scrollable && this.scrollable.nativeElement) {
      const el = this.scrollable.nativeElement;
      // scroll down if near bottom or pointer near bottom
      const pointerY = event?.pointerPosition?.y ?? 0;
      const bottomEdge = el.getBoundingClientRect().bottom;
      if (
        el.scrollHeight - el.scrollTop - el.clientHeight < 60 ||
        (pointerY > bottomEdge - 60)
      ) {
        el.scrollTop = el.scrollHeight;
      }
      // scroll up if near top
      if (event && event.pointerPosition && event.pointerPosition.y - el.getBoundingClientRect().top < 60) {
        el.scrollTop = Math.max(0, el.scrollTop - 60);
      }
    }
  }
}