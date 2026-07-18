import { Schema } from "../../../../../../amplify/data/resource";

export interface Member_settings{
  has_avatar: boolean;
  accept_mailing: boolean;
  city: string;
  email: string;
  phone_one: string;
}

export type MemberGender = 'M' | 'F' | 'U';

export interface Member extends Member_settings{
  id: string;
  gender: MemberGender;
  firstname: string;
  lastname: string;
  license_number: string;
  birthdate: string
  season: string
  license_status: string
  license_taken_at: string
  membership_date: string;
  orga_license_name?: string;
  register_date?: string;
  person_id?: number | null;    // index FFB_licencee
  memberStatus?: string;
  iv?: number;
  iv_code?:string;
  createdAt?: string;
  updatedAt?: string;

}

export type Member_input = Omit<Schema['Member']['type'], 'id' | 'createdAt' | 'updatedAt'>;


export enum LicenseStatus {
  DULY_REGISTERED = 'duly_registered',
  PROMOTED_ONLY = 'promoted_only',
  UNREGISTERED = 'unregistered',
}