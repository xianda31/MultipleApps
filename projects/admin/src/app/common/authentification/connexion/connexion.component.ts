import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { catchError, filter, from, map, Observable, of, switchMap, take } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { Process_flow } from '../authentification_interface';
import { AuthentificationService } from '../authentification.service';
import { AuthentificationRedirectService } from '../authentification-redirect.service';
import { MembersService } from '../../services/members.service';
import { Group_icons } from '../group.interface';
import { TitleService } from '../../../front/title/title.service';
import { InputCodeComponent } from '../../components/input-code/input-code.component';

const EMAIL_PATTERN = "^[_A-Za-z0-9-\+]+(\.[_A-Za-z0-9-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9]+)*(\.[A-Za-z]{2,})$";
const PSW_PATTERN = '^(?!\\s+)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[\\^$*.[\\]{}()?"!@#%&/\\\\,><\': ;| _~`=+-]).{8,256}(?<!\\s)$';
const GROUP_ICONS = Group_icons;

@Component({
  selector: 'app-connexion',
  standalone: true,
  templateUrl: './connexion.component.html',
  styleUrl: './connexion.component.scss',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputCodeComponent],
})
export class ConnexionComponent implements AfterViewInit {
  readonly confirmationCodeLength = 6;
  resendCooldownSeconds = 0;
  signupCooldownSeconds = 0;
  private resendCooldownTimer: ReturnType<typeof setInterval> | null = null;
  private signupCooldownTimer: ReturnType<typeof setInterval> | null = null;

  sign_up_sent: boolean = false;
  process_flow = Process_flow;
  isBackContext: boolean = false;

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

  @ViewChild('emailInput') emailInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') passwordInput?: ElementRef<HTMLInputElement>;

  get email() { return this.loggerForm.get('email')!; }
  get password() { return this.loggerForm.get('password')!; }
  get code() { return this.loggerForm.get('code')!; }

  constructor(
    private membersService: MembersService,
    private toastService: ToastService,
    private auth: AuthentificationService,
    private authRedirectService: AuthentificationRedirectService,
    private fb: FormBuilder,
    private router: Router,
    private location: Location,
    private titleService: TitleService
  ) {
    this.loggerForm = this.fb.group({
      email: ['', { validators: [Validators.required, Validators.pattern(EMAIL_PATTERN)] }],
      password: ['', [Validators.required]],
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
       if (m === Process_flow.CONFIRM_RESET_PASSWORD || m === Process_flow.CONFIRM_SIGN_UP) {
      this.normalizeCodeControl();
       }
      // console.log('Current auth mode:', m);
      });
    
    // Detect context: if current URL contains /back, it's back context
    const currentUrl = this.router.url;
    this.isBackContext = currentUrl.includes('/back');
    if (this.isBackContext) {
      this.authRedirectService.setReturnUrl('/back', 'back');
    }
    
    // Reset title on init
    this.titleService.setTitle('Authentification');
    
    // After successful login, redirect to original page or context default
    // filter+take(1) ensures the subscription auto-completes after first login
    // preventing zombie subscriptions from consuming returnUrl on subsequent logins
    this.auth.logged_member$.pipe(
      filter(member => !!member),
      take(1)
    ).subscribe(member => {
      this.titleService.setTitle('');
      const context = this.authRedirectService.getContext();
      let targetUrl = this.authRedirectService.getReturnUrl();
      if (this.isBackContext && targetUrl === '/front') {
        targetUrl = '/back';
      }
      this.router.navigateByUrl(targetUrl);
    });
  }

  ngAfterViewInit(): void {
    // Chrome may apply autofill after Angular initializes controls.
    // Re-sync a few times on startup so first submit works reliably.
    this.syncAutofillValuesFromDom();
    setTimeout(() => this.syncAutofillValuesFromDom(), 50);
    setTimeout(() => this.syncAutofillValuesFromDom(), 250);
  }

  async signIn() {
    await this.auth.signIn(this.email!.value, this.password!.value)
      .then((member_id) => {
         if (!member_id) { console.warn('sign in', 'erreur imprévue'); }
         this.logging_msg ='';
        })
      .catch(async (err) => {
        const name = err?.name || '';
        if (name === 'UserNotConfirmedException') {
          this.logging_msg = 'Compte non confirmé. Un code vous a été envoyé par e-mail.';
        } else if (name === 'PasswordResetRequiredException') {
          this.logging_msg = 'Réinitialisation requise. Un code vous a été envoyé par e-mail.';
        } else if (name === 'NotAuthorizedException') {
          this.logging_msg = 'Adresse e-mail ou mot de passe incorrect.';
        } else {
          this.logging_msg = err?.message || 'Connexion impossible';
        }
      });
  }

  async onSubmit() {
    this.syncAutofillValuesFromDom();
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    try {
      switch (this.currentMode) {
      case Process_flow.SIGN_IN: {
        if (!this.email.value || !this.password.value) {
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

  private syncAutofillValuesFromDom(): void {
    const emailFromDom = this.emailInput?.nativeElement?.value?.trim() || '';
    const pwdFromDom = this.passwordInput?.nativeElement?.value || '';

    if (emailFromDom && emailFromDom !== this.email.value) {
      this.email.setValue(emailFromDom, { emitEvent: true });
      this.email.markAsDirty();
    }

    if (pwdFromDom && pwdFromDom !== this.password.value) {
      this.password.setValue(pwdFromDom, { emitEvent: true });
      this.password.markAsDirty();
    }

    this.email.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.password.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  goSignUp() {
    // Clear any previous sign-in error when switching to sign-up
    this.logging_msg = '';
    this.signup_msg = '';
    // Add async member-existence check only for sign-up flow
    this.loggerForm.get('email')?.addAsyncValidators(this.emailValidator);
    this.loggerForm.get('email')?.updateValueAndValidity({ emitEvent: false });
    this.password.setValidators([Validators.required, Validators.pattern(PSW_PATTERN)]);
    this.password.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.resetCodeControl();
    this.auth.changeMode(Process_flow.SIGN_UP);
  }

  async signUp() {
    if (this.signupCooldownSeconds > 0) {
      this.signup_msg = 'Quota Cognito temporairement saturé. Merci de patienter avant de réessayer.';
      return;
    }

    let member = await this.membersService.searchMemberByEmail(this.email.value);
    await this.auth.signUp(this.email.value, this.password.value, member!.id)
      .then(({ isSignUpComplete, nextStep }) => {
        this.sign_up_sent = true;
        this.resetCodeControl();
      })
      .catch((err) => {
        if (err.name === 'UsernameExistsException') {
          this.signup_msg = 'Compte déjà créé mais non confirmé. Saisissez le code reçu par e-mail.';
          this.sign_up_sent = true;
          this.resetCodeControl();
          return;
        }

        if (err.name === 'LimitExceededException') {
          this.signup_msg = 'Quota quotidien Cognito atteint. Attendez 24h ou configurez Amazon SES pour augmenter la capacité d\'envoi.';
          this.startSignupCooldown(300);
          return;
        }

        console.warn('sign up erreur imprévue',err);
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
        this.resetCodeControl();
        this.auth.changeMode(Process_flow.SIGN_IN);
      })
      .catch((err) => {
        // Erreur explicite en cas d'échec réel de confirmation
        this.toastService.showError('sign up', err?.message || 'Confirmation impossible');
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
    this.resetCodeControl();
    this.auth.changeMode(Process_flow.RESET_PASSWORD);
  }
  resetPassword() {
    if (this.loggerForm.get('new_password')?.invalid) return;
    this.auth.resetPassword(this.email.value);
    // Lock the chosen new password so it can't be altered in the confirm step
    this.loggerForm.get('new_password')?.disable({ emitEvent: false });
  }
  resendConfirmEmailCode() {
    if (this.resendCooldownSeconds > 0 || !this.email.value) return;

    this.auth.resendConfirmationCode(this.email.value)
      .then(() => {
        this.startResendCooldown(45);
      })
      .catch((err: any) => {
        if (err?.name === 'LimitExceededException') {
          this.signup_msg = 'Trop de demandes de code. Patientez un instant avant de réessayer.';
          this.startResendCooldown(90);
        }
      });
  }

  private startResendCooldown(seconds: number): void {
    if (this.resendCooldownTimer) {
      clearInterval(this.resendCooldownTimer);
      this.resendCooldownTimer = null;
    }

    this.resendCooldownSeconds = seconds;
    this.resendCooldownTimer = setInterval(() => {
      if (this.resendCooldownSeconds <= 1) {
        this.resendCooldownSeconds = 0;
        if (this.resendCooldownTimer) {
          clearInterval(this.resendCooldownTimer);
          this.resendCooldownTimer = null;
        }
        return;
      }

      this.resendCooldownSeconds -= 1;
    }, 1000);
  }

  private stopResendCooldown(): void {
    if (this.resendCooldownTimer) {
      clearInterval(this.resendCooldownTimer);
      this.resendCooldownTimer = null;
    }
    this.resendCooldownSeconds = 0;
  }

  private startSignupCooldown(seconds: number): void {
    if (this.signupCooldownTimer) {
      clearInterval(this.signupCooldownTimer);
      this.signupCooldownTimer = null;
    }

    this.signupCooldownSeconds = seconds;
    this.signupCooldownTimer = setInterval(() => {
      if (this.signupCooldownSeconds <= 1) {
        this.signupCooldownSeconds = 0;
        if (this.signupCooldownTimer) {
          clearInterval(this.signupCooldownTimer);
          this.signupCooldownTimer = null;
        }
        return;
      }

      this.signupCooldownSeconds -= 1;
    }, 1000);
  }

  private stopSignupCooldown(): void {
    if (this.signupCooldownTimer) {
      clearInterval(this.signupCooldownTimer);
      this.signupCooldownTimer = null;
    }
    this.signupCooldownSeconds = 0;
  }

  ngOnDestroy(): void {
    this.stopResendCooldown();
    this.stopSignupCooldown();
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
    // Remove async validator when returning to sign-in (not needed, avoids PENDING state)
    this.loggerForm.get('email')?.removeAsyncValidators(this.emailValidator);
    this.loggerForm.get('email')?.updateValueAndValidity({ emitEvent: false });
    // Reset fields and modes to go back to login without resetting
    this.loggerForm.get('code')?.reset('');
    this.loggerForm.get('code')?.setValidators([]);
    this.loggerForm.get('code')?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.password.setValidators([Validators.required]);
    this.password.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    const newPwdCtrl = this.loggerForm.get('new_password');
    if (newPwdCtrl?.disabled) newPwdCtrl.enable({ emitEvent: false });
    newPwdCtrl?.reset('');
    newPwdCtrl?.setValidators([]);
    newPwdCtrl?.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    this.logging_msg = '';
    this.signup_msg = '';
    this.resetCodeControl();
    this.showPassword = false;
    this.showNewPassword = false;
    this.auth.changeMode(Process_flow.SIGN_IN);
  }

  private resetCodeControl(value = ''): void {
    const normalized = value.replace(/\D/g, '').slice(0, this.confirmationCodeLength);
    this.code.setValue(normalized, { emitEvent: false });
    this.code.markAsPristine();
    this.code.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  private normalizeCodeControl(): void {
    this.resetCodeControl(this.code.value ?? '');
  }
  




  emailValidator = (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value) return of(null);
    if (!control.value.match(EMAIL_PATTERN)) return of(null);
    return of(control.value).pipe(
      switchMap((email) => from(this.membersService.searchMemberByEmail(email))),
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
