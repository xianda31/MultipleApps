import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent {

  topics: {
    title: string,
    subtitle: string,
    description: string,
    link1: { route: string, label: string },
    link2?: { route: string, label: string }
  }[] = [
      {
        title: 'Gestion des tournois du Club',
        subtitle: 'Accès à la base FFB',
        description: 'Sélectionner un tournoi, compléter les équipes, editer une feuille de match',
        link1: { route: '/tournaments', label: 'Tournois' },
      },
      {
        title: 'Gestion des adhérents',
        subtitle: 'Accès aux bases FFB et Club pour le suivi des adhésions',
        description: 'Editeur de la base Club des adhérents , injection des données FFB',
        link1: { route: '/members', label: 'Adhérents' },
        link2: { route: '/licensees', label: 'Adhérents' }
      },
      {
        title: 'Gestion du site',
        subtitle: 'Gestion du contenu du site ',
        description: 'Modifier le contenu des pages, ajouter des images, des vidéos, des liens',
        link1: { route: '#', label: 'Site web' }
      },
      {
        title: 'Gestion des ventes',
        subtitle: 'Saisie assistée des opérations de caisse',
        description: 'Enregistrement de vente de licences, de cotisations, de produits dérivés',
        link1: { route: '#', label: 'Ventes' }
      },
    ];

  constructor() {

  }
}
