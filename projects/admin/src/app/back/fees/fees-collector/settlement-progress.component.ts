import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Observable } from 'rxjs';
import { SettlementProgress } from './fees-collector.service';

@Component({
  selector: 'app-settlement-progress',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">Clôture du tournoi</h5>
    </div>
    <div class="modal-body" *ngIf="progress$ | async as progress">
      <p class="mb-3">{{ progress.message }}</p>
      <div class="progress" role="progressbar"
        [attr.aria-valuenow]="progress.percent" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-bar progress-bar-striped progress-bar-animated"
          [style.width.%]="progress.percent">
          {{ progress.percent }} %
        </div>
      </div>
      <p class="small text-muted mt-3 mb-0">
        N’éteignez pas cet appareil. En cas d’interruption, la clôture pourra reprendre sur ce navigateur.
      </p>
    </div>
  `,
})
export class SettlementProgressComponent {
  @Input({ required: true }) progress$!: Observable<SettlementProgress>;
}
