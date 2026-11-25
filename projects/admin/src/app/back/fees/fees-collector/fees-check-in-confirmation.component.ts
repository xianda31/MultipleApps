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
      gap: clamp(1rem, 3vw, 1.75rem);
      width: min(38rem, 100%);
      max-height: calc(100dvh - 2rem);
      padding: clamp(1.25rem, 3vw, 2rem);
      border: 1px solid #b9dfc8;
      border-left: .4rem solid #198754;
      border-radius: 1.1rem;
      background: linear-gradient(135deg, #fff 45%, #edf8f1);
      color: #17365b;
      box-shadow: 0 1rem 3rem rgba(23, 54, 91, .24), 0 .25rem .75rem rgba(23, 54, 91, .1);
      animation: confirmation-zoom 250ms ease-out;
    }
    .confirmation-avatar {
      flex: 0 0 clamp(4.5rem, 13vw, 7.5rem);
      width: clamp(4.5rem, 13vw, 7.5rem);
      aspect-ratio: 1;
      padding: .25rem;
      border: 2px solid #b9dfc8;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 .25rem .75rem rgba(25, 135, 84, .12);
    }
    .confirmation-avatar img, .confirmation-avatar svg {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }
    .confirmation-details { min-width: 0; overflow-wrap: anywhere; }
    .confirmation-status {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      padding: .35rem .7rem;
      border-radius: 999px;
      background: #e2f4e9;
      color: #17653a;
      font-size: clamp(.9rem, 2vw, 1.1rem);
      font-weight: 700;
      line-height: 1.25;
    }
    .confirmation-status .bi { font-size: 1.15em; line-height: 1; }
    .confirmation-name {
      margin-top: .65rem;
      font-size: clamp(1.6rem, 3.5vw, 2.6rem);
      font-weight: 800;
      line-height: 1.1;
    }
    @keyframes confirmation-zoom {
      from { transform: translateY(.5rem) scale(.97); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @media (max-width: 400px) {
      .confirmation { gap: .8rem; padding: 1rem; }
      .confirmation-avatar { flex-basis: 3.75rem; width: 3.75rem; }
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
