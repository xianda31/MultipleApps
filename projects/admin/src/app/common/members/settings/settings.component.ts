import { Component } from '@angular/core';
import { MemberSettingsService } from '../../services/member-settings.service';
import { AuthentificationService } from '../../authentification/authentification.service';
import { TitleService } from '../../../front/title/title.service';
import { CommonModule, Location } from '@angular/common';

@Component({
  selector: 'app-settings',
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
constructor(
  private memberSettingsService: MemberSettingsService,
  private authService: AuthentificationService,
  private titleService: TitleService,
  private location: Location
)
   { 
   }

   ngOnInit(): void {

    this.titleService.setTitle('Mes préférences');
    this.authService.logged_member$.subscribe(member => {
      if (member) {
         this.memberSettingsService.access_settings(member).subscribe(setting_changed => {;
           console.log('Member settings accessed:', setting_changed);
           this.location.back();
         });
      }
    });
   }


}
