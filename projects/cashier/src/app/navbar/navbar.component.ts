import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminInComponent } from "../../../../common/authentification/admin-in/admin-in.component";
import { Group_names, Group_priorities } from '../../../../common/authentification/group.interface';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule, AdminInComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  @Input() season: string = '';
  @Input() entries_nbr: number = 0;
  @Input() accreditation_level: number = 0;
    accreditation_levels = Group_priorities;


  test : string = 'test';
}
