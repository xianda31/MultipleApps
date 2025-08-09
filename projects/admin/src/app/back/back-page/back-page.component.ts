import { Component } from '@angular/core';
import { MembersService } from '../../common/services/members.service';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { Member } from '../../common/interfaces/member.interface';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-back-page',
  imports: [CommonModule],
  templateUrl: './back-page.component.html',
  styleUrl: './back-page.component.scss'
})
export class BackPageComponent {

  logged_member$ !:Observable<Member | null>;
  constructor(
    private auth: AuthentificationService,
    private membersService: MembersService,
  ) { }
  
  
  ngOnInit(): void {
   this.logged_member$ = this.auth.logged_member$;
  } 
}
