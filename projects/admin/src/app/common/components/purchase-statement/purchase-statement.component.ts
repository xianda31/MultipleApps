import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { PurchaseStatementEntry } from '../../interfaces/accounting.interface';

@Component({
  selector: 'app-purchase-statement',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './purchase-statement.component.html',
  styleUrl: './purchase-statement.component.scss',
})
export class PurchaseStatementComponent {
  @Input() entries: PurchaseStatementEntry[] = [];
  @Input() emptyMessage = 'Aucun achat enregistré pour cette saison.';
}