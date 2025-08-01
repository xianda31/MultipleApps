import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../common/services/toast.service';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { GroupService } from '../../common/authentification/group.service';
import { Group_names, Group_priorities } from '../../common/authentification/group.interface';
import { SharedModule } from '../../common/shared.module';
import { Member } from '../../common/member.interface';
import { Offcanvas } from 'bootstrap';

@Component({
  selector: 'app-front-navbar',
  imports: [CommonModule, SharedModule,RouterLink],
  templateUrl: './front-navbar.component.html',
  styleUrl: './front-navbar.component.scss'
})
export class FrontNavbarComponent {
  accreditation_level!: number;
  accreditation_levels = Group_priorities;
  logged_member : Member | null = null;

  constructor(
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
        this.logged_member = member;
        // this.force_canvas_to_close();
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
}
