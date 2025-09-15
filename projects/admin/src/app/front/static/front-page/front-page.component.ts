import { AfterViewInit, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
declare var bootstrap: any;
import { Component } from '@angular/core';
import { TitleService } from '../../title.service';
import { Carousel } from "../../carousel/carousel";
import { S3Item } from '../../../common/interfaces/file.interface';
import { CommonModule } from '@angular/common';
import { FileService, S3_ROOT_FOLDERS } from '../../../common/services/files.service';
import { map, Observable } from 'rxjs';

@Component({
  selector: 'app-front-page',
  imports: [CommonModule],
  templateUrl: './front-page.component.html',
  styleUrl: './front-page.component.scss'
})
export class FrontPageComponent implements AfterViewInit, AfterViewChecked {
  @ViewChild('carouselEl') carouselEl?: ElementRef;
  private carouselInitialized = false;


  ngAfterViewInit(): void {
    // Rien ici, tout est dans ngAfterViewChecked
  }

  ngAfterViewChecked(): void {
    if (!this.carouselInitialized && this.carouselEl?.nativeElement && typeof bootstrap !== 'undefined' && bootstrap.Carousel) {
      new bootstrap.Carousel(this.carouselEl.nativeElement, { interval: 3000, ride: 'carousel' });
      this.carouselInitialized = true;
    }
  }
  photos$: Observable<S3Item[]> = new Observable<S3Item[]>();
  frontPageImageFolder = S3_ROOT_FOLDERS.ALBUMS + '/accueil';

  constructor(
    private titleService: TitleService,
    private fileService: FileService,
  ) { 
    this.titleService.setTitle('Accueil');

       this.photos$ = this.fileService.list_files(this.frontPageImageFolder + '/').pipe(
                map((S3items) => S3items.filter(item => item.size !== 0)),
              );
  }

}
