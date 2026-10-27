# Relevé d’intégration du manuel de référence BCSTO

Source examinée : `BCSTO_manuel_reference.pptx`  
Version documentaire cible : `2026-10-27.8`

Ce relevé décrit, pour chaque diapositive source, le contenu conservé dans la base documentaire commune. Les diapositives d’ouverture servent à l’ordre des chapitres ; elles ne créent pas de texte fonctionnel lorsqu’elles ne contiennent qu’un titre.

| Diapositive | Titre ou rôle | Contenu repris et destination | Reste à traiter ou écart constaté |
|---:|---|---|---|
| 1 | Présentation app BCSTO | Couverture et identité reprises par la couverture du manuel généré. | Aucun contenu fonctionnel. |
| 2 | Plan du manuel | Ordre pédagogique repris dans `manualChapterOrder` et la configuration du manuel. | Le sommaire du PPTX généré reste produit automatiquement. |
| 3 | Ouverture Architecture | Chapitre général `architecture`, placé en première position et publié. | Aucun texte fonctionnel sur la diapositive. |
| 4 | Quelques mots pour se comprendre | Glossaire vers `architecture-presentation-vocabulaire` / `glossaire-architecture`. | La source indique quatre niveaux d’habilitation ; le code courant définit cinq groupes. La documentation publiée suit le code. |
| 5 | BCSTO : une adresse, deux espaces | Textes vers `architecture-espaces` / `roles-des-espaces` ; dessin publié dans `architecture-deux-espaces.png`. | Le code confirme `/front`, `/back` et la mémorisation du dernier espace. |
| 6 | Architecture globale | Textes vers `architecture-systeme` / `composants-externes` ; dessin publié dans `architecture-globale.png`. | Les consoles FFB et Stripe restent des outils externes distincts de BCSTO. |
| 7 | Ouverture Tournois | Chapitre `tournois`. | Aucun texte fonctionnel sur la diapositive. |
| 8 | Achat rapide de carte de tournoi | Procédure vers `tournois` / `acheter-carte-rapidement`. | Complément ajouté depuis le code : si le joueur possède déjà une dette ou un avoir, BCSTO redirige vers la Boutique. L’icône n’apparaît que pour un crédit restant inférieur ou égal à quatre admissions. |
| 9 | Ouverture Boutique | Chapitre `boutique`. | Aucun texte fonctionnel sur la diapositive. |
| 10 | Back-office : vente en présentiel | Introduction et procédure vers `boutique-vente-adherent` / `realiser-vente-presentiel`. | Aucun. |
| 11 | Composition du panier | Acheteur, bénéficiaires, produits couplés, prix, dette et avoir vers `composer-panier`. | La modification du prix est conditionnée par les droits du vendeur. |
| 12 | Modes de règlement | Tableau vers `modes-reglement`. | Le code confirme que Virement et Avance créent une dette et ne constituent pas un encaissement reçu. |
| 13 | Paiement par carte au club | Procédure vers `payer-par-carte-au-club`. | Le TPE doit être disponible ; en cas de coupure, le résultat doit être contrôlé avant toute relance. |
| 14 | Validation et points d’attention | Contrôles et incidents vers `validation-points-attention`. | Le blocage des doublons concerne les achats d’adhésion ou de licence détectés par les garde-fous actuels, pas tous les produits. |
| 15 | Petits soucis, bons réflexes | Procédures vers `corriger-cheque-avec-avoir` et `corriger-mode-reglement`. | La suppression d’une écriture est réservée aux droits comptables appropriés et doit être précédée d’un contrôle. |
| 16 | Ouverture Gestion des adhérents | Chapitre `adherents`. | Aucun texte fonctionnel sur la diapositive. |
| 17 | Gestion des membres / Répertoire | Contenus déjà repris dans `adherents-repertoire` ; dessin déjà publié dans `repertoire-gestion-membres.png`. | Aucun. |
| 18 | Cartes d’admission : création | Contenus déjà repris dans `adherents-cartes` / `creation-automatique` et `creation-manuelle`. | Aucun. |
| 19 | Cartes d’admission : modification | Contenus déjà repris dans `adherents-cartes` / `modification-carte`, `consultation-export` et `illustration-parcours-carte-admissions`. | Aucun. |
| 20 | Contrôles : adhésions et déclarations FFB | Contenus déjà repris dans `adherents-controles` / `controles-coherence`. | Les contrôles diagnostiquent les écarts sans corriger automatiquement les paiements ou déclarations. |
| 21 | Contrôles : historique des achats | Contenus déjà repris dans `historique-compte-resultats` et `releve-adherent`. | Aucun. |
| 22 | Ouverture Comptabilité | Chapitre `comptabilite`. | Aucun texte fonctionnel sur la diapositive. |
| 23 | Encaissements : les opérations manuelles | Répartition entre `comptabilite` / `operations-manuelles`, `compta-etat-caisse`, `compta-cheques`, `compta-rapprochement` et `compta-ecriture`. | Le tamponnage, le comptage et la remise physique restent hors application. BCSTO enregistre les mouvements déclarés. |
| 24 | Ouverture Stripe | Chapitre `stripe`, déjà présent dans la base. | Aucun texte fonctionnel sur la diapositive. |
| 25 | Ouverture Outils | Chapitre `outils`, déjà présent dans la base. | Aucun texte fonctionnel sur la diapositive. |
| 26 | Ouverture Site web (CMS) | Chapitre `site-web`, enrichi et conservé dans l’ordre du manuel. | Aucun texte fonctionnel sur la diapositive. |
| 27 | Éditeur(s) site public — Menus, pages et articles | Textes vers `site-web` / `relation-navigation-contenus` ; dessin publié dans `cms-menus-pages-articles.png`. | Le code confirme que l’accueil est un composant spécifique alimenté par les articles marqués « à la une ». |
| 28 | Éditeur de barre de menu — structure de données | La mention « À écrire » n’a pas été publiée. Le fonctionnement actuel est documenté dans `site-menus` / `modifier-navigation` et `parametres-entree-menu`. | L’éditeur actuel utilise une sandbox, une prévisualisation connecté/non connecté et une promotion vers la production, absentes de la source. |
| 29 | Éditeur de pages et articles — structure de données | Textes et tableaux vers `structure-page`, `structure-article` et `modeles-pages`. Un SVG actualisé et son export PNG sont publiés sous le nom `cms-structure-pages-articles`. | La source utilise des noms anciens et omet `publishedAt`, `ownerPageId`, `documentPath` et deux modèles de fiches. Le dessin source non corrigé n’est donc pas publié tel quel. |
| 30 | Éditeur de pages et articles — interface utilisateur | Principes vers `modifier-page-articles` et `precautions-pages-articles`. | Les captures sont obsolètes. L’interface actuelle possède les onglets Contenu, Aperçu et Paramètres, le glisser-déposer, un presse-papiers et une gestion de médias. Elles restent seulement dans le PPTX source. |
| 31 | Ouverture Communication | Chapitre `communication`, déjà présent dans la base. | Aucun texte fonctionnel sur la diapositive. |
| 32 | Ouverture Dashboard | Chapitre `dashboard`, déjà présent dans la base. | Aucun texte fonctionnel sur la diapositive. |
| 33 | Ouverture DevTools | Chapitre `devtools`, déjà présent dans la base. | Aucun texte fonctionnel sur la diapositive. |
| 34 | Ouverture Documentation | Chapitre `documentation`, déjà présent dans la base. | Aucun texte fonctionnel sur la diapositive. |

## Illustrations publiées dans ce lot

| Fichier publié | Source modifiable | Usage |
|---|---|---|
| `projects/admin/src/assets/documentation/images/architecture-deux-espaces.png` | Diapositive 5 du PPTX de référence | Aide et manuel, rubrique `architecture-espaces`. |
| `projects/admin/src/assets/documentation/images/architecture-globale.png` | Diapositive 6 du PPTX de référence | Aide et manuel, rubrique `architecture-systeme`. |
| `projects/admin/src/assets/documentation/images/cms-menus-pages-articles.png` | Diapositive 27 du PPTX de référence | Aide et manuel, rubrique `site-web`. |
| `projects/admin/src/assets/documentation/images/cms-structure-pages-articles.svg` et son export `cms-structure-pages-articles.png` | Diapositive 29 du PPTX de référence, actualisée selon le modèle courant | Source modifiable SVG et version PNG partagée par l’aide et le manuel, rubrique `site-pages-datas`. |

Les exports PNG issus directement du PPTX sont recadrés sans redimensionnement. Le PPTX original reste la source modifiable des formes PowerPoint. Le SVG CMS est lui-même une source modifiable et conserve la signification du dessin d’origine avec les champs actuels ; son PNG est seulement une version de publication.
