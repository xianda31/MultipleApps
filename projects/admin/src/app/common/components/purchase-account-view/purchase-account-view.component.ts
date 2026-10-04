import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { PurchaseStatementEntry } from '../../interfaces/accounting.interface';
import { PurchaseStatementComponent } from '../purchase-statement/purchase-statement.component';
import { PurchaseSummaryComponent } from '../purchase-summary/purchase-summary.component';

@Component({
  selector: 'app-purchase-account-view',
  standalone: true,
  imports: [CommonModule, PurchaseStatementComponent, PurchaseSummaryComponent],
  templateUrl: './purchase-account-view.component.html',
  styleUrl: './purchase-account-view.component.scss',
})
export class PurchaseAccountViewComponent {
  @Input() entries: PurchaseStatementEntry[] = [];
  @Input() assets = 0;
  @Input() debt = 0;
  @Input() emptyMessage = 'Aucun achat enregistré pour cette saison.';
}
