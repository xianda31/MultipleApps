import { Component } from '@angular/core';
import { MembersService } from '../../common/services/members.service';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { Member } from '../../common/interfaces/member.interface';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Accreditation } from '../../common/authentification/group.interface';
import { GroupService } from '../../common/authentification/group.service';
import { ConnexionComponent } from '../../common/authentification/connexion/connexion.component';

@Component({
  selector: 'app-back-page',
  standalone: true,
  imports: [CommonModule, ConnexionComponent],
  templateUrl: './back-page.component.html',
  styleUrl: './back-page.component.scss'
})
export class BackPageComponent {

  logged_member$ !: Observable<Member | null>;
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
      }
    });
  }
} 
