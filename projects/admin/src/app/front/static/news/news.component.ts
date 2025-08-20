import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { SnippetService } from '../../../common/services/snippet.service';
import { MENU_TITLES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { TitleService } from '../../title.service';

@Component({
  selector: 'app-news',
  imports: [CommonModule],
  templateUrl: './news.component.html',
  styleUrl: './news.component.scss'
})
export class NewsComponent {
  snippets: Snippet[] = [];

  constructor(
    private snippetService: SnippetService,
    private titleService: TitleService
  ) { }

  ngOnInit(): void {

    this.titleService.setTitle('Les news');
    this.snippetService.listSnippets().subscribe((snippets) => {
      this.snippets = snippets.filter(snippet => snippet.template === MENU_TITLES.NEWS);
    });
  }


  scrollToElement(title: string) {
    setTimeout(() => {
      const element = document.getElementById(title);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  }
}
