import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TitleService } from '../../title.service';

@Component({
  selector: 'app-enseignants',
  imports: [CommonModule],
  templateUrl: './enseignants.component.html',
  styleUrl: './enseignants.component.scss'
})
export class EnseignantsComponent {

  enseignants : {
    name: string;
  title: string;
  photo: string;
}[] = [
    { name: 'Didier Carral', title: 'moniteur maître-assistant', photo: 'spidey.png' },
    { name: 'Dominique Cassagne', title: 'monitrice', photo: 'ghost-spider.png' },
    { name: 'Anne-Marie Godard', title: 'monitrice', photo: 'ghost-spider.png' },
    { name: 'Jacques Louis Merat', title: 'moniteur', photo: 'spidey.png' },
    { name: 'Pierre Gros', title: 'moniteur', photo: 'spidey.png' },
    { name: 'André Ayral', title: 'moniteur', photo: 'spidey.png' },
    { name: 'François Sovran', title: 'initiateur', photo: 'spidey.png' },
  ];

  constructor(
    private titleService: TitleService
  ) {

  this.titleService.setTitle('Les enseignants');
 }
}
