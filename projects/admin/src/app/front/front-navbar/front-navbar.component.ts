import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { GroupService } from '../../common/authentification/group.service';
import { Accreditation } from '../../common/authentification/group.interface';
import { Member } from '../../common/interfaces/member.interface';
import { Offcanvas } from 'bootstrap';
import { SignInComponent } from '../../common/authentification/sign-in/sign-in.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbDropdownModule, NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-front-navbar',
  imports: [CommonModule, FormsModule,ReactiveFormsModule,NgbDropdownModule, NgbCollapseModule, RouterLink,SignInComponent],
  templateUrl: './front-navbar.component.html',
  styleUrl: './front-navbar.component.scss'
})
export class FrontNavbarComponent {
  logged_member$ : Observable<Member | null> = new Observable<Member | null>();
  user_accreditation: Accreditation | null = null; 
  lastActiveNavItem: string = '';
  isCollapsed = true;

  constructor(
    private auth: AuthentificationService,
    private groupService: GroupService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.logged_member$ = this.auth.logged_member$;
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects || event.url;
      if (url.includes('tournaments')) {
        this.lastActiveNavItem = 'tournaments';
      } else if (url.includes('fonctionnement') || url.includes('enseignants')) {
        this.lastActiveNavItem = 'ecole';
      } else if (url.includes('purchases') || url.includes('tickets')) {
        this.lastActiveNavItem = 'achats';
      }
      localStorage.setItem('lastActiveNavItem', this.lastActiveNavItem);
    });
    this.lastActiveNavItem = localStorage.getItem('lastActiveNavItem') || '';
    this.auth.logged_member$.subscribe(async (member) => {
      if (member !== null) {
        this.user_accreditation = await this.groupService.getUserAccreditation();
        this.force_canvas_to_close();
      } 
    });
  }

  isNavItemActive(navItem: string): boolean {
    return this.lastActiveNavItem === navItem;
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }

  force_canvas_to_close() {
    const canvas = document.getElementById('loggingOffCanvas');
    if (canvas) {
      const bsOffcanvas = Offcanvas.getInstance(canvas);
      if (bsOffcanvas) {
        bsOffcanvas.hide();
        setTimeout(() => {
          canvas.classList.remove('show');
          const backdrop = document.querySelector('.offcanvas-backdrop');
          if (backdrop) {
            backdrop.parentNode?.removeChild(backdrop);
          }
          document.body.classList.remove('offcanvas-backdrop', 'show', 'modal-open');
        }, 300);
      }
    }
  }

  async signOut() {
    try {
      sessionStorage.clear();
      await this.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
}
