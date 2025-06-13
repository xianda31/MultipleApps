import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
_icons: { [key: string]: string } = {
    'Contributeur': 'bi bi-person-fill-gear',
    'Administrateur': 'bi bi-mortarboard-fill',
    'Système': 'bi bi-incognito'
  };

  topics: {
    title: string,
    subtitle: string,
    descriptions: string[],
    accreditation : string
  }[] = [
      {
        title: 'Boutique et Tournois',
        subtitle: 'Enregistrement des ventes d\'articles et des droits de table',
        descriptions: ['Ouvrir une session de vente et enregistrer les achats des adhérents','Ouvrir un tournoi et enregistrer les droits de table'],
        accreditation: 'Contributeur'},

        {title: 'Base adhérents',
        subtitle: 'Gestion des adhérents et des licences FFB',
        descriptions: ['Lister les adhérents du Club, déclarer les nouveaux adhérents, vérifier leur cotisation interne et FFB.',
                   'Accéder au détail de leur paiement, de leur licence FFB et de leur carte d\'admission tournoi'],
        accreditation: 'Contributeur'},
      {
        title: 'Ecritures comptables',
        subtitle: 'Opérations de caisse et sur le compte en banque, gestion des cartes d\'admission tournoi',
        descriptions: ['Enregistrer des écritures comptables simples de mouvement bancaire, de recettes ou de dépenses',
         'Créer/modifier des cartes d\'admission tournoi'],  
        accreditation: 'Administrateur'  },
      {
        title: 'Etats financiers',
        subtitle: 'Synthèse des données financières ',
        descriptions: ['Afficher l\'état à date des comptes de résultats courants et du bilan.',
          'Réconcilier le compte courant et les relevés de banque...',
        'Effectuer des opérations comptables complexes, incluant les écritures de fin d\'exercice',],
        accreditation: 'Administrateur'},
      {
        title: 'Outils',
        subtitle: 'Outils de maintenance des base de données',
        descriptions: ['sauvegarder la base de données, exporter les données',
          ' importer des données, ...'],
        accreditation: 'Système'}
    ];
}
