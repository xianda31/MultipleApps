import { Component } from '@angular/core';
import { AuthentificationService } from '../../common/authentification/authentification.service';
import { Member } from '../../common/interfaces/member.interface';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Accreditation } from '../../common/authentification/group.interface';
import { GroupService } from '../../common/authentification/group.service';
import { ConnexionComponent } from '../../common/authentification/connexion/connexion.component';

@Component({
  selector: 'app-back-page',
  standalone: true,
  imports: [CommonModule, RouterModule, ConnexionComponent],
  templateUrl: './back-page.component.html',
  styleUrl: './back-page.component.scss'
})
export class BackPageComponent {

  logged_member$ !: Observable<Member | null>;
  user_accreditation: Accreditation | null = null;

  constructor(
    private auth: AuthentificationService,
    private groupService: GroupService,
    private router: Router  ) { }


  async ngOnInit(): Promise<void> {
    this.logged_member$ = this.auth.logged_member$;

    // Déconnexion automatique si route /signout
    if (this.router.url.endsWith('/signout')) {
      await this.auth.signOut();
      // Redirige vers la page d'accueil back après déconnexion
      this.router.navigate(['/', 'back', 'home']);
      return;
    }

    this.auth.logged_member$.subscribe(async (member) => {
      if (member !== null) {
        this.user_accreditation = await this.groupService.getUserAccreditation();
      }
    });
  }
} 
