import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { Article, ArticleTemplateEnum, Menu, Page, PageTemplateEnum } from '../../../../../common/menu.interface';
import { InputMenuComponent } from "../input-menu/input-menu.component";
import { CommonModule } from '@angular/common';
import { SiteLayoutService } from '../../../../../common/services/site-layout.service';
import { ToastService } from '../../../../../common/toaster/toast.service';
import { ArticlesService } from '../../../../../common/services/articles.service';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop'; // Import DragDropModule
import { combineLatest, map, Observable } from 'rxjs';
import { ArticleComponent } from '../article/article.component';
import { a } from '@aws-amplify/backend';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetAlbumComponent } from '../../modals/get-album/get-album.component';
import { S3 } from 'aws-cdk-lib/aws-ses-actions';
import { S3Item } from '../../../../../common/file.interface';
import { FileService } from '../../../../../common/services/files.service';


@Component({
    selector: 'app-page',
    imports: [CommonModule, FormsModule, ReactiveFormsModule, InputMenuComponent, DragDropModule, ArticleComponent],
    templateUrl: './page.component.html',
    styleUrl: './page.component.scss'
})
export class PageComponent implements OnInit, OnChanges {



  @Input() page!: Page;
  @Output() close = new EventEmitter<boolean>();
  filtered_articles: Article[] = [];
  selectedArticle: Article | null = null;

  path: string = '';
  album_name: string = '';
  S3Items: S3Item[] = [];
  filteredItems: S3Item[] = [];
  paths: string[] = [];
  folders: Set<string> = new Set();


  templates = PageTemplateEnum;
  templates_values: string[] = Object.values(this.templates);

  pageGroup: FormGroup = new FormGroup({
    id: new FormControl(''),
    menuId: new FormControl({ value: '', disabled: true }),
    menu: new FormControl<Menu | null>(null),
    link: new FormControl('', Validators.required),
    template: new FormControl('', Validators.required),
    rank: new FormControl({ value: 0, disabled: true }),
    member_only: new FormControl(false)
  });

  get touched() { return this.pageGroup.touched; }
  get dirty() { return this.pageGroup.dirty; }
  get template() { return this.pageGroup.get('template')?.value; }

  is_an_album(): boolean {
    let bool = this.template === PageTemplateEnum.album;
    return bool;
  }

  filtered_articles$(page_id: string): Observable<Article[]> {
    return this.articlesService.articles$.pipe(
      map((articles) => articles.filter((article) => article.pageId === page_id)),
      map((articles) => articles.sort((a, b) => a.rank - b.rank))
    );
  };

  constructor(
    private siteLayoutService: SiteLayoutService,
    private articlesService: ArticlesService,
    private toastService: ToastService,
    private modalService: NgbModal,
    private fileService: FileService


  ) { }

  ngOnInit(): void {
    this.filtered_articles$(this.page.id).subscribe((articles) => {
      // console.log('filtered articles', articles);
      this.filtered_articles = articles;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.pageGroup.patchValue(this.page);
    this.selectedArticle = null;
  }

  album_auto_fill(): void {

    this.listAlbums();
    const modalRef = this.modalService.open(GetAlbumComponent, { centered: true });
    modalRef.componentInstance.folders = this.folders;

    modalRef.result.then((selected_folder: string) => {
      if (selected_folder === null) return;
      this.filteredItems = this.S3Items.filter((item) => item.path.startsWith(selected_folder));
      console.log('selected folder', selected_folder, this.filteredItems);

      this.filteredItems.forEach(async (s3item, index) => {
        const article: Article = {
          id: '',
          title: 'photo album' + index,
          template: ArticleTemplateEnum.photo,
          content: 'photo album',
          featured: false,
          rank: index + 1,
          pageId: this.page.id,
          image: s3item.path
        };
        await this.articlesService.createArticle(article);
        console.log('article created', article.title);
      });
    });
    // console.log('Modal closed:', path);
  }


  listAlbums() {
    this.S3Items = [];
    this.fileService.list('albums/').then((data) => {
      data.forEach((item) => {
        if (item.size) {
          this.S3Items.push(item);
          let possibleFolder = item.path.split('/').slice(0, -1).join('/');
          if (possibleFolder) this.folders.add(possibleFolder);
        } else {
          this.folders.add(item.path);
        }
      });
      // this.S3Items.forEach((item) => item.url = this.fileService.getPresignedUrl(item.path));
    });
  }

  onSavePage(): void {
    const page = this.pageGroup.getRawValue();
    delete page.menu;
    // console.log(page);
    this.updatePage(page);
    this.close.emit(false);

  }

  onDeletePage(): void {
    this.siteLayoutService.deletePage(this.page).then((deletedPage) => {
    }).catch((error) => {
      console.error('page deletion error', error);
    });
    this.close.emit(true);
  }

  onDeleteArticle(article: Article): void {
    this.articlesService.deleteArticle(article.id)
      .then((deletedArticle) => { })
      .catch((error) => {
        console.error('article deletion error', error);
      });
    this.selectedArticle = null;
  }


  onCreateArticle() {
    const newArticle: Article = {
      id: '',
      title: 'New Article',
      template: ArticleTemplateEnum.default,
      content: 'Content goes here',
      featured: false,
      rank: 0,
      pageId: this.page.id
    }
    this.articlesService.createArticle(newArticle).then((article) => {
      this.selectedArticle = article;
      this.toastService.showSuccessToast('edition layout', 'Nouvel article à renseigner');
      // console.log('new article', article);
    });
  }

  submitArticle(article: Article): void {
    if (this.selectedArticle) {
      // this.toastService.showSuccessToast('edition layout', 'Article mis à jour');
      this.selectedArticle = null;
    } else {
      console.error('%s update error', article.title);
    };
  }

  updatePage(page: Page): void {
    this.siteLayoutService.updatePage(page).then((updatedPage) => {
      this.toastService.showSuccessToast('edition layout', 'Page mise à jour');
    }).catch((error) => {
      console.error('page update error', error);
    });
  }

  onDropArticle(event: CdkDragDrop<string[]>) {
    let promises: Promise<Article>[] = [];
    moveItemInArray(this.filtered_articles, event.previousIndex, event.currentIndex);
    this.filtered_articles.forEach((article, index) => {
      article.rank = index + 1;
      // console.log('article %s : %s', article.title, index);
      promises.push(this.articlesService.updateArticle(article));
    });

    const promise = combineLatest(promises).subscribe((articles) => {
      // console.log('articles updated', articles);
      this.toastService.showSuccessToast('edition layout', 'Order des articles mis à jour');
      promise.unsubscribe();
    });

  }
  onDblClick(article: Article) {
    this.selectedArticle = article;
  }
}
