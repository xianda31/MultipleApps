import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StripeProductService } from '../../common/services/stripe-product.service';
import { ProductService } from '../../common/services/product.service';
import { StripeProduct } from './stripe-product.interface';

@Component({
  selector: 'app-stripe-products-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stripe-products-admin.component.html',
  styleUrls: ['./stripe-products-admin.component.scss']
})
export class StripeProductsAdminComponent implements OnInit {
  products: StripeProduct[] = [];
  editing: Partial<StripeProduct> | null = null;

  constructor(
    private stripeProductService: StripeProductService,
    private productService: ProductService
  ) {}

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.productService.listProducts().subscribe(p => this.products = p as unknown as StripeProduct[]);
  }

  add() {
    this.editing = { active: true };
  }

  edit(product: StripeProduct) {
    this.editing = { ...product };
  }

  cancel() {
    this.editing = null;
  }

  save() {
    if (!this.editing) return;
    const prod = this.editing as StripeProduct;
    // Vérification des champs requis
    if (!prod.name || !prod.currency || prod.price == null) {
      alert('Veuillez remplir tous les champs obligatoires (nom, montant, devise).');
      return;
    }
    // description doit être une chaîne (jamais null/undefined)
    prod.description = prod.description ?? '';
    // Si stripeId existe, on met à jour, sinon on crée (DynamoDB générera l'id)
    const op = prod.id ?
      this.stripeProductService.updateStripeProduct(prod as any) :
      this.stripeProductService.createStripeProduct((({ id, ...rest }) => rest)(prod) as any);
    op.then(() => { this.editing = null; this.refresh(); });
  }

  delete(product: StripeProduct) {
    if (confirm('Supprimer ce StripeProduct ?')) {
      this.stripeProductService.deleteStripeProduct(product.id).then(() => this.refresh());
    }
  }

  toggleActive(product: StripeProduct) {
    const updated = { ...product, active: !product.active };
    this.stripeProductService.updateStripeProduct(updated as any).then(() => this.refresh());
  }
}
