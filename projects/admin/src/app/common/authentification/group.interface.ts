export interface AuthData {
  userId: string;
  username: string;
  signInDetails?: {
    loginId?: string;
    authFlowType?: string;
  };
};

export interface AuthEvent {
  event: string;
  data?: AuthData;
}

export enum Group_names {
  System = 'Systeme',
  Admin = 'Administrateur',
  Editor = 'Editeur',
  Support = 'Contributeur',
  Member = 'Membre'
}

export const Group_priorities: { [K in Group_names]: number } = {
  [Group_names.System]: 4,
  [Group_names.Admin]: 3,
  [Group_names.Editor]: 2,
  [Group_names.Support]: 1,
  [Group_names.Member]: 0,
};

export const Group_icons: { [K in Group_names]: string } = {
  [Group_names.Member]: 'bi bi-person-fill',
  [Group_names.Support]: 'bi bi-person-check-fill',
  [Group_names.Editor]: 'bi bi-pencil-square',
  [Group_names.Admin]: 'bi bi-mortarboard-fill',
  [Group_names.System]: 'bi bi-tools'
};

 export enum UserAttributes {
  email = 'email',
  email_verified = 'email_verified',
  member_id ="custom:member_id",
  sub = 'sub'
}

export interface UserInGroup {
  // Username: string;
  Attributes: { Name:UserAttributes, Value: string }[];
  Username: string;
  UserStatus: string;

  // add other properties if needed
}

export interface Accreditation {
  level: number;
  group_name: Group_names;
  icon: string;
}
