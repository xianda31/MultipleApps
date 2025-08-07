import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthentificationService } from '../authentification.service';
import { ToastService } from '../../services/toast.service';
import { Member } from '../../member.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable, of, switchMap, from, map, tap, catchError } from 'rxjs';
import { MembersService } from '../../members/services/members.service';

const EMAIL_PATTERN = '^[\\w.-]+@[A-Za-z0-9-]+\\.[A-Za-z]{2,}(\\.[A-Za-z]{2,})*$';

@Component({
    selector: 'app-admin-in',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule],
    templateUrl: './admin-in.component.html',
    styleUrl: './admin-in.component.scss'
})
export class AdminInComponent {

  loginForm !: FormGroup;
  logged_member: Member | null = null;
  applying_member: Member | null = null;
  show_password: boolean = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthentificationService,
    private toastService: ToastService,
    private modalService: NgbModal,
    private membersService: MembersService
  ) {
    this.loginForm = this.fb.group({
      username: [''],
      email: ['',
        {
          validators: [Validators.required, Validators.email],
          asyncValidators: this.emailValidator,
        }],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async ngOnInit() {
    this.auth.logged_member$.subscribe(async (member: Member | null) => {
      this.logged_member = null;
      if (member !== null) {
        this.logged_member = member;
      }
    });
  }

  get email() { return this.loginForm.get('email')!; }
  get password() { return this.loginForm.get('password') };

  signOut() {
    sessionStorage.clear();
    this.logged_member = null;
    this.auth.signOut();
  }

  async signIn() {
    this.auth.signIn(this.email!.value, this.password!.value);
  }

  async signUp() {
    if (this.applying_member) {
      // Modal functionality removed - needs proper modal component
      this.toastService.showInfo('Sign up', 'Feature not available yet');
    } else {
      this.toastService.showErrorToast('Création compte', 'Mel non répertorié dans la base de données adhérents');
    }
  }
  
  resetPassword() {
    // Modal functionality removed - needs proper modal component
    this.toastService.showInfo('Reset password', 'Feature not available yet');
  }

  emailValidator = (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value) return of(null);
    if (!control.value.match(EMAIL_PATTERN)) return of(null);
    return of(control.value).pipe(
      switchMap((email) => from(this.membersService.searchMemberByEmail(email))),
      tap((member) => this.applying_member = member),
      map((member) => { return member ? null : { not_member: false }; }),
      catchError((error) => {console.error('Error in emailValidator:', error); return of(null); })
    )
  }

}
