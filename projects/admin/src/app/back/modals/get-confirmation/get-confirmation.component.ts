import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
    selector: 'app-get-confirmation',
    imports: [CommonModule],
    templateUrl: './get-confirmation.component.html',
    styleUrl: './get-confirmation.component.scss'
})
export class GetConfirmationComponent {
  @Input() title: string = '';
  @Input() subtitle!: string ;

  constructor(
        private activeModal: NgbActiveModal,
    
  ) { }

 respond(answer: boolean) {
  this.activeModal.close(answer);
}

    // close() {
    //   this.activeModal.close(null);
    // }

}
