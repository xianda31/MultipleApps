import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { SnippetService } from '../../../common/services/snippet.service';
import { Snippet, SNIPPET_TEMPLATES } from '../../../common/interfaces/snippet.interface';
import { TitleService } from '../../title.service';
import { AuthentificationService } from '../../../common/authentification/authentification.service';

@Component({
  selector: 'app-news',
  imports: [CommonModule],
  templateUrl: './news.component.html',
  styleUrl: './news.component.scss'
})
export class NewsComponent {
  snippets: Snippet[] = [];

  constructor(
    private auth: AuthentificationService,
    private snippetService: SnippetService,
    private titleService: TitleService
  ) { }

  ngOnInit(): void {

    this.titleService.setTitle('Les news');

    this.auth.logged_member$.subscribe(member => {
      const only_public = !member;

      this.snippetService.listSnippets().subscribe((snippets) => {
        this.snippets = snippets.filter(snippet => snippet.template === SNIPPET_TEMPLATES.NEWS);
        if (only_public) { this.snippets = this.snippets.filter(snippet => snippet.public); }
      });
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
