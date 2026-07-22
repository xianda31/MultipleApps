
import { Injectable } from '@angular/core';
import { confirmSignUp, signIn, signUp, signOut, AuthError, SignInInput, getCurrentUser, SignUpOutput, resetPassword, confirmResetPassword, fetchUserAttributes, resendSignUpCode } from 'aws-amplify/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthEvent, Process_flow } from './authentification_interface';
import { Member } from '../interfaces/member.interface';
import { MembersService } from '../services/members.service';
import { ToastService } from '../services/toast.service';
import { AssistanceRequestService } from '../services/assistance-request.service';




@Injectable({
  providedIn: 'root'
})
export class AuthentificationService {

  private _mode: Process_flow = Process_flow.SIGN_IN;
  private _mode$: BehaviorSubject<Process_flow> = new BehaviorSubject(this._mode);

  private _auth_event$: BehaviorSubject<AuthEvent> = new BehaviorSubject<AuthEvent>({ event: '' });

  private _logged_member$: BehaviorSubject<Member | null> = new BehaviorSubject<Member | null>(null);

  constructor(
    private toastService: ToastService,
    private memberService: MembersService,
    private assistanceRequestService: AssistanceRequestService,
  ) {


    this.getCurrentUser();    // recherche si un user est déjà connecté (application mémoire locale)
  }

  get mode$(): Observable<Process_flow> {
    return this._mode$ as Observable<Process_flow>;
  }

  get logged_member$(): Observable<Member | null> {
    return this._logged_member$ as Observable<Member | null>;
  }

  get currentMember(): Member | null {
    return this._logged_member$.getValue();
  }

  get auth_event$(): Observable<AuthEvent> {
    return this._auth_event$ as Observable<AuthEvent>;
  }



  changeMode(mode: Process_flow) {
    this._mode = mode;
    this._mode$.next(this._mode);
  }

  async resendConfirmationCode(email: string): Promise<void> {
    console.info('[Auth] resendConfirmationCode:start', { email });
    try {
      const result = await resendSignUpCode({ username: email });
      console.info('[Auth] resendConfirmationCode:success', { email, result });
      this.toastService.showSuccess('confirmation', 'Un code vous a été renvoyé par e-mail.');
    } catch (err: any) {
      console.error('[Auth] resendConfirmationCode:error', {
        email,
        name: err?.name,
        message: err?.message,
        err,
      });
      this.toastService.showError('confirmation', err?.message || 'Impossible de renvoyer le code');
      throw err;
    }
  }
 
  
  async signIn(email: string, password: string): Promise<any> {

    let signInInput: SignInInput = { username: email, password: password };
    let promise = new Promise(async (resolve, reject) => {
      {
        try {
          let { isSignedIn, nextStep } = await signIn(signInInput);

          const attributes = await fetchUserAttributes();
          const member_id = attributes['custom:member_id'];
          const normalizedEmail = (email || '').trim().toLowerCase();

          // Source de vérité: email. custom:member_id reste un fallback legacy.
          const memberByEmail = normalizedEmail
            ? await this.memberService.searchMemberByEmail(normalizedEmail)
            : null;

          if (memberByEmail) {
            this._logged_member$.next(memberByEmail);
            resolve(memberByEmail.id);
          } else if (member_id) {
            const memberById = await this.memberService.readMember(member_id);
            if (memberById) {
              this._logged_member$.next(memberById);
              resolve(memberById.id);
            } else {
              reject('Utilisateur authentifié mais non trouvé en base (email: ' + normalizedEmail + ')');
            }
          } else {
            reject('Utilisateur authentifié mais non trouvé en base (email: ' + normalizedEmail + ')');
          }
        } catch (err: any) {

          if (err.name === 'UserAlreadyAuthenticatedException') {
            // Tenter de récupérer la session existante
            let recoveredMember: any = null;
            let recoveredMemberId: string | undefined;
            let recoveryLoginId: string | undefined;

            try {
              const user = await getCurrentUser();
              recoveryLoginId = user.signInDetails?.loginId;
              const attributes = await fetchUserAttributes();
              recoveredMemberId = attributes['custom:member_id'];
              // Priorité email: email saisi, puis loginId récupéré, puis member_id legacy
              const normalizedInputEmail = (email || '').trim().toLowerCase();
              const normalizedRecoveryLogin = (recoveryLoginId || '').trim().toLowerCase();

              const memberByInputEmail = normalizedInputEmail
                ? await this.memberService.searchMemberByEmail(normalizedInputEmail)
                : null;

              if (memberByInputEmail) {
                recoveredMember = memberByInputEmail;
              } else if (
                normalizedRecoveryLogin &&
                normalizedRecoveryLogin !== normalizedInputEmail
              ) {
                const memberByRecoveryLogin = await this.memberService.searchMemberByEmail(normalizedRecoveryLogin);
                if (memberByRecoveryLogin) {
                  recoveredMember = memberByRecoveryLogin;
                }
              }

              if (!recoveredMember && recoveredMemberId) {
                const memberByLegacyId = await this.memberService.readMember(recoveredMemberId);
                if (memberByLegacyId) { recoveredMember = memberByLegacyId; }
              }
            } catch (innerErr: any) {
              // Tokens expirés ou session invalide
              this.assistanceRequestService.reportAuthError(
                email,
                'Impossible de récupérer la session utilisateur après vérification',
                `Erreur interne: ${innerErr?.message || innerErr}`,
                {
                  stage: 'UserAlreadyAuthenticatedException/recovery',
                  memberId: recoveredMemberId,
                  loginId: recoveryLoginId,
                  recoveryAttempted: true,
                  retryAttempted: false,
                  errorName: innerErr?.name,
                }
              );
            }

            if (recoveredMember) {
              this._logged_member$.next(recoveredMember);
              resolve(recoveredMember.id);
              return;
            }

            // Session périmée : nettoyer les tokens et relancer la connexion automatiquement
            await signOut({ global: false }).catch(() => {});
            try {
              await signIn(signInInput);
              const retryAttrs = await fetchUserAttributes();
              const retryMemberId = retryAttrs['custom:member_id'];
              const retryEmail = (email || '').trim().toLowerCase();
              const retryMemberByEmail = retryEmail
                ? await this.memberService.searchMemberByEmail(retryEmail)
                : null;

              if (retryMemberByEmail) {
                this._logged_member$.next(retryMemberByEmail);
                resolve(retryMemberByEmail.id);
              } else if (retryMemberId) {
                const retryMember = await this.memberService.readMember(retryMemberId);
                if (retryMember) {
                  this._logged_member$.next(retryMember);
                  resolve(retryMember.id);
                } else {
                  this.assistanceRequestService.reportAuthError(
                    email,
                    'Session corrompue (UserAlreadyAuthenticatedException)',
                    `member_id=${retryMemberId || 'absent'}, loginId=${recoveryLoginId || 'absent'}, membre introuvable après fallback`,
                    {
                      stage: 'UserAlreadyAuthenticatedException/retry/fallback-failed',
                      memberId: retryMemberId,
                      loginId: recoveryLoginId,
                      recoveryAttempted: true,
                      retryAttempted: true,
                      errorName: 'MemberNotFoundAfterFallback',
                    }
                  );
                  reject(new Error('Compte vérifié, mais la connexion n\'a pas pu être finalisée'));
                }
              } else {
                this.assistanceRequestService.reportAuthError(
                  email,
                  'Session corrompue (UserAlreadyAuthenticatedException)',
                  `member_id=absent, loginId=${recoveryLoginId || 'absent'}, attribut custom:member_id absent après retry`,
                  {
                    stage: 'UserAlreadyAuthenticatedException/retry/member-id-missing',
                    memberId: undefined,
                    loginId: recoveryLoginId,
                    recoveryAttempted: true,
                    retryAttempted: true,
                    errorName: 'MissingCustomMemberIdAfterRetry',
                  }
                );
                reject(new Error('Session invalide, veuillez réessayer'));
              }
            } catch (retryErr: any) {
              reject(retryErr);
            }
          } else if (err.name === 'UserNotConfirmedException') {
            // Compte non confirmé: rester en vérification par e-mail
            await this.resendConfirmationCode(email);
            this.changeMode(Process_flow.CONFIRM_SIGN_UP);
            reject(err);
          } else if (err.name === 'PasswordResetRequiredException') {
            // Mot de passe à réinitialiser: envoyer le code par e-mail et basculer sur la confirmation
            await this.resetPassword(email);
            this.toastService.showInfo('connexion', 'Réinitialisation requise : un code vous a été envoyé par e-mail');
            reject(err);
          } else {
            // this.toastService.showError('erreur identification', err.message);
            reject(err);
          }
        }
      }
    })
    return promise;
  }


  async signUp(email: string, password: string, member_id: string): Promise<SignUpOutput> {
    console.info('[Auth] signUp:start', { email, member_id });
    let promise = new Promise<SignUpOutput>((resolve, reject) => {
      signUp({
        username: email,
        password: password,
        options: {
          userAttributes: {
            email: email,
            "custom:member_id": member_id
          }
        }
      })
        .catch(async (err) => {
          console.error('[Auth] signUp:error', {
            email,
            member_id,
            name: err?.name,
            message: err?.message,
          });
          if (err instanceof AuthError) {
            switch (err.name) {
              case 'UserAlreadyAuthenticatedException':
                this.toastService.showInfo('sign up', 'vous êtes déjà inscrit');
                this._mode = Process_flow.SIGN_IN;
                this._mode$.next(this._mode);
                break;
              case 'UsernameExistsException': {
                this.toastService.showInfo('sign up', 'Compte déjà créé. Saisissez le code déjà reçu ou renvoyez-en un manuellement.');
                this._mode = Process_flow.CONFIRM_SIGN_UP;
                this._mode$.next(this._mode);
                break;
              }
              case 'InvalidPasswordException':
                this.toastService.showInfo('sign up', 'mot de passe non conforme');
                this._mode = Process_flow.SIGN_UP;
                this._mode$.next(this._mode);
                break;
              case 'LimitExceededException':
                this.toastService.showInfo('sign up', 'Quota quotidien Cognito atteint. Réessayez plus tard ou activez Amazon SES pour augmenter la capacité d\'envoi.');
                this._mode = Process_flow.SIGN_UP;
                this._mode$.next(this._mode);
                break;
              default:
                console.warn('[Auth] signUp:unhandled-auth-error', {
                  email,
                  member_id,
                  name: err?.name,
                  message: err?.message,
                });
                this.toastService.showInfo('sign up', err.message);
                this._mode = Process_flow.SIGN_IN;
                this._mode$.next(this._mode);
                break;
            }
          } else {
            console.warn('[Auth] signUp:non-auth-error', {
              email,
              member_id,
              message: err?.message,
            });
            this.toastService.showInfo('sign up', err.message);
          }
          reject(err);
        })
        .then((res) => {
          if (res) {
            let output = res as SignUpOutput;
            console.info('[Auth] signUp:success', {
              email,
              member_id,
              isSignUpComplete: output.isSignUpComplete,
              nextStep: output.nextStep,
            });
            if (output.nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
              this._mode = Process_flow.CONFIRM_SIGN_UP;
              this._mode$.next(this._mode);
              this.toastService.showSuccess('création compte', 'un mail vous a été envoyé');
              resolve({ isSignUpComplete: res.isSignUpComplete, nextStep: res.nextStep });
            } else {
              this.toastService.showInfo('sign up', 'erreur imprévue');
              reject(res);
            }
          }
        });

    });
    return promise;

  }

  async signOut(): Promise<void> {
    this._logged_member$.next(null);
    return signOut({ global: true });
  }

  async resetPassword(email: string): Promise<any> {
    let promise = new Promise((resolve, reject) => {
      resetPassword({ username: email })
        .catch((err) => {
          // this.toastService.showError('reset password', err.message);
          reject(err);
        })
        .then((res) => {
          // this.toastService.showSuccess('reset password', 'mot de passe réinitialisé');
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
          this.toastService.showError('new password', err.message);
          reject(err);
        })
        .then((res) => {
          this.toastService.showSuccess('new password', 'mot de passe réinitialisé');
          this._mode = Process_flow.SIGN_IN;
          this._mode$.next(this._mode);
          resolve(res);
        });
    });
    return promise;
  }

  async confirmSignUp(email: string, code: string): Promise<any> {
    console.info('[Auth] confirmSignUp:start', { email, codeLength: (code || '').length });
    let promise = new Promise((resolve, reject) => {
      confirmSignUp({ username: email, confirmationCode: code })
        .then(({ isSignUpComplete, nextStep }) => {
          console.info('[Auth] confirmSignUp:success', { email, isSignUpComplete, nextStep });

          // this.toastService.showSuccess('sign up', 'confirmed');
          this._mode = Process_flow.SIGN_IN;
          resolve({ isSignUpComplete, nextStep });
        }
        )
        .catch((err) => {
          console.error('[Auth] confirmSignUp:error', {
            email,
            codeLength: (code || '').length,
            name: err?.name,
            message: err?.message,
            err,
          });
          this.toastService.showError('sign up confirmation', err.message);
          reject(err);
        });
    });
    return promise;
  }

  async getCurrentUser(): Promise<string | null> {
    try {
      const { username, userId, signInDetails } = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      const member_id = attributes['custom:member_id'];
      const normalizedEmail = (attributes['email'] || signInDetails?.loginId || '').trim().toLowerCase();

      // Source de vérité: email. member_id est traité en fallback legacy.
      const memberByEmail = normalizedEmail
        ? await this.memberService.searchMemberByEmail(normalizedEmail)
        : null;

      if (memberByEmail) {
        this._logged_member$.next(memberByEmail);
        return memberByEmail.id;
      }

      if (member_id) {
        const memberById = await this.memberService.readMember(member_id);
        this._logged_member$.next(memberById);
        return memberById ? memberById.id : null;
      }

      return null;
    } catch (err) {
      return null;              // erreur "normale" si pas de user connecté
    }
  }



  isLoggedIn(): boolean {
    return this._logged_member$ && this._logged_member$.getValue() !== null;
  }
}
