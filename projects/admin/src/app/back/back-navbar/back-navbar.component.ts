import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Group_names, Group_priorities } from '../../common/authentification/group.interface';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { GroupService } from '../../common/authentification/group.service';
import { environment } from '../../../environments/environment';
import { NgbCollapseModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Offcanvas } from 'bootstrap';
import { Accreditation } from '../../common/authentification/group.interface';
import { Observable } from 'rxjs';
import { Member } from '../../common/interfaces/member.interface';
import { ConnexionComponent } from '../../common/authentification/connexion/connexion.component';
import { Process_flow } from '../../common/authentification/authentification_interface';
import { MembersService } from '../../common/services/members.service';
import { MemberSettingsService } from '../../common/services/member-settings.service';



@Component({
  selector: 'app-back-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule, NgbDropdownModule,NgbCollapseModule, ConnexionComponent],
  templateUrl: './back-navbar.component.html',
  styleUrl: './back-navbar.component.scss'
})
export class BackNavbarComponent implements OnInit {

  @Input() season: string = '';
  @Input() entries_nbr: number = 0;
  accreditation_level!: number;
  accreditation_levels = Group_priorities;
  production_mode: boolean = false;
  user_accreditation: Accreditation | null = null;
  logged_member$: Observable<Member | null> = new Observable<Member | null>();
 
  avatar$ !: Observable<string>;



  constructor(
    private auth: AuthentificationService,
    private groupService: GroupService,
    private memberSettingsService: MemberSettingsService


  ) { }

  ngOnInit(): void {
    this.logged_member$ = this.auth.logged_member$;

    this.accreditation_level = -1;

    this.auth.logged_member$.subscribe(async (member) => {
      if (member !== null) {
        this.user_accreditation = await this.groupService.getUserAccreditation();
        this.force_canvas_to_close();

        this.avatar$ = this.memberSettingsService.getAvatarUrl(member);
        
        this.memberSettingsService.settingsChange$().subscribe(() => {
          this.avatar$ = this.memberSettingsService.getAvatarUrl(member);
        });

        let groups = await this.groupService.getCurrentUserGroups();
        if (groups.length > 0) {
          let group = groups[0] as Group_names;
          this.accreditation_level = Group_priorities[group];
        }
      }
    });
    this.production_mode = environment.production;
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
          this.accreditation_level = -1;

      await this.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

}