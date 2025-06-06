import { Injectable } from '@angular/core';
import { confirmSignUp, signIn, signUp, signOut, AuthError, SignInInput, getCurrentUser, SignUpOutput, resetPassword, confirmResetPassword, fetchUserAttributes } from 'aws-amplify/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthEvent, Process_flow } from './authentification_interface';
import { ToastService } from '../toaster/toast.service';
import { MembersService } from '../../admin-dashboard/src/app/members/service/members.service';
import { Member } from '../member.interface';
import { Hub } from 'aws-amplify/utils';




@Injectable({
  providedIn: 'root'
})
export class AuthentificationService {

  private _mode: Process_flow = Process_flow.SIGN_IN;
  private _mode$: BehaviorSubject<Process_flow> = new BehaviorSubject(this._mode);

  private _auth_event$: BehaviorSubject<AuthEvent> = new BehaviorSubject<AuthEvent>({ event: '' });


  // private _logged_member: Member | null = null;
  private _logged_member$: BehaviorSubject<Member | null> = new BehaviorSubject<Member | null>(null);
  constructor(
    private toastService: ToastService,
    private memberService: MembersService
  ) {


    const hubListener = (event: any) => {
      let authEvent: AuthEvent = event.payload;
      switch (authEvent.event) {
        case 'signedIn':
        case 'signedOut':
        case 'signedUp':
          // console.log('Auth event:', authEvent);
          this._auth_event$.next(authEvent);
          break;
        default:
          console.warn('Unhandled auth event:', authEvent.event);
          break;
      }
    }
    Hub.listen('auth', hubListener);

    this.getCurrentUser();    // recherche si un user est déjà connecté (application mémoire locale)
  }

  get mode$(): Observable<Process_flow> {
    return this._mode$ as Observable<Process_flow>;
  }

  get logged_member$(): Observable<Member | null> {
    return this._logged_member$ as Observable<Member | null>;
  }

  get auth_event$(): Observable<AuthEvent> {
    return this._auth_event$ as Observable<AuthEvent>;
  }


  changeMode(mode: Process_flow) {
    this._mode = mode;
    this._mode$.next(this._mode);
  }

  async signIn(email: string, password: string): Promise<any> {

    let signInInput: SignInInput = { username: email, password: password };
    let promise = new Promise(async (resolve, reject) => {
      {
        try {
          let { isSignedIn, nextStep } = await signIn(signInInput);

          const attributes = await fetchUserAttributes();
          // console.log('attributes', attributes);
          let member_id = attributes['custom:member_id'];
          // console.log('member_id', member_id);
          if (!member_id) {
            reject('local storage invalid');
          } else {
            let member = await this.memberService.readMember(member_id);
            this._logged_member$.next(member);
            resolve(member_id);
          }
        } catch (err: any) {

          if (err.name === 'UserAlreadyAuthenticatedException') {
            const user = await getCurrentUser();
            let member = await this.memberService.getMemberByEmail(user.signInDetails?.loginId!);
            if (member) {
              this._logged_member$.next(member);
              resolve(member.id);
            }
            else {
              reject(err);
            }
          } else {
            this.toastService.showErrorToast('erreur identification', err.message);
            reject(err);
          }
        }
      }
    })
    return promise;
  }


  async signUp(email: string, password: string, member_id: string): Promise<SignUpOutput> {
    console.log('sign up', email, password, member_id);
    let promise = new Promise<SignUpOutput>((resolve, reject) => {
      signUp({
        username: email,
        password: password,
        options: {
          userAttributes: {
            "custom:member_id": member_id
          }
        }
      })
        .catch((err) => {
          if (err instanceof AuthError) {
            switch (err.name) {
              case 'UserAlreadyAuthenticatedException':
                this.toastService.showInfoToast('sign up', 'vous êtes déjà inscrit');
                break;
              case 'UsernameExistsException':
                this.toastService.showInfoToast('sign up', 'vous êtes déjà inscrit');
                break;
              case 'InvalidPasswordException':
                this.toastService.showInfoToast('sign up', 'mot de passe non conforme');
                break;
              default:
                this.toastService.showInfoToast('sign up', err.message);
                break;
            }
            this._mode = Process_flow.SIGN_IN;
            this._mode$.next(this._mode);
          } else {
            this.toastService.showInfoToast('sign up', err.message);
          }
          reject(err);
        })
        .then((res) => {
          if (res) {
            let output = res as SignUpOutput;
            if (output.nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
              this._mode = Process_flow.CONFIRM_SIGN_UP;
              this._mode$.next(this._mode);
              this.toastService.showSuccessToast('création compte', 'un mail vous a été envoyé');
              resolve({ isSignUpComplete: res.isSignUpComplete, nextStep: res.nextStep });
            } else {
              this.toastService.showInfoToast('sign up', 'erreur imprévue');
              reject(res);
            }
          }
        });

    });
    return promise;

  }

  async signOut(): Promise<any> {
    let promise = new Promise((resolve, reject) => {
      signOut(
        { global: true }  // est-ce que cela clear les données de l'utilisateur dans le local storage ?
      )
        .catch((err) => {
          this.toastService.showInfoToast('sign out', err.message);
          reject(err);
        })
        .then((res) => {
          // this._logged_member = null;
          this._logged_member$.next(null);
          // this.toastService.showSuccessToast('sign out', 'success');
          resolve(res);
        });
    });
    return promise;
  }

  async resetPassword(email: string): Promise<any> {
    let promise = new Promise((resolve, reject) => {
      resetPassword({ username: email })
        .catch((err) => {
          // this.toastService.showErrorToast('reset password', err.message);
          reject(err);
        })
        .then((res) => {
          // this.toastService.showSuccessToast('reset password', 'mot de passe réinitialisé');
          this._mode = Process_flow.CONFIRM_RESET_PASSWORD;
          this._mode$.next(this._mode);
          resolve(res);
        });
    });
    return promise;
  }

  async newPassword(email: string, code: string, password: string): Promise<any> {
    let promise = new Promise((resolve, reject) => {
      confirmResetPassword({ username: email, confirmationCode: code, newPassword: password })
        .catch((err) => {
          this.toastService.showErrorToast('new password', err.message);
          reject(err);
        })
        .then((res) => {
          this.toastService.showSuccessToast('new password', 'mot de passe réinitialisé');
          this._mode = Process_flow.SIGN_IN;
          this._mode$.next(this._mode);
          resolve(res);
        });
    });
    return promise;
  }

  async confirmSignUp(email: string, code: string): Promise<any> {
    let promise = new Promise((resolve, reject) => {
      confirmSignUp({ username: email, confirmationCode: code })
        .then(({ isSignUpComplete, nextStep }) => {

          this.toastService.showSuccessToast('sign up', 'confirmed');
          this._mode = Process_flow.SIGN_IN;
          resolve({ isSignUpComplete, nextStep });
        }
        )
        .catch((err) => {
          this.toastService.showErrorToast('sign up confirmation', err.message);
          reject(err);
        });
    });
    return promise;
  }

  async getCurrentUser(): Promise<string | null> {
    let promise = new Promise<string | null>((resolve, reject) => {
      getCurrentUser()
        .then(async ({ username, userId, signInDetails }) => {
          const attributes = await fetchUserAttributes();
          let member_id = attributes['custom:member_id'];

          // this._logged_member = this.memberService.getMember(member_id!);
          this._logged_member$.next(this.memberService.getMember(member_id!));

          resolve(member_id!);
        })
        .catch((err) => {
          resolve(null);          // erreur "normale" si pas de user connecté
        });
    });
    return promise;
  }


}
