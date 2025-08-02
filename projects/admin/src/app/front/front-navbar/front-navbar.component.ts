import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { GroupService } from '../../common/authentification/group.service';
import { Accreditation, Group_names, Group_priorities } from '../../common/authentification/group.interface';
import { Member } from '../../common/member.interface';
import { Offcanvas } from 'bootstrap';
import { SignInComponent } from '../../common/authentification/sign-in/sign-in.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-front-navbar',
  imports: [CommonModule, FormsModule,ReactiveFormsModule,NgbDropdownModule, RouterLink,SignInComponent],
  templateUrl: './front-navbar.component.html',
  styleUrl: './front-navbar.component.scss'
})
export class FrontNavbarComponent {
  logged_member$ : Observable<Member | null> = new Observable<Member | null>();
  user_accreditation: Accreditation | null = null; 

  constructor(
    private auth: AuthentificationService,
    private groupService: GroupService,


  ) { }

  ngOnInit(): void {

    this.logged_member$ = this.auth.logged_member$;

    this.auth.logged_member$.subscribe(async (member) => {
      if (member !== null) {
        this.user_accreditation = await this.groupService.getUserAccreditation();
        this.force_canvas_to_close();
      } 
    });
  }

  force_canvas_to_close() {
    const canvas = document.getElementById('loggingOffCanvas');
    if (canvas) {
      const bsOffcanvas = Offcanvas.getInstance(canvas);
      if (bsOffcanvas) {
        bsOffcanvas.hide();
        // Patch: forcibly remove backdrop and 'show' class if still present
        setTimeout(() => {
          canvas.classList.remove('show');
          const backdrop = document.querySelector('.offcanvas-backdrop');
          if (backdrop) {
            backdrop.parentNode?.removeChild(backdrop);
          }
          document.body.classList.remove('offcanvas-backdrop', 'show', 'modal-open');
        }, 300); // Wait for Bootstrap animation
      }
    }
  }

    async signOut() {
    try {
      sessionStorage.clear();  // clear session storage
      // this.logged_member = null;
      await this.auth.signOut();  // sign out will redirect to the login page
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
}
