import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { FrontCartService } from '../services/front-cart.service';

@Component({
  selector: 'app-checkout-cancel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout-cancel.component.html',
  styleUrls: ['./checkout-cancel.component.scss']
})
export class CheckoutCancelComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(private cartService: FrontCartService) {}

  ngOnInit(): void {
    // Le panier reste intact pour permettre à l'utilisateur de réessayer
    // (contrairement au succès où on le vide)
    console.log('Utilisateur a annulé le paiement');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
