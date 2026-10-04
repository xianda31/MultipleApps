import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { CUSTOMER_ACCOUNT, PurchaseStatementEntry } from '../../interfaces/accounting.interface';

@Component({
  selector: 'app-purchase-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './purchase-summary.component.html',
  styleUrl: './purchase-summary.component.scss',
})
export class PurchaseSummaryComponent {
  @Input() entries: PurchaseStatementEntry[] = [];

  get totalSpent(): number {
    return this.entries.reduce((total, entry) => total + entry.spentAmount, 0);
  }

  get totalDisbursed(): number {
    return this.entries.reduce((total, entry) => total + entry.amount, 0);
  }

  get totalAssetsUsed(): number {
    return this.entries
      .flatMap(entry => entry.items)
      .filter(item => item.key === CUSTOMER_ACCOUNT.ASSET_debit)
      .reduce((total, item) => total - item.amount, 0);
  }

  get totalAssetsGranted(): number {
    return this.entries
      .flatMap(entry => entry.items)
      .filter(item => item.key === CUSTOMER_ACCOUNT.ASSET_credit)
      .reduce((total, item) => total + item.amount, 0);
  }

  get totalDebtCreated(): number {
    return this.entries
      .flatMap(entry => entry.items)
      .filter(item => item.key === CUSTOMER_ACCOUNT.DEBT_debit)
      .reduce((total, item) => total - item.amount, 0);
  }

  get totalDebtRepaid(): number {
    return this.entries
      .flatMap(entry => entry.items)
      .filter(item => item.key === CUSTOMER_ACCOUNT.DEBT_credit)
      .reduce((total, item) => total + item.amount, 0);
  }

}