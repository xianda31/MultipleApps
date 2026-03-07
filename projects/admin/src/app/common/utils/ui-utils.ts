import { BreakpointsSettings, UIConfiguration } from '../interfaces/ui-conf.interface';

export function clampBreakpoint(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (isNaN(n)) return null;
  return Math.max(1, Math.min(6, Math.trunc(n)));
}

// Initializer to apply UI theme variables before the app starts
import { SystemDataService } from '../services/system-data.service';
import { firstValueFrom } from 'rxjs';

export function applyUiThemeInitializer(systemDataService: SystemDataService) {
  return async () => {
    try {
        const ui = await firstValueFrom(systemDataService.get_ui_settings());
        const t: any = ui?.template || {};
        const root = document.documentElement;
        const bannerBg = t?.banner?.bg ?? t?.banner_bg;
        const bannerTextColor = t?.banner?.text_color ?? t?.banner_text_color;
        const navbarBg = t?.navbar?.bg ?? t?.navbar_bg;
        const navbarTextColor = t?.navbar?.text_color ?? t?.navbar_text_color;
        if (bannerBg) {
          root.style.setProperty('--brand-bg', bannerBg);
          root.style.setProperty('--title-bg', bannerBg);
          root.style.setProperty('--footer-bg', bannerBg);
        }
        if (bannerTextColor) {
          root.style.setProperty('--brand-text', bannerTextColor);
          root.style.setProperty('--title-text', bannerTextColor);
          root.style.setProperty('--footer-text', bannerTextColor);
        }
        if (navbarBg) root.style.setProperty('--navbar-bg', navbarBg);
        if (navbarTextColor) root.style.setProperty('--navbar-text', navbarTextColor);
      } catch (e) {
      // ignore errors, keep default theme variables from assets
    }
  };
}

export function normalizeBreakpoints(b: any): BreakpointsSettings {
  // Defaults to a sensible ascending set when missing.
  if (!b) return { SM: 1, MD: 2, LG: 3, XL: 4 } as BreakpointsSettings;
  const pick = (keys: string[]) => {
    for (const k of keys) if (b?.[k] !== undefined) return b[k];
    return undefined;
  };
  const sm = clampBreakpoint(pick(['SM', 'Sm', 'sm'])) ?? 1;
  const md = clampBreakpoint(pick(['MD', 'Md', 'md'])) ?? 2;
  const lg = clampBreakpoint(pick(['LG', 'Lg', 'lg'])) ?? 3;
  const xl = clampBreakpoint(pick(['XL', 'Xl', 'xl'])) ?? 4;
  return {
    SM: sm,
    MD: md,
    LG: lg,
    XL: xl,
  } as BreakpointsSettings;
}

/**
 * Format bootstrap row classes from canonical BreakpointsSettings.
 * Returns an array of classes to apply on the container element.
 */
export function formatRowColsClasses(bp: BreakpointsSettings | undefined): string[] {
  const classes: string[] = [ 'row', 'row-cols-1', 'g-3', 'justify-content-center'];
  const cols = bp || ({ SM: 1, MD: 2, LG: 3, XL: 4 } as BreakpointsSettings);
  if (cols.SM !== undefined && cols.SM !== null) classes.push('row-cols-sm-' + cols.SM);
  if (cols.MD !== undefined && cols.MD !== null) classes.push('row-cols-md-' + cols.MD);
  if (cols.LG !== undefined && cols.LG !== null) classes.push('row-cols-lg-' + cols.LG);
  if (cols.XL !== undefined && cols.XL !== null) classes.push('row-cols-xl-' + cols.XL);
  return classes;
}

export function applyUiThemeFromConfig(ui: UIConfiguration | null | undefined) {
  if (!ui) return;
  const t: any = ui.template || {};
  const root = document.documentElement;
  // Contenu page (autour du router)
  // Prefer new nested properties, fall back to legacy flat keys for older stored configs
  const contentFont = t.site_font ?? t.content_font ?? t['content_font'];
  const contentBg = t?.content?.bg ?? t?.content_bg;
  const contentText = t?.content?.text_color ?? t?.content_text_color;
  const bannerBg = t?.banner?.bg ?? t?.banner_bg;
  const bannerTextColor = t?.banner?.text_color ?? t?.banner_text_color;
  const navbarBg = t?.navbar?.bg ?? t?.navbar_bg;
  const navbarTextColor = t?.navbar?.text_color ?? t?.navbar_text_color;
  const footerBg = t?.footer?.bg ?? t?.footer_bg;
  const footerTextColor = t?.footer?.text_color ?? t?.footer_text_color;
  if (bannerBg) {
    root.style.setProperty('--banner-bg', bannerBg);
    root.style.setProperty('--brand-bg', bannerBg);
    root.style.setProperty('--title-bg', bannerBg);
    root.style.setProperty('--footer-bg', bannerBg);
  }
  if (bannerTextColor) {
    root.style.setProperty('--banner-text-color', bannerTextColor);
    root.style.setProperty('--brand-text', bannerTextColor);
    root.style.setProperty('--title-text', bannerTextColor);
    root.style.setProperty('--footer-text', bannerTextColor);
  }
  if (navbarBg) root.style.setProperty('--navbar-bg', navbarBg);
  if (navbarTextColor) {
    root.style.setProperty('--navbar-text', navbarTextColor);
    root.style.setProperty('--navbar-text-color', navbarTextColor);
  }

  // Footer specific variables: prefer footer settings, fall back to banner
  if (footerBg) root.style.setProperty('--footer-bg', footerBg);
  else if (bannerBg) root.style.setProperty('--footer-bg', bannerBg);
  if (footerTextColor) root.style.setProperty('--footer-text', footerTextColor);
  else if (bannerTextColor) root.style.setProperty('--footer-text', bannerTextColor);

  // --- Google Fonts dynamic injection ---
  // Remove previous dynamic font links
  const prevLinks = document.querySelectorAll('link[data-ui-dynamic-font]');
  prevLinks.forEach(l => l.parentNode?.removeChild(l));

  // Helper to build Google Fonts URL for a font family
  function buildGoogleFontUrl(font: string): string | null {
    if (!font) return null;
    // Extract family name (before comma)
    const family = font.split(',')[0].replace(/['\"]/g, '').trim().replace(/ /g, '+');
    if (!family) return null;
    return `https://fonts.googleapis.com/css?family=${family}:400,700&display=swap`;
  }

  // Inject fonts: prefer site_font then fallbacks. Keep deduplicated set.
  const siteFont = t.site_font ?? t.main_font ?? null;
  const bannerFont = t.banner?.font ?? t.banner_font ?? siteFont;
  const navbarFont = t.navbar?.font ?? t.navbar_font ?? siteFont;
  const loadedFonts = new Set<string>();
  [siteFont, bannerFont, navbarFont, contentFont].forEach(font => {
    if (font && typeof font === 'string' && !loadedFonts.has(font)) {
      const url = buildGoogleFontUrl(font);
      if (url) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.setAttribute('data-ui-dynamic-font', '1');
        document.head.appendChild(link);
        loadedFonts.add(font);
      }
    }
  });

  // Set CSS variables for font families
  if (siteFont) {
    root.style.setProperty('--site-font', siteFont);
    // also set content/banner/footer defaults when specific fonts are not set
    if (!bannerFont) root.style.setProperty('--banner-font', siteFont);
    if (!navbarFont) root.style.setProperty('--navbar-font', siteFont);
    if (!contentFont) root.style.setProperty('--content-font', siteFont);
  }
  if (bannerFont) {
    root.style.setProperty('--banner-font', bannerFont);
    root.style.setProperty('--footer-font', bannerFont);
  }
  if (navbarFont) root.style.setProperty('--navbar-font', navbarFont);

  if (contentFont) root.style.setProperty('--content-font', contentFont);
  if (contentBg) root.style.setProperty('--content-bg', contentBg);
  if (contentText) root.style.setProperty('--content-text', contentText);
}
