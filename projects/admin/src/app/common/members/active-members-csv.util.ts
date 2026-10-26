import { LicenseStatus, Member } from '../interfaces/member.interface';
import { formatPhoneNumber } from '../pipes/phone.pipe';

const CSV_FORMULA_PREFIX = /^[=+\-@]/;

const LICENSE_STATUS_LABELS: Record<string, string> = {
  [LicenseStatus.DULY_REGISTERED]: 'Licencié',
  [LicenseStatus.PROMOTED_ONLY]: 'Promotion',
  [LicenseStatus.UNREGISTERED]: 'Non licencié',
};

function toCsvCell(value: unknown): string {
  const flattened = String(value ?? '').replace(/\s+/g, ' ').trim();
  const guarded = CSV_FORMULA_PREFIX.test(flattened) ? `'${flattened}` : flattened;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function licenseStatusLabel(member: Member): string {
  const licensedOutsideClub = member.orga_license_name
    || (
      member.memberStatus === 'SYMPATHISANT'
      && (member.license_status === LicenseStatus.DULY_REGISTERED
        || member.license_status === LicenseStatus.PROMOTED_ONLY)
    );
  if (licensedOutsideClub) {
    return 'Licencié hors club';
  }
  return LICENSE_STATUS_LABELS[member.license_status] ?? member.license_status;
}

function formatFrenchDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value?.trim() ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function currentSeason(date: Date = new Date()): string {
  const year = date.getFullYear();
  return date.getMonth() < 6
    ? `${year - 1}/${year}`
    : `${year}/${year + 1}`;
}

export function hasMembershipForSeason(membershipDate: string, season: string): boolean {
  const seasonMatch = /^(\d{4})\/(\d{4})$/.exec(season);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(membershipDate?.trim() ?? '');
  if (!seasonMatch || !dateMatch) return false;

  const date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  return date >= `${seasonMatch[1]}-07-01` && date <= `${seasonMatch[2]}-06-30`;
}

export function buildActiveMembersCsv(members: Member[], season: string = currentSeason()): string {
  const headers = [
    'Nom',
    'Prénom',
    'Genre',
    'Licence',
    'Statut de licence',
    'memberStatus',
    'Club de licence',
    'Date de licence',
    'Date d’adhésion',
    `Adhésion ${season} réglée`,
    'Date de naissance',
    'Email',
    'Téléphone',
    'Ville',
    'Accepte les mails',
    'IV',
    'Code IV',
  ];

  const rows = members
    .filter((member) => (member.lifecycleStatus ?? 'ACTIVE') === 'ACTIVE')
    .sort((left, right) => {
      const lastNameOrder = left.lastname.localeCompare(right.lastname, 'fr', { sensitivity: 'base' });
      return lastNameOrder || left.firstname.localeCompare(right.firstname, 'fr', { sensitivity: 'base' });
    })
    .map((member) => [
      member.lastname,
      member.firstname,
      member.gender,
      member.license_number,
      licenseStatusLabel(member),
      member.memberStatus,
      member.orga_license_name || member.license_taken_at,
      member.register_date,
      member.membership_date,
      hasMembershipForSeason(member.membership_date, season) ? 'Oui' : 'Non',
      formatFrenchDate(member.birthdate),
      member.email,
      formatPhoneNumber(member.phone_one),
      member.city,
      member.accept_mailing ? 'Oui' : 'Non',
      member.iv,
      member.iv_code,
    ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => toCsvCell(cell)).join(';'))
    .join('\r\n');
}

export function activeMembersCsvFileName(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `membres-actifs-${year}-${month}-${day}.csv`;
}
