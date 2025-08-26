import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { GroupService } from '../../common/authentification/group.service';
import { Accreditation } from '../../common/authentification/group.interface';
import { Member } from '../../common/interfaces/member.interface';
import { Offcanvas } from 'bootstrap';
import { ConnexionComponent } from '../../common/authentification/connexion/connexion.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbDropdownModule, NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { Process_flow } from '../../common/authentification/authentification_interface';

@Component({
  selector: 'app-front-navbar',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgbDropdownModule, NgbCollapseModule, RouterLink, ConnexionComponent],
  templateUrl: './front-navbar.component.html',
  styleUrl: './front-navbar.component.scss'
})
export class FrontNavbarComponent {
  logged_member$: Observable<Member | null> = new Observable<Member | null>();
  user_accreditation: Accreditation | null = null;
  lastActiveNavItem: string = '';
  isCollapsed = true;

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
  closeBurger() {
    if (window.innerWidth < 576) {
      this.isCollapsed = true;
    }
  }
  
  isNavItemActive(navItem: string): boolean {
    return this.lastActiveNavItem === navItem;
  }

  toggleCollapse() {
    this.isCollapsed = !this.isCollapsed;
  }
   onCanvasClose() {
      console.log('Canvas closed');
      this.auth.changeMode(Process_flow.SIGN_IN);
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
