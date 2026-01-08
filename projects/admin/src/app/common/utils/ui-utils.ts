import { BreakpointsSettings } from '../interfaces/ui-conf.interface';

export function clampBreakpoint(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (isNaN(n)) return null;
  return Math.max(1, Math.min(6, Math.trunc(n)));
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
