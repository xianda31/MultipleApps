// UI-specific interfaces extracted from system configuration

export interface BreakpointsSettings {
  SM: number;
  MD: number;
  LG: number;
  XL: number;
}

export interface ImageSize {
  width: number;
  height: number;
  // ratio?: number;
}

export interface UIConfiguration {
  template?: {
    logo_path?: string; // S3 path
    background_color?: string; // CSS color
  };

  homepage: {
    // parameters for layout of tournaments and news cards on homepage
    tournaments_row_cols: BreakpointsSettings;
    news_row_cols: BreakpointsSettings;
    // parameters for 'read more' behavior on news cards
    read_more_lines?: number;
    unfold_on_hover?: boolean;
    hover_unfold_delay_ms?: number;
    hover_unfold_duration_ms?: number;
    // layout ratio for homepage: 1 = equal columns (col-md-6 / col-md-6), 2 = tournaments wider (col-md-8 / col-md-4)
    home_layout_ratio?: 1 | 2;
  };

  // Mapping of tournament type keyword -> thumbnail path
  tournaments_type?: { [key: string]: string };
  default_tournament_image?: string;


  frontBannerEnabled?: boolean;
  homepage_intro?: string;

  // Configuration des emails
  email?: {
    tagline?: string; // Accroche affichée dans l'en-tête des emails
    ccEmail?: string; // Adresse email en copie pour tous les mailings
  };


  // thumbnail sizing used by site image processing
  card_thumbnails: ImageSize[];
  album_thumbnail: ImageSize;
  // Intervalle de défilement automatique du carousel d'albums (en ms)
  album_carousel_interval_ms?: number;
  // future UI settings can be added ici
  [key: string]: any;
}

