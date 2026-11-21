export interface FfbClubIdentity {
  code: string;
  organizationId: string;
}

export const LEGACY_FFB_CLUB_IDENTITY: FfbClubIdentity = {
  code: '5500020',
  organizationId: '1403',
};

export function resolveFfbClubIdentity(configuration: unknown): { identity: FfbClubIdentity; legacy: boolean } {
  if (!configuration || typeof configuration !== 'object') {
    throw new Error('Configuration FFB invalide');
  }
  const code = 'ffb_club_code' in configuration ? configuration.ffb_club_code : undefined;
  const organizationId = 'ffb_organization_id' in configuration ? configuration.ffb_organization_id : undefined;
  if (code == null && organizationId == null) {
    return { identity: LEGACY_FFB_CLUB_IDENTITY, legacy: true };
  }
  if (typeof code !== 'string' || !/^\d{7}$/.test(code)
    || typeof organizationId !== 'string' || !/^[1-9]\d*$/.test(organizationId)) {
    throw new Error('Identifiants FFB du club invalides ou incomplets');
  }
  return { identity: { code, organizationId }, legacy: false };
}
