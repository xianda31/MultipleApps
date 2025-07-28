import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable, of, switchMap, tap } from 'rxjs';
import { SystemDataService } from './system-data.service';
import { ToastService } from '../toaster/toast.service';
import { Product } from '../../admin/src/app/products/product.interface';
import { DBhandler } from '../../admin/src/app/services/graphQL.service';


@Injectable({
    providedIn: 'root'
})
export class ProductService {
    private _products!: Product[];
    private _products$ = new BehaviorSubject<Product[]>([]);
    products_keys: string[] = [];

    constructor(
        private systemDataService: SystemDataService,
        private toastService: ToastService,
        private dbHandler: DBhandler
    ) { }


    // utilities functions


    products_by_accounts(products: Product[]): Map<string, Product[]> {
        const accounts = products.filter((product) => product.active).map((product) => product.account);
        const products_accounts = [...new Set(accounts)];

        let array = new Map();
        products_accounts.forEach((account) => {
            array.set(account, products.filter((product) => product.account === account));
        });
        return array;
    }


    // CL(R)UD Product

    // Create a new product
    async createProduct(product: Product): Promise<Product> {
        const { id, ...product_input } = product;

        try {
            const createdProduct = await this.dbHandler.createProduct(product_input);
            this._products.push(createdProduct as Product);
            // this._products = this._products.sort((a, b) => b.price - a.price);
            this._products$.next(this._products);
            return createdProduct;
        } catch (errors) {
            if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
                if ((errors[0] as any).errorType === 'Unauthorized') {
                    this.toastService.showErrorToast('Gestion des produits', 'Vous n\'êtes pas autorisé à créer un produit à la vente');
                    return Promise.reject('Unauthorized');
                }
            }

            this.toastService.showErrorToast('Gestion des cartes', 'Une erreur est survenue lors de la création d\'un produit à la vente');
            return Promise.reject('Error updating product');
        }
    }

    // Retrieve all products
    listProducts(): Observable<Product[]> {

        const _listProducts = this.dbHandler.listProducts().pipe(
            map((products) => products.filter((product) => product.active)),
            // map((products) => products.sort((a, b) => b.price - a.price)),
            switchMap((products) => this.sorted_products(products)),
            map((products) => {
                this._products = products;
                this._products$.next(products);
            }),
            switchMap(() => this._products$.asObservable())
        );
        return this._products ? this._products$.asObservable() : _listProducts;
    }

    sorted_products(products: Product[]): Observable<Product[]> {
        return this.systemDataService.get_configuration().pipe(
            map((conf) => {
                const products_accounts = conf.revenue_and_expense_tree.revenues.map((account) => account.key);
                const sorted_products: Product[] = [];
                products_accounts.forEach((key) => {
                    sorted_products.push(...products.filter((product) => product.account === key));
                });
                return sorted_products;
            })
        );
    }


    // Update a product by ID
    async updateProduct(product: Product): Promise<Product> {
        try {
            const createdProduct = await this.dbHandler.updateProduct(product);
            // Update the local products array
            this._products = this._products.filter((p) => p.id !== createdProduct.id);
            this._products.push(createdProduct as Product);
            // this._products = this._products.sort((a, b) => b.price - a.price);
            this._products$.next(this._products);
            return createdProduct;
        } catch (errors) {
            if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
                if ((errors[0] as any).errorType === 'Unauthorized') {
                    this.toastService.showErrorToast('Gestion des produits', 'Vous n\'êtes pas autorisé à modifier un produit à la vente');
                    return Promise.reject('Update not authorized');
                }
            }

            this.toastService.showErrorToast('Gestion des cartes', 'Une erreur est survenue lors de la modifier d\'un produit à la vente');
            return Promise.reject('Error updating product');
        }
    }

    // Delete a product by ID
    deleteProduct(product: Product): Promise<boolean> {
        try {
            let done = this.dbHandler.deleteProduct(product.id);
            this._products = this._products.filter((p) => p.id !== product.id);
            this._products = this._products.sort((a, b) => b.price - a.price);
            this._products$.next(this._products);
            return Promise.resolve(true);
        } catch (errors) {
            if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
                if ((errors[0] as any).errorType === 'Unauthorized') {
                    this.toastService.showErrorToast('Gestion des produits', 'Vous n\'êtes pas autorisé à supprimer un produit à la vente');
                    return Promise.reject('Delete not authorized');
                }
            }

            this.toastService.showErrorToast('Gestion des cartes', 'Une erreur est survenue lors de la suppression d\'un produit à la vente');
            return Promise.reject('Error updating product');
        }
    }


    //utilities functions (once products are loaded)

    getProduct(product_id: string): Product {
        return this._products.find((product) => product.id === product_id) as Product;
    }

}