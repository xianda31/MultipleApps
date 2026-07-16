/**
 * Account-to-Glyph Mapper
 * Mappe les clés de compte aux icônes Bootstrap
 * Utilisé par ProductsComponent et ShopComponent
 * À terme: supprimer le champ .glyph du schema Product et utiliser cette fonction
 */

/**
 * Lookup table: Mappe les clés de compte aux icônes Bootstrap
 * Basée sur la structure réelle des revenues_and_expense_tree
 */
export const ACCOUNT_GLYPH_MAP: Record<string, string> = {
  'ADH': 'bi-person-vcard',      // Adhésion au club
  'LIC': 'bi-suit-club',       // Licences FFB
  'CAR': 'bi-table',                     // Carte de 10+2 droits de table
  'ACC': 'bi-cup-hot',            // Forfait tournoi accession
  'PER': 'bi-award',                     // Cours perfectionnement
  'INI': 'bi-easel',                   // Cours initiation
  'BIB': 'bi-book',              // Vente de livres
  'PAF': 'bi-balloon-fill',              // Participation fête
  'DdT': 'bi-wallet2',                // Droit de table à l'unité
  'KFE': 'bi-cup-hot',                // Machine café
  'DEFAULT': 'bi-tag-fill',           // Default générique
};

/**
 * Détermine l'icône Bootstrap basée sur le compte
 * @param account Clé du compte (ADH, LIC, CAR, etc.)
 * @returns Classe Bootstrap icon (bi-*)
 */
export function getGlyphForAccount(account: string): string {
  return ACCOUNT_GLYPH_MAP[account] || ACCOUNT_GLYPH_MAP['DEFAULT'];
}

/**
 * Résout le glyph pour un produit
 * Préfère le compte (logique source de vérité)
 * Fallback sur le glyph stocké en DB si le compte est absent
 * @param account Clé du compte
 * @param fallbackGlyph Glyph stocké en DB (rétro-compatibilité)
 * @returns Classe Bootstrap icon
 */
export function resolveGlyph(account?: string, fallbackGlyph?: string): string {
  if (account) {
    return getGlyphForAccount(account);
  }
  // Fallback pour data legacy sans compte mappé
  return fallbackGlyph || ACCOUNT_GLYPH_MAP['DEFAULT'];
}
