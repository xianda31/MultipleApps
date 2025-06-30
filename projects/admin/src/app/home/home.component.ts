import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Group_icons, Group_names } from '../../../../common/authentification/group.interface';

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
    accreditation : Group_names
  }[] = [
      {
        title: 'Boutique et Tournois',
        subtitle: 'Enregistrement des ventes d\'articles et des droits de table',
        descriptions: ['Ouvrir une session de vente et enregistrer les achats des adhérents','Ouvrir un tournoi et enregistrer les droits de table'],
        accreditation: Group_names.Support},

        {title: 'Base adhérents',
        subtitle: 'Gestion des adhérents et des licences FFB',
        descriptions: ['Lister les adhérents du Club, déclarer les nouveaux adhérents, vérifier leur cotisation interne et FFB.',
                   'Accéder au détail de leur paiement, de leur licence FFB et de leur carte d\'admission tournoi'],
        accreditation: Group_names.Support},
      {
        title: 'Ecritures comptables',
        subtitle: 'Opérations de caisse et sur le compte en banque, gestion des cartes d\'admission tournoi',
        descriptions: ['Enregistrer des écritures comptables simples de mouvement bancaire, de recettes ou de dépenses',
         'Créer/modifier des cartes d\'admission tournoi'],  
        accreditation: Group_names.Admin  },
      {
        title: 'Etats financiers',
        subtitle: 'Synthèse des données financières ',
        descriptions: ['Afficher l\'état à date des comptes de résultats courants et du bilan.',
          'Réconcilier le compte courant et les relevés de banque...',
        'Effectuer des opérations comptables complexes, incluant les écritures de fin d\'exercice',],
        accreditation: Group_names.Admin},
      {
        title: 'Accès',
        subtitle: 'Gestion des accréditations des utilisateurs',
        descriptions: ['Afficher la liste des adhérents ayant ouvert un compte.',
          'Permet de changer les droits (niveau d\'accréditation) '],
        accreditation: Group_names.Admin},
      {
        title: 'Outils',
        subtitle: 'Outils de maintenance des base de données',
        descriptions: ['sauvegarder la base de données, exporter les données',
          ' importer des données, ...'],
        accreditation: Group_names.System}
    ];
}
