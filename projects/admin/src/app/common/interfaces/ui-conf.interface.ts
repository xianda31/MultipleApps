
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
  // one_year_back: boolean;
  show_infos: boolean;
  // no_filter: boolean;
  // show_members_only: boolean;
}

export interface tplDef {
  bg:string;
  text_color: string;
}

export interface SiteDef {
  name: string;
  logo: string;
  image: string;
  font: string; // police globale du front
}

export interface UIConfiguration {
  template: {
    banner: tplDef;
    navbar: tplDef;
    content: tplDef;
    footer: tplDef;
    club: SiteDef;
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

