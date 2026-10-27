# Documentation commune BCSTO

La source commune de l’aide Angular et du manuel PowerPoint est :

`projects/admin/src/assets/documentation/back-online-help.json`

Les textes fonctionnels, tableaux et références d’illustrations doivent être
modifiés dans ce fichier. Le générateur ne lance ni Angular ni le backend.

## Modèle par blocs

Chaque rubrique conserve son résumé court pour la navigation et expose son
contenu dans `blocks`. L’ordre du tableau est l’ordre d’affichage dans l’aide et
dans le PowerPoint.

Chaque bloc possède un `id` stable et un type :

- `text` : `title` facultatif et `paragraphs` ;
- `list` : `title` facultatif et `items` ;
- `procedure` : `title` et `steps` numérotées ;
- `illustration` : `illustrationId` et `caption` facultative ;
- `table` : `title` facultatif, `columns` et `rows` ;
- `attention` : `title` facultatif et `messages`.

Exemple :

```json
{
  "blocks": [
    {
      "id": "introduction",
      "type": "text",
      "paragraphs": ["Présentation de la rubrique."]
    },
    {
      "id": "controle",
      "type": "procedure",
      "title": "Effectuer le contrôle",
      "steps": ["Première étape.", "Deuxième étape."]
    },
    {
      "id": "tarifs",
      "type": "table",
      "title": "Tarifs",
      "columns": ["Produit", "Prix"],
      "rows": [["Carte", "30 €"]]
    }
  ]
}
```

Les fichiers d’illustration restent déclarés dans `illustrations`. Un bloc
`illustration` les référence par leur identifiant ; il ne recopie pas leur
chemin, leur texte alternatif ou leur provenance.

Ne pas ajouter de numéro de diapositive dans le JSON. La pagination et le
regroupement des blocs courts sont calculés par le générateur.

## Prévisualiser l’aide Angular

Depuis la racine du dépôt :

```bash
npm start
```

Ouvrir ensuite l’aide en ligne du back-office et contrôler :

- l’ordre des blocs ;
- la navigation entre les sous-rubriques ;
- les tableaux aux largeurs mobile et bureau ;
- les illustrations et leurs légendes.

## Générer le PowerPoint

```bash
npm run documentation:pptx
```

Les fichiers sont créés dans :

- `dist/documentation/bcsto-manuel-complet.pptx`
- `dist/documentation/bcsto-manuel-complet.couverture.json`

Le rapport distingue les rubriques incluses, planifiées, vides ou non prises
en charge. Un bloc inconnu ou invalide est signalé avec son identifiant.

Pour exécuter les contrôles de migration et de génération :

```bash
npm run documentation:pptx:test
```

La charte graphique reste centralisée dans `help-pptx-theme.mjs`. Les
paramètres de sortie restent dans `help-pptx.config.json` et ne doivent pas être
ajoutés au contenu documentaire.

## Ajouter ou déplacer du contenu

1. Modifier ou ajouter un bloc dans la rubrique concernée.
2. Conserver son `id` lors des corrections ultérieures.
3. Déplacer le bloc dans le tableau pour changer son ordre.
4. Pour une illustration, ajouter le fichier dans les assets, déclarer ses
   métadonnées dans `illustrations`, puis ajouter le bloc qui la référence.
5. Exécuter les tests, prévisualiser l’aide et régénérer le PowerPoint.

Une rubrique générale indépendante du menu admin utilise `scope: "general"`
et peut omettre `routeKey` et `nav.menuTitle`. Une rubrique
`contentStatus: "planned"` reste visible comme structure dans l’aide, mais
n’est pas publiée dans le PowerPoint.

## Corrections manuelles du PowerPoint

Les retouches directes du PPTX généré ne sont jamais réimportées dans le JSON.
Pour conserver une version corrigée manuellement :

1. enregistrer le PPTX sous un nom distinct ;
2. identifier chaque correction à reporter ;
3. appliquer les changements dans le JSON, les illustrations, le thème ou le
   générateur selon leur nature ;
4. régénérer le manuel ;
5. comparer le nouveau fichier généré au PPTX corrigé conservé séparément.

Le fichier généré reste reproductible et ne doit pas devenir une seconde source
documentaire.
