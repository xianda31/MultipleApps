import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ArticlesService } from '../../../../../common/services/articles.service';
import { Form, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Article, ArticleTemplateEnum } from '../../../../../common/menu.interface';
import { RenderArticleComponent } from '../../../../../common/render-article/render-article.component';
import { FileService } from '../../../../../common/services/files.service';
import { Observable } from 'rxjs';
import { S3Item } from '../../../../../common/file.interface'; // Import the S3item type from the appropriate module
import { ToastService } from '../../../../../common/toaster/toast.service';
import { RenderingMode } from '../../../../../common/render-article/render-article.interface';

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RenderArticleComponent],
  templateUrl: './article.component.html',
  styleUrl: './article.component.scss'
})
export class ArticleComponent implements OnChanges {
  id: string = '';
  @Input() articleToEdit!: Article;
  @Output() articleUpdated: EventEmitter<Article> = new EventEmitter<Article>();


  S3Items: Observable<S3Item[]> = new Observable<S3Item[]>();
  featuredMode: boolean = false;

  templates = ArticleTemplateEnum;
  templates_values: string[] = Object.values(this.templates);

  article_in_progress!: Article;
  renderingMode = RenderingMode;

  articleForm: FormGroup = new FormGroup({
    id: new FormControl(''),
    title: new FormControl('', Validators.required),
    content: new FormControl('', Validators.required),
    template: new FormControl('', Validators.required),
    rank: new FormControl(0),
    // icon: new FormControl(''),
    image: new FormControl(''),
  });

  get article() {
    return this.articleForm.getRawValue();
  }
  get title() { return this.articleForm.get('title')?.value; }
  get content() { return this.articleForm.get('content')?.value; }
  get template() { return this.articleForm.get('template')?.value; }

  constructor(
    private route: ActivatedRoute,
    private articlesService: ArticlesService,
    private fileService: FileService,
    private ToastService: ToastService,

  ) {


    this.articleForm.valueChanges.subscribe((value) => {
      this.article_in_progress = value;
    });

    this.S3Items = this.fileService.S3Items;

  }



  ngOnChanges(changes: SimpleChanges): void {
    if (changes['articleToEdit'] && this.articleToEdit) {
      this.articleForm.patchValue(this.articleToEdit);
    }
  }




  onSubmit() {
    if (this.articleForm.invalid || !this.articleForm.touched) return;
    let article: Article = this.articleForm.getRawValue();
    this.articlesService.updateArticle(article).then((updatedArticle) => {
      this.ToastService.showSuccessToast('gestion des articles', 'article mis à jour');
    });
    this.articleUpdated.emit(article);
  }

}
