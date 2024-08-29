import { Component, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ArticlesService } from '../../../../../common/site-layout_and_contents/articles.service';
import { Form, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Article, TemplateEnum } from '../../../../../common/menu.interface';
import { RenderArticleComponent } from '../../../../../common/render-article/render-article.component';

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RenderArticleComponent],
  templateUrl: './article.component.html',
  styleUrl: './article.component.scss'
})
export class ArticleComponent {
  id: string = '';

  featuredMode: boolean = false;

  templates = TemplateEnum;
  // templates_keys: string[] = Object.keys(this.templates);
  templates_values: string[] = Object.values(this.templates);

  // ctx: any;
  article_in_progress!: Article;

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
    private router: Router

  ) {

    this.id = this.route.snapshot.paramMap.get('id') || '';
    if (this.id) {
      this.articlesService.readArticle(this.id).then((article) => {
        console.log('article', article);
        this.articleForm.patchValue(article);
        this.article_in_progress = article;
        // this.ctx = { title: this.title, content: this.content };
      }).catch((error) => {
        console.error('article error', error);
      });
    }

    this.articleForm.valueChanges.subscribe((value) => {
      this.article_in_progress = value;
    });
  }




  onSubmit() {
    if (this.articleForm.invalid) return;
    let article: Article = this.articleForm.getRawValue();
    console.log('article', article);
    this.articlesService.updateArticle(article).then((updatedArticle) => {
      console.log(' article updated', updatedArticle);
      // this.ctx = { title: this.title, content: this.content };
      this.router.navigate(['/articles']);
    });
    // this.articleForm.reset();
  }

}
