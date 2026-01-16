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
      const t = ui?.template || {};
      const root = document.documentElement;
      const headerBg = t['header_bg'] || ui['header_bg'];
      const headerTextColor = t['header_text_color'] || ui['header_text_color'];
      const navbarBg = t['navbar_bg'] || ui['navbar_bg'];
      const navbarTextColor = t['navbar_text_color'] || ui['navbar_text_color'];
      const footerBg = t['footer_bg'] || ui['footer_bg'];
      const footerTextColor = t['footer_text_color'] || ui['footer_text_color'];
      if (headerBg) {
        root.style.setProperty('--brand-bg', headerBg);
        root.style.setProperty('--title-bg', headerBg);
      }
      if (headerTextColor) {
        root.style.setProperty('--brand-text', headerTextColor);
        root.style.setProperty('--title-text', headerTextColor);
      }
      if (navbarBg) root.style.setProperty('--navbar-bg', navbarBg);
      if (navbarTextColor) root.style.setProperty('--navbar-text', navbarTextColor);
      if (footerBg) root.style.setProperty('--footer-bg', footerBg);
      if (footerTextColor) root.style.setProperty('--footer-text', footerTextColor);
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
  classes.push('row-cols-md-' + cols.MD);
  if (cols.LG !== undefined && cols.LG !== null) classes.push('row-cols-lg-' + cols.LG);
  if (cols.XL !== undefined && cols.XL !== null) classes.push('row-cols-xl-' + cols.XL);
  return classes;
}

export function applyUiThemeFromConfig(ui: UIConfiguration | null | undefined) {
  if (!ui) return;
  const t = ui.template || {};
  const root = document.documentElement;
  if (t.header_bg) {
    root.style.setProperty('--brand-bg', t.header_bg);
    root.style.setProperty('--title-bg', t.header_bg);
  }
  if (t.header_text_color) {
    root.style.setProperty('--brand-text', t.header_text_color);
    root.style.setProperty('--title-text', t.header_text_color);
  }
  if (t.navbar_bg) root.style.setProperty('--navbar-bg', t.navbar_bg);
  if (t.navbar_text_color) root.style.setProperty('--navbar-text', t.navbar_text_color);
  if (t.footer_bg) root.style.setProperty('--footer-bg', t.footer_bg);
  if (t.footer_text_color) root.style.setProperty('--footer-text', t.footer_text_color);
}
