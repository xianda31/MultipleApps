import { Component } from '@angular/core';
import { TitleService } from '../../title.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fonctionnement',
  imports: [CommonModule],
  templateUrl: './fonctionnement.component.html',
  styleUrl: './fonctionnement.component.scss'
})
export class FonctionnementComponent {

  topics: {
    title: string;
    students: string;
    contents: string[];
    schedules: string[];
  }[] = [
      {
        title: 'Cours d\'initiation',
        students: 
        'Ces cours s’adressent aux débutants ou à des joueurs ayant déjà joué il y a longtemps et qui ont (presque) tout oublié.',
        contents: [
          'Chaque séance dure environ 2 heures 1/2 :',
          'La première partie est consacrée à l’enseignement des enchères conformes au Système d’Enseignement Français.',
          'Dans la deuxième partie, les participants jouent 4 à 6 donnes préparées sur le thème du cours avec l\'aide des animateurs.'
        ],
        schedules: [
          'Mardi de 14h à 16h30. Cours de 1ère année. Animateur Jacques Louis MERAT.',
          'Mardi de 16h30 à 19h. Cours de 2nde année. Animateurs Dominique CASSAGNE et Daniel FERRY.',
          'Mardi de 19h30 à 22h. Cours de 2nde année. Animateurs Anne-Marie GODARD et Pierre GROS.'
        ]
      },
      {
        title: 'Cours de perfectionnement',
        students: 'Ces cours s’adressent aux joueurs qui ont déjà acquis les bases du bridge et qui souhaitent approfondir leurs connaissances.',
        contents: [
          'Un thème différent est abordé à chaque séance, ensuite les participants jouent 12 donnes préparées avec l\'aide de l\'animateur.',
          ' Le cours et les commentaires sont envoyés par courriel aux participants.',
          'Chaque séance dure environ 2 heures 1/2 ',
        ],
        schedules: [
          'Jeudi de 19h30 à 21h30. Perfectionnement niveau 2. Animateur Didier CARRAL.',
          'Vendredi de 10h à 12h. Perfectionnement Niveau 1. Animateur Didier CARRAL.'
        ]
      },
      {
        title: 'Tournoi d\'accession',
        students: 'Ce tournoi est destiné aux joueurs qui ont suivi les deux années du cours d\'initiation ou à d\'anciens joueurs ayant conservé de bonnes bases désirant approfondir leur connaissances et progresser au jeu de la carte. L\'indice maximum de chaque joueur pour participer est de 3K.',
        contents: [
          'Les participants jouent de 12 à 16 donnes préparées. L\'animateur est disponible pour aider.',
          '1 fois par mois, le tournoi joué est le tournoi des élèves proposé par la FFB et joué en simultané national.'
        ],
        schedules: [
          'Mercredi de 9h à 12h. Animateurs André AYRAL et François SOVRAN.'
        ]
      }
    ];

  constructor(
    private titleService: TitleService
  ) { }

  ngOnInit(): void {

    this.titleService.setTitle('Fonctionnement');



  }

}
