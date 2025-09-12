import { Component } from '@angular/core';
import { TitleService } from '../../title.service';

@Component({
  selector: 'app-front-page',
  imports: [],
  templateUrl: './front-page.component.html',
  styleUrl: './front-page.component.scss'
})
export class FrontPageComponent {

  constructor(
    private titleService: TitleService
  ) { 
    this.titleService.setTitle('Accueil');
  }

}
