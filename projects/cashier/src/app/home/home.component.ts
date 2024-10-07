import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

  topics: {
    title: string,
    subtitle: string,
    description: string,
    link1: { route: string, label: string },
    link2?: { route: string, label: string }
  }[] = [
      {
        title: 'Gestion des ventes du Club',
        subtitle: 'Accès à la base des articles en ventes',
        description: 'Ouvrir une session de vente, et enregistrer les achats dans la base',
        link1: { route: '/sales', label: 'vente' },
      },
      {
        title: 'Gestion des droits de table',
        subtitle: 'Accès à la base des droits de table vendus et de leur usage',
        description: 'Editer une feuille de tournois, et débiter les droits de table (droit acquis ou espèces)',
        link1: { route: '/fees', label: 'Droits de table' },
      },
      {
        title: 'Gestion comptable',
        subtitle: 'Gestion données financières ',
        description: 'Editer les reçus, les avoirs, les relevés de compte ...',
        link1: { route: '/books', label: 'Comptes' },
      }
    ];
}
