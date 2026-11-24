import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { Gamer } from '../fees.interface';

export interface CheckInConfirmation {
  gamer: Gamer;
  alreadyCheckedIn: boolean;
}

@Component({
  selector: 'app-fees-check-in-confirmation',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="confirmation-layer" aria-live="polite" aria-atomic="true">
      <div *ngFor="let item of feedback ? [feedback] : []" class="confirmation">
        <div class="confirmation-avatar" aria-hidden="true">
          <ng-container *ngIf="!photoFailed && (item.gamer.photo_url$ | async) as photoUrl; else noPhoto">
            <img [src]="photoUrl" alt="" (error)="photoFailed = true">
          </ng-container>
          <ng-template #noPhoto>
            <svg viewBox="0 0 48 48" focusable="false">
              <circle cx="24" cy="24" r="24" fill="#d0e9da"></circle>
              <circle cx="24" cy="18" r="8" fill="#5a9871"></circle>
              <path d="M9 41c1-8 7-13 15-13s14 5 15 13" fill="#5a9871"></path>
            </svg>
          </ng-template>
        </div>
        <div class="confirmation-details">
          <div class="confirmation-status">
            <i class="bi bi-check-circle-fill" aria-hidden="true"></i>
            {{ item.alreadyCheckedIn ? 'Déjà pointé par carte' : 'Pointage confirmé' }}
          </div>
          <div class="confirmation-name">{{ item.gamer.firstname }} {{ item.gamer.lastname }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirmation-layer {
      position: fixed;
      inset: 0;
      z-index: 1080;
      display: grid;
      place-items: center;
      padding: 1rem;
      pointer-events: none;
    }
    .confirmation {
      display: flex;
      align-items: center;
      gap: clamp(1rem, 3vw, 2rem);
      width: min(42rem, 100%);
      max-height: calc(100dvh - 2rem);
      padding: clamp(1rem, 3vw, 2rem);
      border: .3rem solid #198754;
      border-radius: 1.25rem;
      background: #edf8f1;
      color: #155e35;
      box-shadow: 0 1rem 3rem rgba(0, 0, 0, .35);
      animation: confirmation-zoom 300ms ease-out;
    }
    .confirmation-avatar {
      flex: 0 0 clamp(4rem, 14vw, 8rem);
      width: clamp(4rem, 14vw, 8rem);
      aspect-ratio: 1;
    }
    .confirmation-avatar img, .confirmation-avatar svg {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }
    .confirmation-details { min-width: 0; overflow-wrap: anywhere; }
    .confirmation-status { font-size: clamp(1.2rem, 3vw, 2rem); font-weight: 700; }
    .confirmation-name { font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 800; line-height: 1.1; }
    @keyframes confirmation-zoom {
      from { transform: scale(.65); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .confirmation { animation: none; }
    }
  `],
})
export class FeesCheckInConfirmationComponent implements OnChanges {
  @Input() feedback: CheckInConfirmation | null = null;
  photoFailed = false;

  ngOnChanges(): void {
    this.photoFailed = false;
  }
}
