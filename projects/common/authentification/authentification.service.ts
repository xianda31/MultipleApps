import { Injectable } from '@angular/core';
import { confirmSignUp, signIn, signUp, signOut, AuthError, AuthUser, SignInInput, getCurrentUser } from 'aws-amplify/auth';
import { CognitoIdentityProviderClient, ExplicitAuthFlowsType, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { BehaviorSubject, empty, Observable } from 'rxjs';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { Behavior } from 'aws-cdk-lib/aws-cloudfront';
import { get } from 'aws-amplify/api';
import { Process_flow } from './sign-in/authentification_interface';
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
              case 'UserAlreadyAuthenticatedException':
                let currentUser = await getCurrentUser();
                this._whoAmI = await this.membersService.getMemberByEmail(currentUser.signInDetails!.loginId!);
                this._whoAmI$.next(this._whoAmI);
                console.log("current member", this._whoAmI);
                resolve({ isSignedIn: true, nextStep: null });
                break;
              case 'NotAuthorizedException':
                this.toastService.showErrorToast('sign in', 'Incorrect username or password');
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

  async signUp(email: string, password: string): Promise<any> {

    let promise = new Promise((resolve, reject) => {
      console.log("sign up");
      signUp({ username: email, password: password })
        .catch((err) => {
          this.toastService.showInfoToast('sign up', err.message);
          reject(err);
        })
        .then((res) => {
          this._mode = Process_flow.CONFIRM_SIGN_UP;
          this._mode$.next(this._mode);
          resolve(res);
          //  this.sign_up_sent = true;
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
