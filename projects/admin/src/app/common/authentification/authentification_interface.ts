export enum Process_flow { SIGN_IN, SIGN_UP, CONFIRM_SIGN_UP, FORGOT_PASSWORD, RESET_PASSWORD, CONFIRM_RESET_PASSWORD };


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
