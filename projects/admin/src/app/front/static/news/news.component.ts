import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { SnippetService } from '../../../common/services/snippet.service';
import { Snippet, SNIPPET_TEMPLATES } from '../../../common/interfaces/snippet.interface';

@Component({
  selector: 'app-news',
  imports: [CommonModule],
  templateUrl: './news.component.html',
  styleUrl: './news.component.scss'
})
export class NewsComponent {
  snippets: Snippet[] = [];
  constructor(
    private snippetService: SnippetService
  ) { }

  ngOnInit(): void {

    this.snippetService.listSnippets().subscribe((snippets) => {
      this.snippets = snippets.filter(snippet => snippet.template === SNIPPET_TEMPLATES.NEWS);
    });
  }



  // Additional methods for handling news-related functionality can be added here

}
