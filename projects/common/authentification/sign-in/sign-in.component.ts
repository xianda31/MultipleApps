import { CommonModule, JsonPipe } from '@angular/common';
import { Component } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MembersService } from '../../../admin-dashboard/src/app/members/service/members.service';
import { delay, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { ToastService } from '../../toaster/toast.service';
import { Process_flow } from '../authentification_interface';
import { Router } from '@angular/router';
import { AuthentificationService } from '../authentification.service';

const EMAIL_PATTERN = "^[_A-Za-z0-9-\+]+(\.[_A-Za-z0-9-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9]+)*(\.[A-Za-z]{2,})$";
const PSW_PATTERN = '^(?!\\s+)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[\\^$*.[\\]{}()?"!@#%&/\\\\,><\': ;| _~`=+-]).{8,256}(?<!\\s)$';
@Component({
  selector: 'app-sign-in',
  // standalone: true,
  // imports: [CommonModule, JsonPipe, FormsModule, ReactiveFormsModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss'
})
export class SignInComponent {

  sign_up_sent: boolean = false;
  process_flow = Process_flow;
  show_password: boolean = false;

  mode$: Observable<Process_flow>;
  mode: Process_flow = Process_flow.SIGN_IN;

  loggerForm: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.pattern(EMAIL_PATTERN)]),
    password: new FormControl('', [Validators.required, Validators.pattern(PSW_PATTERN)]),
    code: new FormControl(''),
  });

  get email() { return this.loggerForm.get('email')!; }
  get password() { return this.loggerForm.get('password')!; }
  get code() { return this.loggerForm.get('code')!; }
  emailValidator = (control: AbstractControl): Observable<ValidationErrors | null> => {

    if (!control.value.match(EMAIL_PATTERN)) return of(null);
    return of(control.value).pipe(
      delay(100),
      switchMap((email) => from(this.membersService.getMemberByEmail(email))),
      // tap((member) => console.log("member", member?.lastname)),
      map((member) => {
        if (!member) return { not_member: true };
        // if (member.has_account) return null;
        if (this.mode === this.process_flow.SIGN_IN) {
          return null;

          // return { no_account: true };
        } else {
          return null;
        }
      })
    )
  }

  constructor(
    private membersService: MembersService,
    private toastService: ToastService,
    private auth: AuthentificationService,
    private router: Router

  ) {

    this.mode$ = this.auth.mode$;
    this.mode$.subscribe((mode) => {
      this.mode = mode;
    });

    this.email.setAsyncValidators(this.emailValidator);

    // traiter le cas où l'utilisateur est déjà connecté
    this.auth.getCurrentUser()
      .then(async (member_id) => {
        if (member_id) {
          const me = await this.membersService.readMember(member_id);
          // this.auth.whoAmI = me;
          this.toastService.showSuccessToast('identification', 'Bonjour ' + me!.firstname);
          this.router.navigate(['/']);
        }
      })
      .catch((err) => console.log("err", err));  // pas grave si erreur
  }

  async signIn() {
    if (this.loggerForm.invalid) return;
    try {
      let member_id = await this.auth.signIn(this.email.value, this.password.value)
      if (!member_id) {
        this.toastService.showErrorToast('sign in', 'erreur imprévue');
        return;
      }
      console.log("member_id", member_id);
      const me = await this.membersService.readMember(member_id);
      // this.auth.whoAmI = me;
      this.toastService.showSuccessToast('identification', 'Bonjour ' + me!.firstname);
      this.router.navigate(['/']);

    } catch (err: any) {
      console.log("sign in error", err);
    }
  }

  goSignUp() {
    this.auth.changeMode(Process_flow.SIGN_UP);
  }

  async signUp() {

    if (this.loggerForm.invalid) return;
    let member = await this.membersService.getMemberByEmail(this.email.value);
    if (!member) {
      this.toastService.showErrorToast('sign up', 'erreur imprévue');
      return;
    } else {      // console.log("member", member);
    }
    await this.auth.signUp(this.email.value, this.password.value, member!.id)
      // .catch((err) => this.toastService.showInfoToast('sign up', err.message))
      .then(({ isSignUpComplete, nextStep }) => {
        this.sign_up_sent = true;
      });
  }

  async confirmSignUp() {
    if (this.loggerForm.invalid) return;
    await this.auth.confirmSignUp(this.email.value, this.code.value)
      .then(({ isSignUpComplete, nextStep }) => {
        if (!isSignUpComplete) {
          this.toastService.showErrorToast('sign up', 'erreur imprévue');
          return;
        } else {
          this.toastService.showSuccessToast('création compte', 'compte créé');
          this.membersService.getMemberByEmail(this.email.value)
            .then((member) => {
              if (!member) {
                this.toastService.showErrorToast('sign up', 'erreur imprévue');
                return;
              } else {
                // member.has_account = true;
                this.membersService.updateMember(member);
                this.toastService.showSuccessToast('création compte', 'Bienvenue ' + member.firstname);
                this.auth.changeMode(Process_flow.SIGN_IN);
              };
              this.router.navigate(['/']);
            });
        }
      });
  }

  resetPassword() {
    if (this.email.invalid) return;
    this.auth.resetPassword(this.email.value);
  }

  setPassword() {
    this.auth.newPassword(this.email.value, this.code.value, this.password.value);
  }

  signOut() {
    this.auth.signOut();
  }

}
