import { Schema } from "../../../../../amplify/data/resource";

export interface Member {
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
  createdAt?: string;
  updatedAt?: string;

}

export type Member_input = Omit<Schema['Member']['type'], 'id' | 'createdAt' | 'updatedAt'>;


export enum LicenseStatus {
  DULY_REGISTERED = 'duly_registered',
  PROMOTED_ONLY = 'promoted_only',
  UNREGISTERED = 'unregistered',
}