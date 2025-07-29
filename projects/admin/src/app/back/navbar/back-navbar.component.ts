import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminInComponent } from "../../common/authentification/admin-in/admin-in.component";
import { Group_names, Group_priorities } from '../../common/authentification/group.interface';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { GroupService } from '../../common/authentification/group.service';
import { ToastService } from '../../common/services/toast.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-back-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule, AdminInComponent],
  templateUrl: './back-navbar.component.html',
  styleUrl: './back-navbar.component.scss'
})
export class BackNavbarComponent implements OnInit {
  @Input() season: string = '';
  @Input() entries_nbr: number = 0;
   accreditation_level!: number;
  accreditation_levels = Group_priorities;
  production_mode: boolean = false;

  constructor(
    private toastService: ToastService,
    private auth: AuthentificationService,
    private groupService: GroupService,


  ) { }

  ngOnInit(): void {

    this.accreditation_level = -1;

    this.auth.logged_member$.subscribe(async (member) => {
      if (member !== null) {
        let groups = await this.groupService.getCurrentUserGroups();
        if (groups.length > 0) {
          let group = groups[0] as Group_names;
          this.accreditation_level = Group_priorities[group];
        }
      }
    });

    this.production_mode = environment.production;

  }
}