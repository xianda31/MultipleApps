import { Component, Input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ArticlesService } from '../../../../../common/site-layout_and_contents/articles.service';
import { Form, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './article.component.html',
  styleUrl: './article.component.scss'
})
export class ArticleComponent {
  id: string = '';
  articleForm: FormGroup = new FormGroup({
    id: new FormControl(''),
    title: new FormControl(''),
    content: new FormControl(''),
  });

  get title() { return this.articleForm.get('title')?.value; }
  get content() { return this.articleForm.get('content')?.value; }

  constructor(
    private route: ActivatedRoute,
    private articlesService: ArticlesService
  ) {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    if (this.id) {
      this.articlesService.readArticle(this.id).then((article) => {
        this.articleForm.patchValue(article);
      }).catch((error) => {
        console.error('article error', error);
      });
    }
  }

  onSubmit() {
    if (this.articleForm.invalid) return;
    let article = this.articleForm.getRawValue();
    this.articlesService.updateArticle(article).then((updatedArticle) => {
      console.log(' article updated', updatedArticle);
    });
    // this.articleForm.reset();
  }

}
