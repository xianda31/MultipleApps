import { Component, OnInit } from '@angular/core';
import { S3Item } from '../../../../../../common/file.interface';
import { getUrl, list } from 'aws-amplify/storage';
import { CommonModule } from '@angular/common';
import { FileService } from '../../../../../../common/services/files.service';
import { Observable } from 'rxjs';
import { ImgUploadComponent } from '../img-upload/img-upload.component';
import { ReplacePipe } from '../../../../../../common/pipes/replace.pipe';
import { ArticlesService } from '../../../../../../common/services/articles.service';
import { Article } from '../../../../../../common/menu.interface';


@Component({
  selector: 'app-image-mgr',
  standalone: true,
  imports: [CommonModule, ImgUploadComponent, ReplacePipe],
  templateUrl: './image-mgr.component.html',
  styleUrl: './image-mgr.component.scss'
})
export class ImageMgrComponent implements OnInit {
  S3Items!: S3Item[];
  articles !: Article[];


  constructor(
    private fileService: FileService,
    private articleService: ArticlesService

  ) {
  }
  ngOnInit(): void {
    this.listThumbnails();
    this.articleService.articles$.subscribe((articles) => {
      this.articles = articles;
    });
  }

  listThumbnails() {
    this.fileService.list('thumbnails/').then((data) => {
      this.S3Items = data;
      this.S3Items.forEach((item) => item.url = this.fileService.getPresignedUrl(item.path));
      this.S3Items.forEach((item) => item.usage = this.articles_with_this_image(item.path));
    });
  }

  onDelete(item: S3Item) {
    this.fileService.delete(item.path);
    this.S3Items = this.S3Items.filter((i) => i.path !== item.path);
  }

  addItem(event: any) {
    this.listThumbnails();
  }


  articles_with_this_image(image: string): number {
    // console.log('articles_with_this_image', image, this.articles.length);
    return this.articles.reduce((acc, article) => acc + (article.image === image ? 1 : 0), 0);
  }
}
