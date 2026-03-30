import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from '../../products/product.interface';
import { ProductService } from '../../../common/services/product.service';

/**
 * ShopProductService  
 * Gère le chargement et l'organisation des produits
 */
@Injectable({
  providedIn: 'root'
})
export class ShopProductService {

  constructor(private productService: ProductService) {}

  /**
   * Charge les produits et les organise par compte
   */
  loadAndOrganizeProducts(): Observable<{
    allProducts: Product[];
    productsArray: Map<string, Product[]>;
  }> {
    return this.productService.listProducts().pipe(
      map((products) => ({
        allProducts: products,
        productsArray: this.productService.products_by_accounts(products),
      }))
    );
  }

  /**
   * Retourne le style de couleur d'un produit
   */
  getProductColorStyle(product: Product): string {
    return this.productService.product_color_style(product);
  }

  /**
   * Retourne le style dégradé d'un produit
   */
  getProductGradientStyle(product: Product): string {
    const str = product.account || 'default';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    const sat = 60 + (Math.abs(hash >> 8) % 15);
    let light = 55 + (Math.abs(hash >> 16) % 15);
    if (product.paired) light = Math.max(30, light - 10);
    const hue2 = (hue + 20) % 360;
    const light2 = Math.max(28, light - 16);
    return `background: linear-gradient(135deg, hsl(${hue}, ${sat}%, ${light}%) 0%, hsl(${hue2}, ${sat}%, ${light2}%) 100%);`;
  }
}

