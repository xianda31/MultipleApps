import { Component, Input } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-team-subscription',
  standalone: true,
  imports: [],
  templateUrl: './team-subscription.component.html',
  styleUrl: './team-subscription.component.scss'
})
export class TeamSubscriptionComponent {
  resultat: string = 'coucou';
  @Input() title: string = '';

  constructor(
    private activeModal: NgbActiveModal
  ) { }


  close() {
    this.activeModal.close(this.resultat);
  }
}
