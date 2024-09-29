import { Component } from '@angular/core';
import { AccountingService } from '../accounting.service';
import { Payment } from '../../cart/cart.interface';
import { CommonModule } from '@angular/common';
import { MembersService } from '../../../../../admin-dashboard/src/app/members/service/members.service';
import { ProductService } from '../../../../../common/services/product.service';

@Component({
  selector: 'app-books',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './books.component.html',
  styleUrl: './books.component.scss'
})
export class BooksComponent {
  payments: Payment[] = [];

  constructor(
    private accountingService: AccountingService,
    private membersService: MembersService,
    private productService: ProductService,
  ) { }

  ngOnInit(): void {
    this.accountingService.getPayments().subscribe((payments) => {
      this.payments = payments.filter((payment) => payment.season === '2024/25');
      console.log('payments', payments);
    });
  }
  payer_name(payer_id: string) {
    let payer = this.membersService.getMember(payer_id);
    return payer ? payer.lastname + ' ' + payer.firstname : '';
  }

  getProduct(product_id: string) {
    return this.productService.getProduct(product_id);
  }
}
