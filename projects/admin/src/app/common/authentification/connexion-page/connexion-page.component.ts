import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConnexionComponent } from '../connexion/connexion.component';
import { AuthentificationService } from '../authentification.service';
import { Member } from '../../interfaces/member.interface';
import { TitleService } from '../../../front/title/title.service';

@Component({
  selector: 'app-connexion-page',
  standalone: true,
  imports: [CommonModule, ConnexionComponent],
  templateUrl: './connexion-page.component.html',
  styleUrls: ['./connexion-page.component.scss']
})
export class ConnexionPageComponent {
logged_member!: Member | null;

  constructor(
    private titleService : TitleService,
    private auth: AuthentificationService,
  ) {
      this.titleService.setTitle('Authentification');  
     this.auth.logged_member$.subscribe(member => {
       this.logged_member = member;
       this.titleService.setTitle('');
     });
  }
}
