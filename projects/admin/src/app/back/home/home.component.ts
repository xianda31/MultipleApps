import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Group_icons, Group_names } from '../../common/authentification/group.interface';

@Component({
  selector: 'app-home',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {

  _group_icons = Group_icons;

  topics: {
    title: string,
    subtitle: string,
    descriptions: string[],
    accreditation: Group_names
  }[] = [
      {
        title: 'Boutique',
        subtitle: 'Vente, droits de table et gestion caisse',
        descriptions: ['Ouvrir une session de vente et enregistrer les achats des adhérents',
          'Ouvrir un tournoi et enregistrer les droits de table',
          'Accéder à la base des articles en vente',
          'Faire un état de caisse '
        ],
        accreditation: Group_names.Support
      },

      {
        title: 'Adhérents',
        subtitle: 'Gestion des adhérents et cohérence base FFB',
        descriptions: [
          'Gérer le répertoire des adhérents du Club, et importer les données FFB.',
          'Accéder aux cartes d\'admission tournoi',
          'Accéder à l\'historique de leurs paiements dont leur paiement adhésion et licence FFB',
        ],
        accreditation: Group_names.Support
      },
      {
        title: 'Finance',
        subtitle: 'Synthèse financière et écritures comptables',
        descriptions: [
          'Effectuer des écritures comptables',
          'Effectuer des rapprochements bancaires',
          'Consulter les comptes de résultats et le bilan',
        ],
        accreditation: Group_names.Admin
      },
      {
        title: 'Outils',
        subtitle: 'Outils de configuration et maintenance ',
        descriptions: [
          'Gérer la base de données, (export,modification,import)',
          'Gérer les droits (niveau d\'accréditation) ',
          'Gérer les paramètres généraux de l\'application',
        ],
        accreditation: Group_names.System
      }
    ];
}
