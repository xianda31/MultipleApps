import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthentificationService } from '../authentification.service';
import { ToastService } from '../../toaster/toast.service';
import { Member } from '../../member.interface';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { GetLoggingComponent } from '../../../cashier/src/app/modals/get-logging/get-logging.component';
import { Observable, of, delay, switchMap, from, map, tap } from 'rxjs';
import { MembersService } from '../../../admin-dashboard/src/app/members/service/members.service';

const EMAIL_PATTERN = "^[_A-Za-z0-9-\+]+(\.[_A-Za-z0-9-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9]+)*(\.[A-Za-z]{2,})$";
const PSW_PATTERN = '^(?!\\s+)(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[\\^$*.[\\]{}()?"!@#%&/\\\\,><\': ;| _~`=+-]).{8,256}(?<!\\s)$';

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
  // show_login: boolean = false;
  show_password: boolean = false;


  constructor(
    private fb: FormBuilder,
    private auth: AuthentificationService,
    private toastService: ToastService,
    private modalService: NgbModal,
    private membersService: MembersService


  ) {
    this.loginForm = this.fb.group({
      email: ['',
        {
          validators: [Validators.required, Validators.email],
          asyncValidators: this.emailValidator,
        }],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {
    this.auth.logged_member$.subscribe((member) => {
      this.logged_member = null;
      if (member !== null) {
        // this.toastService.showSuccessToast('identification', 'Bonjour ' + member.firstname);
        this.logged_member = member;
      }
    });
  }
  get email() { return this.loginForm.get('email')!; }
  get password() { return this.loginForm.get('password') };

  signOut() {
    this.auth.signOut();
    // this.show_login = false;

  }

  async signIn() {
    this.auth.signIn(this.email!.value, this.password!.value);
  }

  async signUp() {
    if (this.applying_member) {
const modalRef = this.modalService.open(GetLoggingComponent, { centered: true });
    modalRef.componentInstance.email = this.email.value;
    modalRef.componentInstance.member = this.applying_member;
    modalRef.componentInstance.mode = 'create_account';
    modalRef.result.then((response: any) => {
      // if (response) {
        //   console.log('response', response);
        // }
      });
      
      // this.auth.signUp(this.applying_member.email, this.password!.value, this.applying_member.id);
    } else {
      this.toastService.showErrorToast('Création compte', 'Mel non répertorié dans la base de données adhérents');
    }
  }
  
  resetPassword() {
    // this.show_login = false;
    const modalRef = this.modalService.open(GetLoggingComponent, { centered: true });
    modalRef.componentInstance.email = this.email.value;
    modalRef.componentInstance.member = this.applying_member;
    modalRef.componentInstance.mode = 'reset_password';
    modalRef.result.then((response: any) => {
      // if (response) {
      //   console.log('response', response);
      // }
    });
  }

  emailValidator = (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value.match(EMAIL_PATTERN)) return of(null);
    return of(control.value).pipe(
      switchMap((email) => from(this.membersService.getMemberByEmail(email))),
      tap((member) => {console.log('emailValidator member', member); }),
      tap((member) => this.applying_member = member),
      map((member) => { return member ? null : { not_member: false }; })
    )
  }

}