import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { catchError, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { Process_flow } from '../authentification_interface';
import { AuthentificationService } from '../authentification.service';
import { MembersService } from '../../services/members.service';
import { Group_icons } from '../group.interface';
import { CommonModule } from '@angular/common';

const EMAIL_PATTERN = "^[_A-Za-z0-9-\+]+(\.[_A-Za-z0-9-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9]+)*(\.[A-Za-z]{2,})$";
const PSW_PATTERN = '^(?!\\s+)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[\\^$*.[\\]{}()?"!@#%&/\\\\,><\': ;| _~`=+-]).{8,256}(?<!\\s)$';
const GROUP_ICONS = Group_icons;

@Component({
  selector: 'app-connexion',
  standalone: true,
  templateUrl: './connexion.component.html',
  styleUrl: './connexion.component.scss',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
})
export class ConnexionComponent {

  sign_up_sent: boolean = false;
  process_flow = Process_flow;
  canShowSignUp = false;

  logging_msg: string = '';
  signup_msg: string = '';
  showPassword = false; // toggle for sign-in/sign-up password fields
  showNewPassword = false; // toggle for reset new password
  currentMode?: Process_flow;
  isSubmitting = false;

  // Labels sécurisés pour éviter les problèmes de cache/build
  readonly labels = {
    connexion: 'Connexion',
    creerCompte: 'Créer mon compte',
    confirmer: 'Confirmer',
    envoyerCode: 'Envoyer le code',
    changerMotDePasse: 'Changer le mot de passe',
    renvoyerCode: 'Renvoyer le code',
    retourConnexion: 'Retour à la connexion'
  };

  mode$!: Observable<Process_flow>;
  // mode: Process_flow = Process_flow.SIGN_IN;

  loggerForm!: FormGroup;

  get email() { return this.loggerForm.get('email')!; }
  get password() { return this.loggerForm.get('password')!; }
  get code() { return this.loggerForm.get('code')!; }

  constructor(
    private membersService: MembersService,
    private toastService: ToastService,
    private auth: AuthentificationService,
    private fb: FormBuilder,
    private router: Router,

  ) {
    this.loggerForm = this.fb.group({
      email: ['', { validators: [Validators.required, Validators.pattern(EMAIL_PATTERN)], asyncValidators: this.emailValidator }],
      password: ['', [Validators.required, Validators.pattern(PSW_PATTERN)]],
      // new password is only used in RESET PASSWORD flows; validators applied dynamically when needed
      new_password: [''],
      code: [''],
    });
  }
  
  async ngOnInit() {
    this.mode$ = this.auth.mode$;
    // Track current mode for navigation decisions
    this.mode$.subscribe(m => {
       this.currentMode = m;
      // console.log('Current auth mode:', m);
      });
  }

  async signIn() {
    await this.auth.signIn(this.email!.value, this.password!.value)
      .then((member_id) => {
         if (!member_id) { console.warn('sign in', 'erreur imprévue'); }
         this.logging_msg ='';
        })
      .catch(async (err) => {
        console.log('sign in erreur', err);
        const name = err?.name || '';
        if (name === 'UserNotConfirmedException') {
          this.logging_msg = 'Compte non confirmé. Un code vous a été envoyé par e-mail.';
        } else if (name === 'PasswordResetRequiredException') {
          this.logging_msg = 'Réinitialisation requise. Un code vous a été envoyé par e-mail.';
        } else if (name === 'NotAuthorizedException') {
          // Vérifier si l'email existe dans la base membres
          const member = await this.membersService.searchMemberByEmail(this.email.value);
          if (member) {
            this.logging_msg = "Compte inexistant ou mot de passe incorrect.";
            this.canShowSignUp = true;
          } else {
            this.logging_msg = "Email inconnu.";
            this.canShowSignUp = false;
          }
        } else {
          this.logging_msg = err?.message || 'Connexion impossible';
        }
      });
  }

  async onSubmit() {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    try {
      switch (this.currentMode) {
      case Process_flow.SIGN_IN: {
        if (this.loggerForm.invalid || this.email.invalid || this.password.invalid) {
          this.email.markAsTouched();
          this.password.markAsTouched();
          this.logging_msg = 'Veuillez saisir une adresse mail et un mot de passe valides';
          break;
        }
        await this.signIn();
        break;
      }
      case Process_flow.SIGN_UP: {
        // If a sign-up code has been sent, treat submit as confirmation
        if (this.sign_up_sent) {
          if (this.email.invalid || !this.code.value) {
            this.email.markAsTouched();
            this.code.markAsTouched();
            this.signup_msg = 'Renseignez le code reçu par e-mail';
            break;
          }
          await this.confirmSignUp();
          break;
        }
        // Otherwise perform initial sign-up
        if (this.email.invalid || this.password.invalid) {
          this.email.markAsTouched();
          this.password.markAsTouched();
          this.signup_msg = 'Veuillez saisir un e-mail et un mot de passe valides';
          break;
        }
        await this.signUp();
        break;
      }
      case Process_flow.RESET_PASSWORD: {
        const newPwdCtrl = this.loggerForm.get('new_password');
        if (this.email.invalid || newPwdCtrl?.invalid) {
          this.email.markAsTouched();
          newPwdCtrl?.markAsTouched();
          this.logging_msg = 'Saisissez un e-mail et un nouveau mot de passe valides';
          break;
        }
        await Promise.resolve(this.resetPassword());
        break;
      }
      case Process_flow.CONFIRM_RESET_PASSWORD: {
        const newPwdCtrl = this.loggerForm.get('new_password');
        if (this.email.invalid || !this.code.value || newPwdCtrl?.invalid) {
          this.email.markAsTouched();
          this.code.markAsTouched();
          newPwdCtrl?.markAsTouched();
          this.logging_msg = 'Renseignez le code reçu et vérifiez votre nouveau mot de passe';
          break;
        }
        await Promise.resolve(this.confirmPassword());
        break;
      }
      case Process_flow.CONFIRM_SIGN_UP: {
        if (this.email.invalid || !this.code.value) {
          this.email.markAsTouched();
          this.code.markAsTouched();
          this.signup_msg = 'Renseignez le code reçu par e-mail';
          break;
        }
        await this.confirmSignUp();
        break;
      }
      default:
        // No action for other modes
        break;
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  goSignUp() {
    // Clear any previous sign-in error when switching to sign-up
    this.logging_msg = '';
    this.signup_msg = '';
    this.canShowSignUp = false;
    this.auth.changeMode(Process_flow.SIGN_UP);
  }

  async signUp() {
    let member = await this.membersService.searchMemberByEmail(this.email.value);
    await this.auth.signUp(this.email.value, this.password.value, member!.id)
      .then(({ isSignUpComplete, nextStep }) => {
        this.sign_up_sent = true;
      })
      .catch((err) => {
        if(err.name !== 'UsernameExistsException') {
          console.warn('sign up erreur imprévue',err);
        }else{
          this.logging_msg = 'vous avez déjà un compte, veuillez vous connecter';
          this.auth.changeMode(Process_flow.SIGN_IN);
        }
      });
  }

  async confirmSignUp() {
    if (this.loggerForm.invalid) return;

    await this.auth.confirmSignUp(this.email.value, this.code.value)
      .then(() => {
        // Toute résolution est considérée comme succès de confirmation
        this.signup_msg = '';
        this.logging_msg = '';
        this.toastService.showSuccess('création compte', 'Compte confirmé. Vous pouvez vous connecter.');
        this.sign_up_sent = false;
        this.auth.changeMode(Process_flow.SIGN_IN);
      })
      .catch((err) => {
        // Erreur explicite en cas d'échec réel de confirmation
        this.toastService.showErrorToast('sign up', err?.message || 'Confirmation impossible');
        this.signup_msg = 'erreur à la confirmation';
      });
  }

  newPassword() {
    if (this.email.invalid) {
      this.logging_msg = 'Veuillez saisir une adresse mail valide';
      this.email.markAsTouched();
      return;
    }
    this.loggerForm.controls['password'].setValue('');
    this.showNewPassword = false;
    // Require code and a strong new password in reset flow
    this.loggerForm.controls['code'].setValidators([Validators.required]);
    this.loggerForm.controls['code'].updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.loggerForm.controls['new_password'].setValidators([Validators.required, Validators.pattern(PSW_PATTERN)]);
    this.loggerForm.controls['new_password'].updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.auth.changeMode(Process_flow.RESET_PASSWORD);
  }
  resetPassword() {
    if (this.loggerForm.get('new_password')?.invalid) return;
    this.auth.resetPassword(this.email.value);
    // Lock the chosen new password so it can't be altered in the confirm step
    this.loggerForm.get('new_password')?.disable({ emitEvent: false });
  }
  resendConfirmEmailCode() {
    if (!this.email.value) return;
    this.auth.resendConfirmationCode(this.email.value);
  }
  resendResetPasswordCode() {
    if (!this.email.value) return;
    this.auth.resetPassword(this.email.value);
  }
  
  confirmPassword() {
    const newPwd = this.loggerForm.get('new_password')?.value;
    this.auth.newPassword(this.email.value, this.code.value, newPwd);
  }

  goToSignIn() {
    // Reset fields and modes to go back to login without resetting
    this.loggerForm.get('code')?.reset('');
    this.loggerForm.get('code')?.setValidators([]);
    this.loggerForm.get('code')?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    const newPwdCtrl = this.loggerForm.get('new_password');
    if (newPwdCtrl?.disabled) newPwdCtrl.enable({ emitEvent: false });
    newPwdCtrl?.reset('');
    newPwdCtrl?.setValidators([]);
    newPwdCtrl?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.logging_msg = '';
    this.signup_msg = '';
    this.showPassword = false;
    this.showNewPassword = false;
    this.auth.changeMode(Process_flow.SIGN_IN);
  }
  




  emailValidator = (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value) return of(null);
    if (!control.value.match(EMAIL_PATTERN)) return of(null);
    return of(control.value).pipe(
      switchMap((email) => from(this.membersService.searchMemberByEmail(email))),
      tap((member) => console.log('emailValidator found member:', member)),
      map((member) => { return member ? null : { not_member: false }; }),
      catchError((error) => { console.error('Error in emailValidator:', error); return of(null); })
    )
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleNewPasswordVisibility() {
    this.showNewPassword = !this.showNewPassword;
  }

  goBack() {
    // If in a confirm or reset flow with entered data, optionally confirm before leaving
    const riskyModes = [Process_flow.RESET_PASSWORD, Process_flow.CONFIRM_RESET_PASSWORD, Process_flow.SIGN_UP, Process_flow.CONFIRM_SIGN_UP];
    const hasInput = !!(this.code?.value || this.loggerForm.get('new_password')?.value || this.sign_up_sent);
    if (this.currentMode && riskyModes.includes(this.currentMode) && hasInput) {
      const ok = window.confirm('Vous allez quitter cette étape. Les informations saisies non envoyées seront perdues. Continuer ?');
      if (!ok) return;
    }
    // Reset to sign-in mode so returning to connexion starts clean
    this.goToSignIn();
    // Navigate explicitly to the app home (front)
    this.router.navigate(['/front']);
  }
}
