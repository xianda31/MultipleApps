import { Component } from '@angular/core';
import { TitleService } from '../../title.service';
import { CommonModule } from '@angular/common';
import { Snippet, SNIPPET_TEMPLATES } from '../../../common/interfaces/snippet.interface';
import { SnippetService } from '../../../common/services/snippet.service';

@Component({
  selector: 'app-fonctionnement',
  imports: [CommonModule],
  templateUrl: './fonctionnement.component.html',
  styleUrl: './fonctionnement.component.scss'
})
export class FonctionnementComponent {

    snippets: Snippet[] = [];

  constructor(
    private snippetService: SnippetService,
    private titleService: TitleService
  ) { }

  ngOnInit(): void {

    this.titleService.setTitle('Ecole de bridge -Fonctionnement');

 this.snippetService.listSnippets().subscribe((snippets) => {
      this.snippets = snippets.filter(snippet => snippet.template === SNIPPET_TEMPLATES.FONCTIONNEMENT);
    });

  }

}
