import { Component } from '@angular/core';
import { TitleService } from '../../title.service';
import { CommonModule } from '@angular/common';
import { MENU_TITLES, Snippet } from '../../../common/interfaces/page_snippet.interface';
import { SnippetService } from '../../../common/services/snippet.service';
import { EnseignantsComponent } from '../enseignants/enseignants.component';

@Component({
  selector: 'app-fonctionnement',
  imports: [CommonModule,EnseignantsComponent],
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
      this.snippets = snippets
      .filter(snippet => snippet.template === MENU_TITLES.FONCTIONNEMENT)
      .sort((a,b) => a.rank.localeCompare(b.rank));
    });

  }

}
