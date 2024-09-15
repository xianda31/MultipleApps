import { CommonModule, JsonPipe } from '@angular/common';
import { Component } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MembersService } from '../../../admin-dashboard/src/app/members/service/members.service';
import { delay, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { ToastService } from '../../toaster/toast.service';
import { Process_flow } from './authentification_interface';
import { Router } from '@angular/router';
import { AuthentificationService } from '../authentification.service';



const EMAIL_PATTERN = "^[_A-Za-z0-9-\+]+(\.[_A-Za-z0-9-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9]+)*(\.[A-Za-z]{2,})$";
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

  mode$: Observable<Process_flow>;
  mode: Process_flow = Process_flow.SIGN_IN;

  loggerForm: FormGroup = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.pattern(EMAIL_PATTERN)]),
    password: new FormControl('', [Validators.required]),
    sign_up_code: new FormControl(''),
  });

  get email() { return this.loggerForm.get('email')!; }
  get password() { return this.loggerForm.get('password')!; }

  constructor(
    private membersService: MembersService,
    private toastService: ToastService,
    private auth: AuthentificationService,
    private router: Router

  ) {

    this.mode$ = this.auth.mode$;
    this.mode$.subscribe((mode) => {
      this.mode = mode;
    }
    );

    this.email.setAsyncValidators(this.emailValidator);
  }

  emailValidator = (control: AbstractControl): Observable<ValidationErrors | null> => {

    if (!control.value.match(EMAIL_PATTERN)) return of(null);
    return of(control.value).pipe(
      delay(100),
      switchMap((email) => from(this.membersService.getMemberByEmail(email))),
      // tap((member) => console.log("member", member?.lastname)),
      map((member) => {
        if (!member) return { not_member: true };
        if (member.has_account) return null;
        if (this.mode === this.process_flow.SIGN_IN) {
          return null;

          // return { no_account: true };
        } else {
          return null;
        }
      })
    )
  }

  async signIn() {
    if (this.loggerForm.invalid) return;
    try {
      let { isSignedIn, nextStep } = await this.auth.signIn(this.email.value, this.password.value)
      // console.log("sign in", { isSignedIn, nextStep });
      if (!isSignedIn) return;
      const me = await this.membersService.getMemberByEmail(this.email.value);
      // console.log("me", me);
      this.auth.whoAmI = me;
      this.router.navigate(['/']);

    } catch (err: any) {
      // this.toastService.showInfoToast('sign in', err.message);
      console.log("sign in error", err);
    }
  }

  goSignUp() {
    this.auth.changeMode(Process_flow.SIGN_UP);
  }

  async signUp() {

    if (this.loggerForm.invalid) return;
    await this.auth.signUp(this.email.value, this.password.value)
      // .catch((err) => this.toastService.showInfoToast('sign up', err.message))
      .then((res) => { this.sign_up_sent = true; });
  }

  async confirmSignUp() {
    if (this.loggerForm.invalid) return;
    await this.auth.confirmSignUp(this.email.value, this.loggerForm.get('sign_up_code')?.value
    )
      .then(({ isSignUpComplete, nextStep }) => {
        console.log("isSignUpComplete", isSignUpComplete);
        this.membersService.getMemberByEmail(this.email.value)
          .then((member) => {
            if (!member) return;
            member.has_account = true;
            this.membersService.updateMember(member);
            console.log("member", member);
            this.auth.changeMode(Process_flow.SIGN_IN);

          });
        // this.sign_up_sent = false;

      })
    // .catch((err) => this.toastService.showInfoToast('sign up', err.message));
  }

  signOut() {
    this.auth.signOut();
  }
}
