# Migration: Automatisation du glyph basé sur le compte

## Situation

- **Avant**: Le champ `.glyph` était éditable via ProductsComponent UI
- **Maintenant**: Le champ `.glyph` est auto-déterminé basé sur `.account` (source de vérité)
- **Impact**: 14 produits en DB avec des glyphs qui ne correspondent plus à la nouvelle logique

## Architecture

### 1. Mapper centralisé  
Fichier: `common/utilities/account-glyph.mapper.ts`

**Exports:**
- `ACCOUNT_GLYPH_MAP` - lookup table account → icon
- `getGlyphForAccount(account)` - consulte le mapper
- `resolveGlyph(account?, fallbackGlyph?)` - avec fallback rétro-compat

**Utilisé par:**
- `ProductsComponent` - pour créer/mettre à jour
- `ShopComponent` - pour afficher

### 2. Logique de création/modification

**ProductsComponent:**
```typescript
onCreateProduct() {
  let product = this.productForm.getRawValue();
  product.glyph = getGlyphForAccount(product.account); // ✅ Auto-déterminé
  this.productService.createProduct(product);
}
```

### 3. Logique d'affichage

**ShopComponent:**
```typescript
getProductGlyph(product: Product): string {
  return resolveGlyph(product.account, product.glyph);
  // Préfère le compte (source de vérité)
  // Fallback sur glyph en DB si compte absent (legacy)
}
```

Template:
```html
<i [class]="'bi ' + getProductGlyph(product)"></i>
```

## Plan de nettoyage

### Phase 1: Données actuelles (MAINTENANT - aucune action requise)
- ✅ Les produits existants gardent leurs glyphs en DB (rétro-compatible)
- ✅ Nouveau code utilise `resolveGlyph()` avec fallback
- ✅ Aucune migration DB immédiate requise

### Phase 2: Synchronisation progressive (À faire manuellement)

Optionnel - si vous voulez harmoniser les données:

```sql
-- Mettre à jour les glyphs de tous les produits basés sur leur account
-- (Requête dépend de votre structure réelle)
UPDATE products 
SET glyph = CASE account
  WHEN 'ADH' THEN 'bi-person-vcard-fill'
  WHEN 'LIC' THEN 'bi-credit-card-fill'
  WHEN 'CAR' THEN 'bi-card-checklist'
  -- ... etc pour tous les comptes
  ELSE 'bi-tag-fill'
END
WHERE account IS NOT NULL;
```

### Phase 3: Suppression du champ (À définir)

Une fois que:
1. Tous les produits ont un `.account` valide
2. Tous les glyphs correspondent au mapper
3. Code testés en prod

Vous pourrez:
```typescript
// Supprimer du schema Product interface
// Supprimer de la DB
// Simplifier: utiliser juste resolveGlyph(product.account)
```

## Notes importantes

- **Champ .glyph non suprimable immédiatement** car il peut y avoir des imports/migrations legacy
- **resolveGlyph()** avec fallback = stratégie de migration progressive
- **Source de vérité = .account**, pas .glyph
- Nouveaux produits auront toujours le bon glyph auto via `getGlyphForAccount()`

## Maintenance

Si vous ajouter de nouveaux comptes à `revenue_and_expense_tree`:

1. Ajouter l'entry dans `ACCOUNT_GLYPH_MAP`
2. Redéployer
3. C'est tout - aucune autre logique ne change
