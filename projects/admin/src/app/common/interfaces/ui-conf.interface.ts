
// UI-specific interfaces extracted from system configuration

import { COMPETITION_LEVELS } from "../../back/competitions/competitions.interface";


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

export interface CompetitionsUIConfig {
  preferred_organizations: { [key in COMPETITION_LEVELS]: string };
  result_filter_thresholds: { [key: string]: number };
  show_members_only: boolean;
  one_year_back: boolean;
  show_infos: boolean;
  no_filter: boolean;
}


export interface UIConfiguration {
  template: {
    logo_path?: string; // S3 path

    banner_bg: string; // Couleur bandeau supérieur
    banner_text_color: string; // Couleur du texte du bandeau
    banner_font: string; // Police du bandeau Google Fonts

    navbar_bg: string; // Couleur navbar
    navbar_text_color: string; // Couleur du texte de la navbar
    navbar_font: string; // Police de la navbar Google Fonts

    content_bg: string; // Fond du contenu page
    content_text_color: string; // Couleur texte du contenu page
    content_font: string; // Police du contenu page Google Fonts
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


  // Configuration des compétitions (préférences affichage, filtres, etc)
  competitions: CompetitionsUIConfig;
}

