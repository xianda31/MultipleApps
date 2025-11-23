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
  };

  // Mapping of tournament type keyword -> thumbnail path
  tournaments_type?: { [key: string]: string };
  // Optional explicit default tournament image path (S3 path)
  default_tournament_image?: string;

  

  frontBannerEnabled?: boolean;
  homepage_intro?: string;
  // thumbnail sizing used by site image processing
  thumbnail?: ImageSize;
  // future UI settings can be added here
  [key: string]: any;
}

