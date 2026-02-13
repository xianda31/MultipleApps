export enum Process_flow { 
  SIGN_IN = 'SIGN_IN',
   SIGN_UP = 'SIGN_UP',
   CONFIRM_SIGN_UP = 'CONFIRM_SIGN_UP',
   FORGOT_PASSWORD = 'FORGOT_PASSWORD',
   RESET_PASSWORD = 'RESET_PASSWORD',
   CONFIRM_RESET_PASSWORD = 'CONFIRM_RESET_PASSWORD',
  SIGNED_IN = 'SIGNED_IN',};


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
