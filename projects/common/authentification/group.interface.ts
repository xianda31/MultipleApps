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
  Support = 'Contributeur',
  Member = 'Membre'
}

export const Group_priorities: { [K in Group_names]: number } = {
  [Group_names.System]: 3,
  [Group_names.Admin]: 2,
  [Group_names.Support]: 1,
  [Group_names.Member]: 0,
};

export const Group_icons: { [K in Group_names]: string } = {
  [Group_names.Member]: 'bi bi-person-fill',
  [Group_names.Support]: 'bi bi-person-fill-gear',
  [Group_names.Admin]: 'bi bi-mortarboard-fill',
  [Group_names.System]: 'bi bi-incognito'
};

 export enum UserAttributes {
  email = 'email',
  email_verified = 'email_verified',
  sub = 'sub'
}

export interface UserInGroup {
  // Username: string;
  Attributes: { Name: UserAttributes, Value: string }[];
  Username: string;
  UserStatus: string;

  // add other properties if needed
}
