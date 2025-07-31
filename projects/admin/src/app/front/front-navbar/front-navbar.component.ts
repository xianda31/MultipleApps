import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../common/services/toast.service';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { GroupService } from '../../common/authentification/group.service';
import { Group_names, Group_priorities } from '../../common/authentification/group.interface';

@Component({
  selector: 'app-front-navbar',
  imports: [CommonModule, RouterLink],
  templateUrl: './front-navbar.component.html',
  styleUrl: './front-navbar.component.scss'
})
export class FrontNavbarComponent {
  accreditation_level!: number;
  accreditation_levels = Group_priorities;
  
  constructor(
    private toastService: ToastService,
    private auth: AuthentificationService,
    private groupService: GroupService,


  ) { }

  ngOnInit(): void {


    this.accreditation_level = -1;

    this.auth.logged_member$.subscribe(async (member) => {
      console.log('FrontNavbarComponent: member', member);
      if (member !== null) {
        let groups = await this.groupService.getCurrentUserGroups();
        if (groups.length > 0) {
          let group = groups[0] as Group_names;
          this.accreditation_level = Group_priorities[group];
        }
      }
    });
  }
}
