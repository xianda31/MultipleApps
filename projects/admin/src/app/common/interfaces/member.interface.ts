import { Schema } from "../../../../../../amplify/data/resource";

export interface Member_settings{
  has_avatar?: boolean;
  accept_mailing?: boolean;
}

export interface Member extends Member_settings{
  id: string;
  gender: string;
  firstname: string;
  lastname: string;
  license_number: string;
  birthdate: string
  city: string
  season: string
  email: string
  phone_one: string
  is_sympathisant: boolean
  license_status: string
  license_taken_at: string
  orga_license_name?: string;
  register_date?: string;
  // ico?: string;
  // accept_mailing?: boolean;
  createdAt?: string;
  updatedAt?: string;

}

export type Member_input = Omit<Schema['Member']['type'], 'id' | 'createdAt' | 'updatedAt'>;


export enum LicenseStatus {
  DULY_REGISTERED = 'duly_registered',
  PROMOTED_ONLY = 'promoted_only',
  UNREGISTERED = 'unregistered',
}