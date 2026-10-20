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

function licenseStatusLabel(status: string): string {
  return LICENSE_STATUS_LABELS[status] ?? status;
}

function formatFrenchDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value?.trim() ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function buildActiveMembersCsv(members: Member[]): string {
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
      licenseStatusLabel(member.license_status),
      member.memberStatus,
      member.license_taken_at,
      member.register_date,
      member.membership_date,
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
