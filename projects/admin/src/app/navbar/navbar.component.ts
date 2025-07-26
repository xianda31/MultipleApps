import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminInComponent } from "../../../../common/authentification/admin-in/admin-in.component";
import { Group_priorities } from '../../../../common/authentification/group.interface';
import { ToastService } from '../../../../common/toaster/toast.service';
import { environment } from '../../environments/environment';

@Component({
    selector: 'app-navbar',
    standalone: true,
    imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule, AdminInComponent],
    templateUrl: './navbar.component.html',
    styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  @Input() season: string = '';
  @Input() entries_nbr: number = 0;
  @Input() accreditation_level!: number ;
  accreditation_levels = Group_priorities;
  production_mode : boolean = false;

  constructor(
    private toastService: ToastService
  ) {  }

  ngOnInit(): void {
    if (this.accreditation_level === undefined || this.accreditation_level <= 0) {
      this.toastService.showInfo('Administration', 'Veuillez vous connecter pour utilser cette application.');
    }

    this.production_mode = environment.production ;

  }
}