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
  ratio: number;
}

export interface UIConfiguration {
  template?: {
    logo_path?: string; // S3 path
    background_color?: string; // CSS color
  };

  homepage: {
    tournaments_row_cols: BreakpointsSettings;
    news_row_cols: BreakpointsSettings;
    // number of lines shown before a 'read more' link is displayed
    read_more_lines?: number;
    // when true, hovering a news card will unfold it entirely
    unfold_on_hover?: boolean;
    // delay in milliseconds before unfolding on hover
    hover_unfold_delay_ms?: number;
    // duration in milliseconds for the unfold animation
    hover_unfold_duration_ms?: number;
  };

  // Mapping of tournament type keyword -> thumbnail path
  tournaments_type?: { [key: string]: string };
  default_tournament_image?: string;


  frontBannerEnabled?: boolean;
  homepage_intro?: string;


  // thumbnail sizing used by site image processing
  thumbnail?: ImageSize;
  // future UI settings can be added here
  [key: string]: any;
}

