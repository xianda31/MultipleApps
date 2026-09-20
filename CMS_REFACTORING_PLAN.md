# Plan de refactorisation du CMS

## Objectifs

- Simplifier le parcours `Page -> Article -> Contenu et médias -> Aperçu`.
- Conserver `page_id` comme lien stable entre navigation et pages.
- Garder les pages indépendantes des menus.
- Considérer qu'un article appartient opérationnellement à une seule page.
- Préserver la lecture des chemins S3 historiques pendant toute la migration.
- Valider chaque évolution sur l'environnement de développement avant la production.

## Lots 1 à 3 - réalisés

### Lot 1 - Espace maître/détail

- Sélecteur de page repliable avec statut de navigation.
- Liste compacte des articles et éditeur large.
- Aperçu et paramètres dans des onglets dédiés.
- Pages non liées à un menu conservées et identifiables.

### Lot 2 - Éditeur contextuel

- Champs visibles et obligatoires déterminés par le modèle de la page.
- Diagnostic des articles incomplets.
- Conservation de la signification de `public` : visible sans connexion.

### Lot 3 - Médiathèque contextuelle

- Sélection et import depuis l'éditeur d'article.
- Destination S3 déterminée par l'article et le type de média.
- Compatibilité maintenue avec les anciens chemins S3.

## Lot 4 - Pipeline d'illustrations adaptatif

### Décision d'architecture

Le traitement d'image ne doit pas être réalisé à l'initialisation d'une page. Il doit être déclenché à l'import ou lorsqu'une page change vers un modèle nécessitant un autre profil, puis le résultat doit être conservé dans S3.

Les modèles sont regroupés par profil d'usage afin d'éviter une variante distincte pour chaque modèle.

| Profil | Modèles | Géométrie cible | Ajustement |
| --- | --- | --- | --- |
| `inline` | `publication`, `séquentiel`, `à la une` | max. 400 x 300 | `contain`, sans recadrage |
| `landscape-card` | `fiches img haut`, `fiches img haut-gauche`, `fiches img bas` | 800 x 533 | `cover`, recadrage 3:2 |
| `portrait-card` | `trombinoscope`, `albums` | 600 x 800 | `cover`, recadrage 3:4 |
| `booklet` | `livret` | 960 x 640 | `cover` |
| aucun | `téléchargement` | aucune variante | sans traitement |

Les dimensions cibles incluent une marge adaptée aux écrans haute densité. Elles devront être confrontées aux poids réels obtenus sur un jeu d'images représentatif avant validation définitive.

### Stockage cible

```text
images/cms/snippets/{snippetId}/source/{assetId}.{extension}
images/cms/snippets/{snippetId}/variants/{profile}/{assetId}.webp
```

Principes :

- conserver un original source unique ;
- produire uniquement la variante requise par le modèle courant ;
- réutiliser une variante déjà calculée ;
- ne jamais remplacer ou supprimer automatiquement un média historique pendant cette phase ;
- appliquer des noms déterministes et une politique `Cache-Control` longue aux variantes immuables.

### Traitement cible

Le traitement de référence sera exécuté côté AWS après dépôt de l'original, idéalement par une fonction utilisant `sharp` :

- correction de l'orientation EXIF ;
- suppression des métadonnées inutiles ;
- redimensionnement sans agrandissement ;
- recadrage selon le profil ;
- génération WebP avec une qualité initiale de 80 ;
- contrôle du poids et des dimensions produits ;
- résultat reproductible quel que soit le navigateur de l'administrateur.

Le navigateur ne produit qu'un aperçu immédiat. Il ne constitue pas la source définitive du traitement.

### Contrat applicatif

- Centraliser le mapping dans une table `PAGE_TEMPLATE_IMAGE_PROFILE` testée.
- Transmettre le modèle de la page à la demande d'import.
- Enregistrer l'original avant de lancer le traitement.
- N'associer `Snippet.image` qu'après succès de la variante.
- Continuer à accepter un ancien chemin direct dans `Snippet.image`.
- Si le modèle change, générer le nouveau profil depuis l'original sans nouvel envoi utilisateur.
- Prévoir à terme un manifeste d'asset ou des champs dédiés pour distinguer source et variantes.

### Migration progressive

1. Déployer les profils et le traitement sur l'environnement de développement.
2. Tester avec des images paysage, portrait, PNG transparent et fichier volumineux.
3. Activer le nouveau pipeline uniquement pour les nouveaux imports.
4. Servir les anciens chemins sans conversion obligatoire.
5. Ajouter une commande de migration par lots, relançable et non destructive.
6. Comparer dimensions, poids et rendu avant/après pour chaque profil.
7. Déployer exactement le commit validé en production.
8. Reporter toute suppression d'anciens objets après une période d'observation et un inventaire des références.

### Critères d'acceptation

- Aucun calcul d'image au chargement d'une page publique.
- Une seule variante générée par profil réellement utilisé.
- Aucun agrandissement d'une source trop petite.
- Le poids d'une variante est sensiblement inférieur à celui de la source.
- Le rendu reste net sur écran haute densité.
- Une erreur de traitement ne remplace pas l'illustration existante.
- Les images historiques restent lisibles.
- Le changement de modèle produit ou réutilise le bon profil.

## Lot 5 - Propriété et cycle de vie des articles

- Rendre explicite l'unique page propriétaire d'un article.
- Distinguer déplacement, mise en attente et suppression définitive.
- Faire suivre les médias possédés par l'article lors de son cycle de vie.
- Ne supprimer un objet S3 qu'après vérification de l'absence de référence.
- Prévoir sauvegarde, simulation et reprise pour chaque migration.

## Ordre recommandé

1. Finaliser et valider les ajustements UI en cours.
2. Implémenter le lot 4 sans migration destructive.
3. Observer le pipeline sur les données de développement.
4. Déployer le lot 4 en production.
5. Concevoir puis exécuter le lot 5 avec inventaire préalable des références.
