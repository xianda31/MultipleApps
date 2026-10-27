# Génération du PowerPoint documentaire

Le manuel PowerPoint est généré localement à partir de
`projects/admin/src/assets/documentation/back-online-help.json`.
Il ne lance ni Angular ni le backend.

## Générer la présentation

Depuis la racine du dépôt :

```bash
npm run documentation:pptx
```

Les fichiers sont créés dans :

- `dist/documentation/bcsto-manuel-complet.pptx`
- `dist/documentation/bcsto-manuel-complet.couverture.json`

Pour exécuter les contrôles automatisés :

```bash
npm run documentation:pptx:test
```

## Ajouter une rubrique publiée

1. Ajouter la rubrique dans le JSON documentaire à la position voulue.
2. Utiliser des identifiants stables pour la rubrique, ses procédures et ses
   illustrations.
3. Renseigner les champs documentaires utiles.
4. Relancer `npm run documentation:pptx`.

Le générateur restitue `summary`, `functionalities`, `howTo`, `procedures`,
`caution` et `illustrations` dans l’ordre des chapitres et rubriques du JSON.
Une rubrique `planned` est exclue du manuel publié et apparaît dans le rapport
de couverture avec le motif de son exclusion.

La charte graphique est centralisée dans `help-pptx-theme.mjs`.

Une rubrique générale indépendante du menu admin utilise `scope: "general"`
et peut omettre `routeKey` et `nav.menuTitle`. `manualChapterOrder` réserve sa
position dans le manuel. Tant qu’elle porte `contentStatus: "planned"`, elle
reste visible comme structure dans l’aide sans être publiée dans le PowerPoint.
