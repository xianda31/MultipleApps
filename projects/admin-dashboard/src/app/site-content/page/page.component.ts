import { Component, EventEmitter, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
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


@Component({
  selector: 'app-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputMenuComponent, DragDropModule, ArticleComponent],
  templateUrl: './page.component.html',
  styleUrl: './page.component.scss'
})
export class PageComponent implements OnInit, OnChanges {

  @Input() page!: Page;
  filtered_articles: Article[] = [];


  selectedArticle: Article | null = null;

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

  filtered_articles$(page_id: string): Observable<Article[]> {
    return this.articlesService.articles$.pipe(
      map((articles) => articles.filter((article) => article.pageId === page_id)),
      map((articles) => articles.sort((a, b) => a.rank - b.rank))
    );
  };

  constructor(
    private siteLayoutService: SiteLayoutService,
    private articlesService: ArticlesService,
    private toastService: ToastService
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

  onSubmit(): void {
    const page = this.pageGroup.getRawValue();
    delete page.menu;
    // console.log(page);
    this.updatePage(page);
  }

  onDelete(pageId: string): void {
    this.siteLayoutService.deletePage(pageId).then((deletedPage) => {
    }).catch((error) => {
      console.error('page deletion error', error);
    });
  }

  onDeleteArticle(article: Article): void {
    this.articlesService.deleteArticle(article.id)
      .then((deletedArticle) => { })
      .catch((error) => {
        console.error('article deletion error', error);
      });
  }

  // onSave() {
  //   if (this.pageGroup.invalid) return;
  //   // recuperation du menu retourné par input-menu , et ajout de son id dans le menuId 
  //   //et suppression de la propriété menu pour coller au model de page
  //   let menu = this.pageGroup.get('menu')?.value;
  //   this.pageGroup.patchValue({ menuId: menu.id });
  //   let page = this.pageGroup.getRawValue();
  //   delete page.menu;

  //   this.creation ? this.createPage(page) : this.updatePage(page);
  //   this.onClear();
  // }

  // createPage(page: Page): void {
  //   // mettre la nouvelle page en dernier rang
  //   let menu = this.menus.find((m) => m.id === page.menuId);
  //   if (!menu) {
  //     console.error('menu not found for page', page);
  //     return;
  //   }
  //   page.rank = menu.pages?.length + 1;

  //   this.siteLayoutService.createPage(page).then((newPage) => {
  //   }).catch((error) => {
  //     console.error('page creation error', page, error);
  //   });
  // }

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
