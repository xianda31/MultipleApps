# Génération du PowerPoint documentaire

Le pilote PowerPoint est généré localement à partir de
`projects/admin/src/assets/documentation/back-online-help.json`.
Il ne lance ni Angular ni le backend.

## Générer la présentation

Depuis la racine du dépôt :

```bash
npm run documentation:pptx
```

Le fichier est créé dans :

`dist/documentation/bcsto-gestion-adherents-pilote.pptx`

Pour exécuter les contrôles automatisés :

```bash
npm run documentation:pptx:test
```

## Ajouter une rubrique

1. Ajouter au JSON documentaire un `id` stable pour chaque procédure utilisée.
2. Ajouter l’identifiant de la rubrique dans `help-pptx.config.json`.
3. Ajouter une entrée dans `slides` avec `topicId`, `procedureIds` et
   `illustrationIds`.
4. Relancer `npm run documentation:pptx`.

Les textes fonctionnels, précautions et légendes restent dans le JSON
documentaire. La configuration ne contient que l’ordre et les références.
Une référence ou une illustration absente interrompt explicitement la
génération.

La charte graphique est centralisée dans `help-pptx-theme.mjs`.

Une rubrique générale indépendante du menu admin utilise `scope: "general"`
et peut omettre `routeKey` et `nav.menuTitle`. `manualChapterOrder` réserve sa
position dans le futur manuel. Tant qu’elle porte `contentStatus: "planned"` et
qu’elle n’est pas référencée dans `help-pptx.config.json`, elle reste visible
comme structure dans l’aide sans être générée dans le pilote PowerPoint.
