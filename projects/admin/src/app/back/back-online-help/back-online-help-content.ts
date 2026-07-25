import { BACK_ROUTE_ABS_PATHS } from '../routes/back-route-paths';

export type HelpNavMeta = {
  menuTitle: string;
  subMenuTitle?: string;
  icon: string;
  groupLevel: 'Membre' | 'Contributeur' | 'Editeur' | 'Administrateur' | 'Systeme';
  adminOnly?: boolean;
};

export type HelpTopic = {
  id: string;
  title: string;
  summary: string;
  route?: string;
  nav: HelpNavMeta;
  functionalities: string[];
  howTo: string[];
  caution?: string[];
  children?: HelpTopic[];
};

// Base editable: suivre l'ordre et les libelles de back-navbar.definition.ts
export const HELP_CONTENT_VERSION = '2026-07-23.3';

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'tournois',
    title: 'Tournois',
    summary: 'À l’ouverture d’un tournoi de régularité, cette page permet de vérifier la présence effective des joueurs inscrits et de pointer les droits de table (carte ou espèces).',
    route: BACK_ROUTE_ABS_PATHS['FeesCollector'],
    nav: {
      menuTitle: 'Tournois',
      icon: 'bi-card-checklist',
      groupLevel: 'Contributeur',
    },
    functionalities: [
      'Vérification de la présence effective des joueurs inscrits.',
      'Pointage des droits de table par mode de règlement.',
      'Préparation de l’enregistrement des droits de table du tournoi.',
    ],
    howTo: [
      'Sélectionner le tournoi concerné pour afficher les joueurs inscrits.',
      'Pour chaque joueur présent, pointer le mode de règlement choisi (carte, espèces) ou utiliser le bouton NP pour non présent ou non payant.',
      'Quand tous les joueurs ont été pointés, accepter l’enregistrement des droits de table.',
    ],
    caution: [
      'Le nombre de droits de table de la carte d’un joueur est affiché en bas à gauche.',
      'L’icône chariot permet de lancer une vente rapide d’une nouvelle carte de droits d’entrée.',
      'Les dettes et avoirs ne sont pas pris en compte par cette vente rapide ; pour en tenir compte, passer par le menu Boutique / vente adhérent.',
    ],
    children: [
      {
        id: 'tournois-droits-table',
        title: 'Droits de table',
        summary: 'Enregistrement des droits de table pour les participants.',
        route: BACK_ROUTE_ABS_PATHS['FeesCollector'],
        nav: {
          menuTitle: 'Tournois',
          subMenuTitle: 'droits de table',
          icon: 'bi-card-checklist',
          groupLevel: 'Contributeur',
        },
        functionalities: [
          'Saisie des montants par joueur.',
          'Validation des encaissements evenementiels.',
        ],
        howTo: [
          'Rechercher le participant dans la liste.',
          'Saisir puis valider le montant de droit de table.',
        ],
      },
    ],
  },
  {
    id: 'boutique',
    title: 'Boutique',
    summary: 'Gestion des ventes adhérents, de la billetterie et du catalogue produits.',
    route: BACK_ROUTE_ABS_PATHS['Shop'],
    nav: {
      menuTitle: 'Boutique',
      icon: 'bi-cart',
      groupLevel: 'Contributeur',
    },
    functionalities: [
      'Création de paniers de vente.',
      'Gestion des modes de paiement.',
      'Suivi du catalogue des produits vendables.',
    ],
    howTo: [
      'Ouvrir la boutique puis sélectionner l’acheteur.',
      'Vérifier le panier, les montants et le mode de paiement.',
      'Valider le paiement puis contrôler la confirmation.',
    ],
    caution: [
      'En cas d’ambiguïté CB/Stripe, contrôler ensuite la section Stripe.',
    ],
    children: [
      {
        id: 'boutique-vente-adherent',
        title: 'vente adherent',
        summary: 'Vente standard rattachee a un membre.',
        route: BACK_ROUTE_ABS_PATHS['Shop'],
        nav: {
          menuTitle: 'Boutique',
          subMenuTitle: 'vente adherent',
          icon: 'bi-cart',
          groupLevel: 'Contributeur',
        },
        functionalities: [
          'Selection de l acheteur et des payeurs.',
          'Application des regles de panier.',
        ],
        howTo: [
          'Verifier le membre avant validation.',
          'Confirmer le recapitulatif avant enregistrement.',
        ],
      },
      {
        id: 'boutique-billetterie',
        title: 'billetterie',
        summary: 'Suivi des ventes de billetterie.',
        route: BACK_ROUTE_ABS_PATHS['Billetterie'],
        nav: {
          menuTitle: 'Boutique',
          subMenuTitle: 'billetterie',
          icon: 'bi-cart',
          groupLevel: 'Contributeur',
        },
        functionalities: [
          'Encaissement sur flux billetterie.',
          'Verification des informations de vente.',
        ],
        howTo: [
          'Ouvrir billetterie depuis Boutique.',
          'Controler les donnees avant validation.',
        ],
      },
      {
        id: 'boutique-produits',
        title: 'produits a la vente',
        summary: 'Maintenance du catalogue produits.',
        route: BACK_ROUTE_ABS_PATHS['Products'],
        nav: {
          menuTitle: 'Boutique',
          subMenuTitle: 'produits a la vente',
          icon: 'bi-cart',
          groupLevel: 'Contributeur',
        },
        functionalities: [
          'Creation et mise a jour des produits.',
          'Pilotage des categories visibles en caisse.',
        ],
        howTo: [
          'Ajuster libelle, prix et categorie.',
          'Verifier l apparition dans la boutique.',
        ],
      },
    ],
  },
  {
    id: 'adherents',
    title: 'Adherents',
    summary: 'Base membres, cartes admission et controles associes.',
    route: BACK_ROUTE_ABS_PATHS['MembersDatabase'],
    nav: {
      menuTitle: 'Adherents',
      icon: 'bi-people',
      groupLevel: 'Contributeur',
    },
    functionalities: [
      'Consultation et mise a jour des fiches membres.',
      'Gestion des cartes admission.',
      'Controle des operations rattachees aux adherents.',
    ],
    howTo: [
      'Rechercher le membre cible.',
      'Appliquer les modifications necessaires.',
      'Verifier les impacts sur cartes et ventes.',
    ],
    children: [
      {
        id: 'adherents-repertoire',
        title: 'repertoire',
        summary: 'Consultation et mise à jour des fiches adhérents, avec recalcul saisonnier des dates d’adhésion.',
        route: BACK_ROUTE_ABS_PATHS['MembersDatabase'],
        nav: {
          menuTitle: 'Adherents',
          subMenuTitle: 'repertoire',
          icon: 'bi-people',
          groupLevel: 'Contributeur',
        },
        functionalities: [
          'Recherche multicritère des membres.',
          'Édition des données de contact et de statut.',
          'Recalcul automatique des dates d’adhésion lors d’un changement de saison.',
          'Régénération de l’état d’adhésion sur la saison sélectionnée à partir des écritures ADH.',
          'Mise à jour du statut membre et de la couleur d’icône après recalcul.',
        ],
        howTo: [
          'Utiliser les filtres pour trouver le membre cible.',
          'Changer la saison via la barre de navigation du back-office.',
          'Attendre la synchronisation automatique des membres.',
          'Vérifier la colonne Date d’adhésion puis l’icône de statut.',
          'Sauvegarder après vérification des champs sensibles.',
        ],
        caution: [
          'Le recalcul utilise la saison locale active.',
          'Si aucune écriture ADH n’est trouvée sur la saison sélectionnée, la date est conservée seulement si elle est antérieure à cette saison; sinon elle est vidée.',
          'Une date vide peut faire passer le statut en NON_ADHERENT pour la saison affichée.',
        ],
      },
      {
        id: 'adherents-cartes',
        title: 'cartes admission',
        summary: 'Edition et generation des cartes.',
        route: BACK_ROUTE_ABS_PATHS['GameCardsEditor'],
        nav: {
          menuTitle: 'Adherents',
          subMenuTitle: 'cartes admission',
          icon: 'bi-people',
          groupLevel: 'Administrateur',
          adminOnly: true,
        },
        functionalities: [
          'Edition des attributs de carte.',
          'Controle des informations imprimees.',
        ],
        howTo: [
          'Selectionner le membre et verifier ses donnees.',
          'Generer la carte puis controler le rendu.',
        ],
      },
      {
        id: 'adherents-controles',
        title: 'controles',
        summary: 'Verification des controles et ventes membres.',
        route: BACK_ROUTE_ABS_PATHS['MemberSales'],
        nav: {
          menuTitle: 'Adherents',
          subMenuTitle: 'controles',
          icon: 'bi-people',
          groupLevel: 'Contributeur',
        },
        functionalities: [
          'Suivi des controles lies aux adherents.',
          'Detection des cas atypiques.',
        ],
        howTo: [
          'Filtrer par membre ou periode.',
          'Analyser les lignes puis corriger les anomalies.',
        ],
      },
    ],
  },
  {
    id: 'comptabilite',
    title: 'Comptabilite',
    summary: 'Saisie, rapprochement et analyse des écritures comptables.',
    route: BACK_ROUTE_ABS_PATHS['BooksOverview'],
    nav: {
      menuTitle: 'Comptabilite',
      icon: 'bi-calculator',
      groupLevel: 'Administrateur',
    },
    functionalities: [
      'État de caisse et rapprochement bancaire.',
      'Édition des écritures comptables.',
      'Analyse des résultats, du bilan et de la synthèse.',
    ],
    howTo: [
      'Vérifier d’abord l’état de caisse.',
      'Rapprocher les mouvements bancaires.',
      'Clore l’analyse sur les vues résultats, bilan et synthèse.',
    ],
    children: [
      {
        id: 'compta-etat-caisse',
        title: 'etat de caisse',
        summary: 'Controle des soldes et mouvements de caisse.',
        route: BACK_ROUTE_ABS_PATHS['CashBoxStatus'],
        nav: {
          menuTitle: 'Comptabilite',
          subMenuTitle: 'etat de caisse',
          icon: 'bi-calculator',
          groupLevel: 'Administrateur',
        },
        functionalities: [
          'Lecture des soldes courants.',
          'Detection des ecarts de caisse.',
        ],
        howTo: [
          'Comparer caisse et flux de vente.',
          'Traiter les ecarts avant cloture.',
        ],
      },
      {
        id: 'compta-rapprochement',
        title: 'rapprochement bancaire',
        summary: 'Association des mouvements caisse et banque.',
        route: BACK_ROUTE_ABS_PATHS['BankReconciliation'],
        nav: {
          menuTitle: 'Comptabilite',
          subMenuTitle: 'rapprochement bancaire',
          icon: 'bi-calculator',
          groupLevel: 'Administrateur',
        },
        functionalities: [
          'Visualisation des transactions a rapprocher.',
          'Validation des associations.',
        ],
        howTo: [
          'Selectionner la periode.',
          'Rapprocher puis valider le resultat global.',
        ],
      },
      {
        id: 'compta-ecriture',
        title: 'ecriture',
        summary: 'Edition detaillee des ecritures comptables.',
        route: BACK_ROUTE_ABS_PATHS['BooksEditor'],
        nav: {
          menuTitle: 'Comptabilite',
          subMenuTitle: 'ecriture',
          icon: 'bi-calculator',
          groupLevel: 'Administrateur',
        },
        functionalities: [
          'Modification des ecritures.',
          'Verification de coherence comptable.',
        ],
        howTo: [
          'Rechercher l ecriture cible.',
          'Corriger puis controler l impact global.',
        ],
      },
      {
        id: 'compta-resultats',
        title: 'resultats',
        summary: 'Analyse revenus/charges par periode.',
        route: BACK_ROUTE_ABS_PATHS['ExpenseAndRevenue'],
        nav: {
          menuTitle: 'Comptabilite',
          subMenuTitle: 'resultats',
          icon: 'bi-calculator',
          groupLevel: 'Administrateur',
        },
        functionalities: [
          'Visualisation des revenus et depenses.',
          'Suivi des variations par periode.',
        ],
        howTo: [
          'Verifier la periode d analyse.',
          'Comparer les postes critiques.',
        ],
      },
      {
        id: 'compta-bilan',
        title: 'bilan',
        summary: 'Vue de synthese comptable globale.',
        route: BACK_ROUTE_ABS_PATHS['Balance'],
        nav: {
          menuTitle: 'Comptabilite',
          subMenuTitle: 'bilan',
          icon: 'bi-calculator',
          groupLevel: 'Administrateur',
        },
        functionalities: [
          'Lecture du bilan general.',
          'Verification de coherence des soldes.',
        ],
        howTo: [
          'Ouvrir le bilan sur la bonne saison.',
          'Controler les postes majeurs.',
        ],
      },
      {
        id: 'compta-synthese',
        title: 'synthese',
        summary: 'Acces a la base comptable de synthese.',
        route: BACK_ROUTE_ABS_PATHS['BooksOverview'],
        nav: {
          menuTitle: 'Comptabilite',
          subMenuTitle: 'synthese',
          icon: 'bi-calculator',
          groupLevel: 'Administrateur',
        },
        functionalities: [
          'Vue agregee des ecritures.',
          'Navigation rapide dans la base comptable.',
        ],
        howTo: [
          'Selectionner la vue de synthese.',
          'Explorer les sections pour audit rapide.',
        ],
      },
    ],
  },
  {
    id: 'stripe',
    title: 'Stripe',
    summary: 'Pilotage des paiements en ligne et des remboursements.',
    route: BACK_ROUTE_ABS_PATHS['StripeReconciliation'],
    nav: {
      menuTitle: 'Stripe',
      icon: 'bi-credit-card',
      groupLevel: 'Administrateur',
    },
    functionalities: [
      'Rapprochement des paiements Stripe.',
      'Traitement des remboursements.',
    ],
    howTo: [
      'Verifier les paiements a rapprocher.',
      'Traiter les remboursements puis controler le statut.',
    ],
    children: [
      {
        id: 'stripe-rapprochement',
        title: 'rapprochement',
        summary: 'Controle des paiements Stripe et ecarts.',
        route: BACK_ROUTE_ABS_PATHS['StripeReconciliation'],
        nav: {
          menuTitle: 'Stripe',
          subMenuTitle: 'rapprochement',
          icon: 'bi-credit-card',
          groupLevel: 'Administrateur',
        },
        functionalities: [
          'Suivi des statuts de transaction.',
          'Recherche des incoherences avec la comptabilite.',
        ],
        howTo: [
          'Filtrer la periode.',
          'Investiguer les statuts incoherents.',
        ],
      },
      {
        id: 'stripe-remboursement',
        title: 'remboursement',
        summary: 'Execution et suivi des remboursements Stripe.',
        route: BACK_ROUTE_ABS_PATHS['StripeRefunds'],
        nav: {
          menuTitle: 'Stripe',
          subMenuTitle: 'remboursement',
          icon: 'bi-credit-card',
          groupLevel: 'Administrateur',
        },
        functionalities: [
          'Selection des paiements eligibles.',
          'Suivi des remboursements emis.',
        ],
        howTo: [
          'Identifier le paiement cible.',
          'Lancer le remboursement et verifier le statut final.',
        ],
      },
    ],
  },
  {
    id: 'outils',
    title: 'Outils',
    summary: 'Configuration, droits et operations administratives sensibles.',
    route: BACK_ROUTE_ABS_PATHS['SysConf'],
    nav: {
      menuTitle: 'Outils',
      icon: 'bi-database-fill-gear',
      groupLevel: 'Systeme',
    },
    functionalities: [
      'Reglages systeme.',
      'Gestion des droits d acces.',
      'Sauvegarde comptable et maintenance.',
    ],
    howTo: [
      'Valider le niveau de droit necessaire avant action.',
      'Appliquer le changement cible.',
      'Verifier l impact metier apres execution.',
    ],
    caution: [
      'Les operations techniques doivent etre precedees d une verification et d une sauvegarde.',
    ],
    children: [
      {
        id: 'outils-base-donnees',
        title: 'base de donnees',
        summary: 'Consultation de la base comptable/listes techniques.',
        route: BACK_ROUTE_ABS_PATHS['BooksList'],
        nav: {
          menuTitle: 'Outils',
          subMenuTitle: 'base de donnees',
          icon: 'bi-database-fill-gear',
          groupLevel: 'Systeme',
        },
        functionalities: [
          'Acces aux listes de donnees back.',
          'Verification technique des enregistrements.',
        ],
        howTo: [
          'Ouvrir la base de donnees depuis Outils.',
          'Rechercher l enregistrement cible.',
        ],
      },
      {
        id: 'outils-droits-acces',
        title: 'droits d acces',
        summary: 'Attribution et controle des permissions.',
        route: BACK_ROUTE_ABS_PATHS['GroupsList'],
        nav: {
          menuTitle: 'Outils',
          subMenuTitle: 'droits d acces',
          icon: 'bi-database-fill-gear',
          groupLevel: 'Systeme',
        },
        functionalities: [
          'Gestion des groupes et niveaux.',
          'Controle des droits par ecran.',
        ],
        howTo: [
          'Selectionner le groupe cible.',
          'Modifier puis tester les acces.',
        ],
      },
      {
        id: 'outils-configuration',
        title: 'configuration',
        summary: 'Configuration centrale de l application.',
        route: BACK_ROUTE_ABS_PATHS['SysConf'],
        nav: {
          menuTitle: 'Outils',
          subMenuTitle: 'configuration',
          icon: 'bi-database-fill-gear',
          groupLevel: 'Systeme',
        },
        functionalities: [
          'Edition des parametres applicatifs.',
          'Ajustement des options globales.',
        ],
        howTo: [
          'Modifier un parametre a la fois.',
          'Valider et controler l effet metier.',
        ],
      },
      {
        id: 'outils-backup',
        title: 'backup comptable',
        summary: 'Sauvegarde et securisation des donnees comptables.',
        route: BACK_ROUTE_ABS_PATHS['BookBackup'],
        nav: {
          menuTitle: 'Outils',
          subMenuTitle: 'backup comptable',
          icon: 'bi-database-fill-gear',
          groupLevel: 'Systeme',
        },
        functionalities: [
          'Lancement des sauvegardes comptables.',
          'Verification du statut de sauvegarde.',
        ],
        howTo: [
          'Declencher la sauvegarde.',
          'Verifier que l operation est complete.',
        ],
      },
    ],
  },
  {
    id: 'site-web',
    title: 'Site web',
    summary: 'Gestion UI, menus et contenus dynamiques du front.',
    route: BACK_ROUTE_ABS_PATHS['UiConf'],
    nav: {
      menuTitle: 'Site web',
      icon: 'bi-globe2',
      groupLevel: 'Editeur',
    },
    functionalities: [
      'Parametrage UI global.',
      'Edition de la navigation dynamique.',
      'Gestion des pages et competitions.',
    ],
    howTo: [
      'Ajuster d abord les parametres UI.',
      'Mettre a jour les menus.',
      'Verifier le rendu front apres publication.',
    ],
    children: [
      {
        id: 'site-parametres-ui',
        title: 'parametres UI',
        summary: 'Reglages d apparence et comportement visuel du site.',
        route: BACK_ROUTE_ABS_PATHS['UiConf'],
        nav: {
          menuTitle: 'Site web',
          subMenuTitle: 'parametres UI',
          icon: 'bi-globe2',
          groupLevel: 'Editeur',
        },
        functionalities: [
          'Configuration des options d interface.',
          'Controle des parametres d affichage front.',
        ],
        howTo: [
          'Modifier le parametre cible.',
          'Verifier le rendu sur les pages principales.',
        ],
      },
      {
        id: 'site-menus',
        title: 'les menus',
        summary: 'Edition des menus et des routes dynamiques.',
        route: BACK_ROUTE_ABS_PATHS['MenusEditor'],
        nav: {
          menuTitle: 'Site web',
          subMenuTitle: 'les menus',
          icon: 'bi-globe2',
          groupLevel: 'Editeur',
        },
        functionalities: [
          'Creation et edition des entrees de menu.',
          'Regles de visibilite et ordre d affichage.',
        ],
        howTo: [
          'Mettre a jour une entree.',
          'Valider le rang et le comportement de navigation.',
        ],
      },
      {
        id: 'site-pages-datas',
        title: 'pages et datas',
        summary: 'Edition des pages et donnees CMS.',
        route: BACK_ROUTE_ABS_PATHS['CMSWrapper'],
        nav: {
          menuTitle: 'Site web',
          subMenuTitle: 'pages et datas',
          icon: 'bi-globe2',
          groupLevel: 'Editeur',
        },
        functionalities: [
          'Mise a jour de pages et snippets.',
          'Publication de contenus CMS.',
        ],
        howTo: [
          'Modifier le contenu cible.',
          'Verifier publication et navigation associee.',
        ],
      },
      {
        id: 'site-competitions',
        title: 'competitions',
        summary: 'Administration de la section competitions.',
        route: BACK_ROUTE_ABS_PATHS['Competitions'],
        nav: {
          menuTitle: 'Site web',
          subMenuTitle: 'competitions',
          icon: 'bi-globe2',
          groupLevel: 'Editeur',
        },
        functionalities: [
          'Creation/mise a jour des competitions.',
          'Synchronisation des infos visibles front.',
        ],
        howTo: [
          'Mettre a jour la competition cible.',
          'Verifier la publication pour les utilisateurs.',
        ],
      },
      {
        id: 'site-aller-front',
        title: 'aller sur le site',
        summary: 'Acces direct vers le front public.',
        route: '/front',
        nav: {
          menuTitle: 'Site web',
          subMenuTitle: 'aller sur le site',
          icon: 'bi-globe2',
          groupLevel: 'Editeur',
        },
        functionalities: [
          'Ouverture du site front en navigation directe.',
          'Verification du rendu public apres modifications back.',
        ],
        howTo: [
          'Cliquer sur aller sur le site.',
          'Controler le rendu des pages modifiees.',
        ],
      },
    ],
  },
  {
    id: 'communication',
    title: 'Communication',
    summary: 'Tickets, mailing, breaking news et sondages.',
    route: BACK_ROUTE_ABS_PATHS['Assistance'],
    nav: {
      menuTitle: 'Communication',
      icon: 'bi-envelope-paper',
      groupLevel: 'Editeur',
    },
    functionalities: [
      'Traitement des demandes d’assistance front.',
      'Diffusion d’informations via mailing et breaking news.',
      'Création et suivi de sondages.',
    ],
    howTo: [
      'Traiter d’abord les tickets prioritaires.',
      'Planifier ensuite les communications.',
      'Suivre les réponses des sondages actifs.',
    ],
    children: [
      {
        id: 'communication-assistance',
        title: 'Assistance',
        summary: 'Boite de traitement des tickets utilisateurs.',
        route: BACK_ROUTE_ABS_PATHS['Assistance'],
        nav: {
          menuTitle: 'Communication',
          subMenuTitle: 'Assistance',
          icon: 'bi-envelope-paper',
          groupLevel: 'Editeur',
        },
        functionalities: [
          'Filtrage des tickets par statut.',
          'Mise a jour et cloture des demandes.',
        ],
        howTo: [
          'Passer le ticket en En cours a la prise en charge.',
          'Passer a Resolu apres verification de resolution.',
        ],
      },
      {
        id: 'communication-mailing',
        title: 'Mailing',
        summary: 'Preparation et envoi de messages cibles.',
        route: BACK_ROUTE_ABS_PATHS['Mailing'],
        nav: {
          menuTitle: 'Communication',
          subMenuTitle: 'Mailing',
          icon: 'bi-envelope-paper',
          groupLevel: 'Editeur',
        },
        functionalities: [
          'Preparation des campagnes.',
          'Validation du contenu avant diffusion.',
        ],
        howTo: [
          'Construire le message.',
          'Relire puis envoyer a la cible.',
        ],
      },
      {
        id: 'communication-breaking-news',
        title: 'Breaking News',
        summary: 'Publication d informations urgentes.',
        route: BACK_ROUTE_ABS_PATHS['BreakingNews'],
        nav: {
          menuTitle: 'Communication',
          subMenuTitle: 'Breaking News',
          icon: 'bi-envelope-paper',
          groupLevel: 'Editeur',
        },
        functionalities: [
          'Creation et activation de messages urgents.',
          'Pilotage de visibilite des annonces.',
        ],
        howTo: [
          'Renseigner le message et sa priorite.',
          'Activer puis verifier l affichage.',
        ],
      },
      {
        id: 'communication-sondage',
        title: 'Sondage',
        summary: 'Creation, publication et analyse de sondages.',
        route: BACK_ROUTE_ABS_PATHS['SondageList'],
        nav: {
          menuTitle: 'Communication',
          subMenuTitle: 'Sondage',
          icon: 'bi-envelope-paper',
          groupLevel: 'Editeur',
        },
        functionalities: [
          'Creation/edition des sondages.',
          'Consultation des resultats.',
        ],
        howTo: [
          'Configurer le sondage.',
          'Suivre les reponses puis ouvrir les resultats.',
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    summary: 'Vue synthetique de suivi des indicateurs back-office.',
    route: BACK_ROUTE_ABS_PATHS['Dashboard'],
    nav: {
      menuTitle: 'Dashboard',
      icon: 'bi-speedometer2',
      groupLevel: 'Contributeur',
    },
    functionalities: [
      'Lecture des indicateurs de pilotage.',
      'Acces rapide vers les ecrans prioritaires.',
    ],
    howTo: [
      'Ouvrir le dashboard en debut de session.',
      'Prioriser les actions selon les indicateurs.',
    ],
    children: [
      {
        id: 'dashboard-suivi',
        title: 'suivi indicateurs',
        summary: 'Controle quotidien des indicateurs principaux.',
        route: BACK_ROUTE_ABS_PATHS['Dashboard'],
        nav: {
          menuTitle: 'Dashboard',
          subMenuTitle: 'suivi indicateurs',
          icon: 'bi-speedometer2',
          groupLevel: 'Contributeur',
        },
        functionalities: [
          'Analyse des alertes visibles.',
          'Orientation rapide vers les modules cibles.',
        ],
        howTo: [
          'Scanner les alertes du jour.',
          'Basculer sur la section a traiter.',
        ],
      },
    ],
  },
  {
    id: 'devtools',
    title: 'DevTools',
    summary: 'Operations techniques réservées aux développeurs et administrateurs système.',
    route: BACK_ROUTE_ABS_PATHS['RootVolume'],
    nav: {
      menuTitle: 'DevTools',
      icon: 'bi-wrench',
      groupLevel: 'Systeme',
    },
    functionalities: [
      'Acces S3/disque et import technique.',
      'Operations clone DB/S3.',
    ],
    howTo: [
      'Verifier le contexte avant action.',
      'Executer uniquement l operation necessaire.',
      'Controler les impacts apres execution.',
    ],
    caution: [
      'Menu reserve a des actions a impact potentiellement fort.',
    ],
    children: [
      {
        id: 'devtools-donnees-s3',
        title: 'donnees S3',
        summary: 'Acces technique aux donnees de stockage.',
        route: BACK_ROUTE_ABS_PATHS['RootVolume'],
        nav: {
          menuTitle: 'DevTools',
          subMenuTitle: 'donnees S3',
          icon: 'bi-wrench',
          groupLevel: 'Systeme',
        },
        functionalities: [
          'Exploration des volumes de donnees.',
          'Verification de presence des fichiers.',
        ],
        howTo: [
          'Ouvrir le volume cible.',
          'Verifier les donnees attendues.',
        ],
      },
      {
        id: 'devtools-import-excel',
        title: 'import excel',
        summary: 'Import technique de donnees depuis Excel.',
        route: BACK_ROUTE_ABS_PATHS['ImportExcel'],
        nav: {
          menuTitle: 'DevTools',
          subMenuTitle: 'import excel',
          icon: 'bi-wrench',
          groupLevel: 'Systeme',
        },
        functionalities: [
          'Chargement de fichiers d import.',
          'Transformation/creation des enregistrements.',
        ],
        howTo: [
          'Verifier le format du fichier.',
          'Lancer l import puis controler le resultat.',
        ],
      },
      {
        id: 'devtools-clone-db',
        title: 'clone DB',
        summary: 'Operation de clonage base de donnees.',
        route: BACK_ROUTE_ABS_PATHS['CloneDB'],
        nav: {
          menuTitle: 'DevTools',
          subMenuTitle: 'clone DB',
          icon: 'bi-wrench',
          groupLevel: 'Systeme',
        },
        functionalities: [
          'Declenchement d un clone de base.',
          'Suivi de progression de clonage.',
        ],
        howTo: [
          'Confirmer l environnement cible.',
          'Lancer clone DB puis verifier l issue.',
        ],
      },
      {
        id: 'devtools-clone-s3',
        title: 'clone S3',
        summary: 'Operation de clonage de stockage S3.',
        route: BACK_ROUTE_ABS_PATHS['CloneS3'],
        nav: {
          menuTitle: 'DevTools',
          subMenuTitle: 'clone S3',
          icon: 'bi-wrench',
          groupLevel: 'Systeme',
        },
        functionalities: [
          'Declenchement du clonage S3.',
          'Verification des donnees clonees.',
        ],
        howTo: [
          'Verifier source/cible.',
          'Executer clone S3 puis controler le contenu.',
        ],
      },
    ],
  },
  {
    id: 'documentation',
    title: 'Documentation',
    summary: 'Aide en ligne du back-office et référence utilisateur.',
    route: BACK_ROUTE_ABS_PATHS['OnlineHelp'],
    nav: {
      menuTitle: 'Documentation',
      icon: 'bi-question-circle',
      groupLevel: 'Membre',
    },
    functionalities: [
      'Consultation des chapitres d’aide.',
      'Navigation par menus et sous-menus alignés sur la navbar.',
      'Support de correction du contenu fonctionnel.',
    ],
    howTo: [
      'Choisir un menu dans le sommaire à gauche.',
      'Ouvrir un sous-sujet si besoin.',
      'Utiliser Ouvrir l’écran pour accéder à la fonctionnalité.',
    ],
  },
];
