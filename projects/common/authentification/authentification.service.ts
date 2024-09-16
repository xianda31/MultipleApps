import { Injectable } from '@angular/core';
import { confirmSignUp, signIn, signUp, signOut, AuthError, SignInInput, getCurrentUser, SignUpOutput, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { Process_flow } from './authentification_interface';
import { ToastService } from '../toaster/toast.service';
import { Member } from '../members/member.interface';
import { MembersService } from '../../admin-dashboard/src/app/members/service/members.service';

@Injectable({
  providedIn: 'root'
})
export class AuthentificationService {

  private _mode: Process_flow = Process_flow.SIGN_IN;
  private _mode$: BehaviorSubject<Process_flow> = new BehaviorSubject(this._mode);
  private _whoAmI: Member | null = null;
  private _whoAmI$: BehaviorSubject<Member | null> = new BehaviorSubject(this._whoAmI);
  constructor(
    private toastService: ToastService,
    private membersService: MembersService,



  ) { }

  get mode$(): Observable<Process_flow> {
    return this._mode$ as Observable<Process_flow>;
  }

  get whoAmI$(): Observable<Member | null> {
    return this._whoAmI$ as Observable<Member | null>;
  }

  set whoAmI(member: Member | null) {
    this._whoAmI = member;
    this._whoAmI$.next(this._whoAmI);
  }

  get whoAmI(): Member | null {
    return this._whoAmI;
  }

  async signIn(email: string, password: string): Promise<any> {

    let signInInput: SignInInput = { username: email, password: password };

    let promise = new Promise(async (resolve, reject) => {
      {
        try {
          let { isSignedIn, nextStep } = await signIn(signInInput);
          // console.log("output", { isSignedIn, nextStep });
          // this.toastService.showSuccessToast('sign in', 'success');
          resolve({ isSignedIn, nextStep });
        } catch (err) {
          if (err instanceof AuthError) {
            switch (err.name) {
              // case 'UserAlreadyAuthenticatedException':
              //   let currentUser = await getCurrentUser();
              //   this._whoAmI = await this.membersService.getMemberByEmail(currentUser.signInDetails!.loginId!);
              //   this._whoAmI$.next(this._whoAmI);
              //   console.log("current member", this._whoAmI);
              //   resolve({ isSignedIn: true, nextStep: null });
              //   break;
              case 'NotAuthorizedException':
                this.toastService.showWarningToast('identification', 'mail ou mot de passe incorrect');
                reject(err);
                break;
              default:
                this.toastService.showErrorToast('sign in', err.message);
                reject(err);
                break;
            }
          } else {
            console.log("error", err);
            reject(err);
          }
        }
      }
    })
    return promise;
  }

  changeMode(mode: Process_flow) {
    this._mode = mode;
    this._mode$.next(this._mode);
  }

  async signUp(email: string, password: string): Promise<SignUpOutput> {

    let promise = new Promise<SignUpOutput>((resolve, reject) => {
      signUp({ username: email, password: password })
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
      signOut()
        .catch((err) => {
          this.toastService.showInfoToast('sign out', err.message);
          reject(err);
        })
        .then((res) => {
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
          this.toastService.showErrorToast('reset password', err.message);
          reject(err);
        })
        .then((res) => {
          this.toastService.showSuccessToast('reset password', 'mot de passe réinitialisé');
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




  // listGroup() {
  //   const configuration = {
  //     region: 'eu-west-3',
  //     // ExplicitAuthFlows: [
  //     //   ExplicitAuthFlowsType.ALLOW_ADMIN_USER_PASSWORD_AUTH,
  //     // ]
  //     // credentials: {
  //     //   accessKeyId: '<YOUR_AwsAccessKey_HERE>',
  //     //   secretAccessKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  //     // }
  //   };

  //   const command = new ListUsersCommand({
  //     UserPoolId: "eu-west-3_HjxM7NCLo",
  //   });
  //   const client = new CognitoIdentityProviderClient(configuration);

  //   client.send(command).then((data) => {
  //     console.log("data", data);
  //   })
  //     .catch((error) => {
  //       console.error(error);
  //     });

  // }

}
