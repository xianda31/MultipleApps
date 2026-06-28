export interface PersonV2Ranking {
  ic: number;
  iv: number;
  pe: number;
  pec: number;
  pp: number;
  ppc: number;
}

/**
 * FFB V2 Person - Domain model
 * Extracted from FFB API /ffb/person response by toPersonV2() adapter
 */
export interface PersonV2 {
  license_number: string;     // ffbId padded to 8 digits
  firstName: string;
  lastName: string;           // uppercase
  email: string;
  address: string;            // address.address
  city: string;               // address.city
  phone: string | null;       // phone1.number
  seasonCategory: string;     // season.category
  ranking: PersonV2Ranking | null; // season.ranking
}
