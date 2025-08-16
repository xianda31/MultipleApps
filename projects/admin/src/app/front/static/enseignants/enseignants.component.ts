import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TitleService } from '../../title.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { Snippet, SNIPPET_TEMPLATES } from '../../../common/interfaces/snippet.interface';

@Component({
  selector: 'app-enseignants',
  imports: [CommonModule],
  templateUrl: './enseignants.component.html',
  styleUrl: './enseignants.component.scss'
})
export class EnseignantsComponent {

    snippets: Snippet[] = [];

  constructor(
    private titleService: TitleService,
        private snippetService: SnippetService,
    
  ) {

  this.titleService.setTitle('Ecole de bridge -Les enseignants');
      this.snippetService.listSnippets().subscribe((snippets) => {
        this.snippets = snippets
        .filter(snippet => snippet.template === SNIPPET_TEMPLATES.ENSEIGNANTS)
        .sort((b,a) => a.rank.localeCompare(b.rank));
      });
 }
}
