import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Group_names, Group_priorities } from '../../common/authentification/group.interface';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { GroupService } from '../../common/authentification/group.service';
import { environment } from '../../../environments/environment';
import { NgbCollapseModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { Accreditation } from '../../common/authentification/group.interface';
import { Observable } from 'rxjs';
import { Member } from '../../common/interfaces/member.interface';
import { MemberSettingsService } from '../../common/services/member-settings.service';
import { AssistanceRequestService } from '../../common/services/assistance-request.service';
import { REQUEST_STATUS } from '../../common/interfaces/assistance-request.interface';



@Component({
  selector: 'app-back-navbar',
  standalone: true,
  imports: [CommonModule, NgIf, RouterLink, FormsModule, ReactiveFormsModule, NgbDropdownModule, NgbCollapseModule],
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
active_menu_editor : boolean = false;
active_mailing : boolean = false;
  // assistance$ !: Observable<AssistanceRequest[]>;
  assistances_nbr : number = 0;



  constructor(
    private auth: AuthentificationService,
    private groupService: GroupService,
    private memberSettingsService: MemberSettingsService,
    private assistanceService: AssistanceRequestService


  ) { }

  ngOnInit(): void {

     this.assistanceService.getAllRequests().subscribe(requests => {
       this.assistances_nbr = requests.filter(r => r.status !== REQUEST_STATUS.RESOLVED).length;
     });

      this.active_menu_editor = environment.active_menu_editor;
      this.active_mailing = environment.active_mailing;


    this.logged_member$ = this.auth.logged_member$;

    this.accreditation_level = -1;

    this.auth.logged_member$.subscribe(async (member) => {
      if (member !== null) {
        this.user_accreditation = await this.groupService.getUserAccreditation();
        // this.force_canvas_to_close();

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