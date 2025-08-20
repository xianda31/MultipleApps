import { Component } from '@angular/core';
import { MENU_TITLES, Snippet} from '../../../common/interfaces/page_snippet.interface';
import { FileService } from '../../../common/services/files.service';
import { SnippetService } from '../../../common/services/snippet.service';
import { ToastService } from '../../../common/services/toast.service';
import { TitleService } from '../../title.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-actors',
  imports: [CommonModule],
  templateUrl: './actors.component.html',
  styleUrl: './actors.component.scss'
})
export class ActorsComponent {
b_snippets: Snippet[] = [];
e_snippets: Snippet[] = [];

    constructor(
      private snippetService: SnippetService,
      private titleService: TitleService,
    ) { }
  
    ngOnInit(): void {
      this.titleService.setTitle('Les acteurs du Club');
  
        this.snippetService.listSnippets().subscribe(snippets => {
          this.b_snippets = snippets
          .filter(snippet => snippet.template === MENU_TITLES.BUREAU)
          .sort((a, b) => a.rank.localeCompare(b.rank));

          this.e_snippets = snippets
          .filter(snippet => (snippet.template === MENU_TITLES.ENSEIGNANTS && this.not_already_selected(snippet)))
          .sort((a, b) => a.rank.localeCompare(b.rank));
        });
    }

    not_already_selected(snippet: Snippet): boolean {
      return !this.b_snippets.reduce((acc, curr) => acc || curr.title === snippet.title, false) ;
    }
}
