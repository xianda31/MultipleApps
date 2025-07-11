import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RenderingModeEnum } from '../../../../common/menu.interface';

@Component({
    selector: 'app-home-page',
    imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
    templateUrl: './home-page.component.html',
    styleUrl: './home-page.component.scss'
})
export class HomePageComponent {
  renderMode = RenderingModeEnum;


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
        description: 'Compléter les équipes d\'un tournoi, éditer la feuille de match (temporaire)',
        link1: { route: '/tournaments', label: 'Tournois' },
      },
      {
        title: 'Gestion des adhérents',
        subtitle: 'Accès aux bases FFB et Club pour le suivi des adhésions',
        description: 'Editer la base Club des adhérents, consolider les données avec celles de la FFB, visualiser les détails adhérents (historique achat, licences, ...)',
        link1: { route: '/members', label: 'Adhérents' },
        link2: { route: '/licensees', label: 'base FFB' }
      },
      {
        title: 'Gestion du site',
        subtitle: 'Gestion du contenu du site ',
        description: 'Modifier le contenu des pages, des articles, des événements',
        link1: { route: '/layout', label: 'menus et pages' },
        link2: { route: '/articles', label: 'articles' }
      },
      {
        title: 'Gestion des ventes',
        subtitle: 'Configuration des opérations de caisse',
        description: 'Définir les articles en vente, les tarifs, ...',
        link1: { route: '/sales/products', label: 'Catalogue' }
      },
      {
        title: 'Configuration système',
        subtitle: 'Paramétrer les options du système',
        description: 'Procéder à des opérations de maintenance, de changement de configuration',
        link1: { route: '/sysconf', label: 'Système' }
      },
    ];

  constructor() {

  }
}
