import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { PurchaseStatementEntry } from '../../interfaces/accounting.interface';

@Component({
  selector: 'app-purchase-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './purchase-summary.component.html',
  styleUrl: './purchase-summary.component.scss',
})
export class PurchaseSummaryComponent {
  @Input() entries: PurchaseStatementEntry[] = [];
  @Input() assets = 0;

  get totalSpent(): number {
    return this.entries.reduce((total, entry) => total + entry.spentAmount, 0);
  }
}