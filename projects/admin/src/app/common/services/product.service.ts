import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom, map, Observable, of, switchMap, tap } from 'rxjs';
import { SystemDataService } from './system-data.service';
import { ToastService } from '../services/toast.service';
import { DBhandler } from './graphQL.service';
import { Product } from '../../back/products/product.interface';


@Injectable({
    providedIn: 'root'
})
export class  ProductService {
    private _products!: Product[];
    private _products$ = new BehaviorSubject<Product[]>([]);
    products_keys: string[] = [];

    constructor(
        private systemDataService: SystemDataService,
        private toastService: ToastService,
        private dbHandler: DBhandler
    ) { }

    private normalizeProduct(product: any, previousProduct?: Product): Product {
        return {
            ...product,
            productCode: product?.productCcode ?? product?.productCode ?? previousProduct?.productCode ?? null,
        } as Product;
    }

    private sortProducts(products: Product[]): Product[] {
        return [...products].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fr'));
    }

    private async refreshProducts(): Promise<void> {
        const products = await firstValueFrom(
            this.dbHandler.listProducts().pipe(
                map((items) => items.map((item) => this.normalizeProduct(item, this._products?.find((existing) => existing.id === item.id)))),
                map((items) => items.filter((item) => item.active)),
                switchMap((items) => this.sorted_products(items))
            )
        );

        this._products = this.sortProducts(products);
        this._products$.next(this._products);
    }


    // utilities functions


    products_by_accounts(products: Product[]): Map<string, Product[]> {
        const accounts = products.filter((product) => product.active).map((product) => product.account);
        const products_accounts = [...new Set(accounts)];

        // Build a Map of account -> sorted products (paired last)
        const accountMap = new Map<string, Product[]>();
        products_accounts.forEach((account) => {
            accountMap.set(
                account,
                products
                    .filter((product) => product.account === account)
                    .sort((a, b) => {
                        // Place .paired products last
                        if (a.paired && !b.paired) return 1;
                        if (!a.paired && b.paired) return -1;
                        return 0;
                    })
            );
        });

        return accountMap;
    }

    product_color_style(product: Product): string {
        // Generate a color based on product account with more variance
        const str = product.account || 'default';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Use HSL for moderate variance
        const hue = Math.abs(hash) % 360;
        const sat = 60 + (Math.abs(hash >> 8) % 15); // 60-75%
        let light = 55 + (Math.abs(hash >> 16) % 15); // 55-70%
        if (product.paired) {
            light = Math.max(30, light - 10); // make it darker for paired
        }
        return `background-color: hsl(${hue}, ${sat}%, ${light}%)`;
    }


    // CL(R)UD Product

    // Create a new product
    async createProduct(product: Product): Promise<Product> {
        const { id, ...product_input } = product;

        try {
            const createdProduct = this.normalizeProduct(await this.dbHandler.createProduct(product_input), product);
            this._products = this.sortProducts([...(this._products ?? []), createdProduct]);
            this._products$.next(this._products);
            await this.refreshProducts();
            return createdProduct;
        } catch (errors) {
            if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
                if ((errors[0] as any).errorType === 'Unauthorized') {
                    this.toastService.showError('Gestion des produits', 'Vous n\'êtes pas autorisé à créer un produit à la vente');
                    return Promise.reject('Unauthorized');
                }
            }

            this.toastService.showError('Gestion des cartes', 'Une erreur est survenue lors de la création d\'un produit à la vente');
            return Promise.reject('Error updating product');
        }
    }

    // Retrieve all products
    listProducts(): Observable<Product[]> {

        const _listProducts = this.dbHandler.listProducts().pipe(
            map((products) => products.map((product) => this.normalizeProduct(product, this._products?.find((existing) => existing.id === product.id)))),
            map((products) => products.filter((product) => product.active)),
            // map((products) => products.sort((a, b) => b.price - a.price)),
            switchMap((products) => this.sorted_products(products)),
            map((products) => {
                this._products = this.sortProducts(products);
                this._products$.next(this._products);
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
            const previousProduct = this._products.find((p) => p.id === product.id);
            const createdProduct = this.normalizeProduct(await this.dbHandler.updateProduct(product), previousProduct);
            const mergedProduct = this.normalizeProduct({
                ...previousProduct,
                ...product,
                ...createdProduct,
            }, previousProduct);
            this._products = this._products.filter((p) => p.id !== mergedProduct.id);
            this._products.push(mergedProduct);
            this._products = this.sortProducts(this._products);
            this._products$.next(this._products);
            await this.refreshProducts();
            return mergedProduct;
        } catch (errors) {
            if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
                if ((errors[0] as any).errorType === 'Unauthorized') {
                    this.toastService.showError('Gestion des produits', 'Vous n\'êtes pas autorisé à modifier un produit à la vente');
                    return Promise.reject('Update not authorized');
                }
            }

            this.toastService.showError('Gestion des produits', 'Une erreur est survenue lors de la modification d\'un produit à la vente');
            console.log(errors);
            return Promise.reject('Error updating product');
        }
    }

    // Delete a product by ID
    deleteProduct(product: Product): Promise<boolean> {
        try {
            return this.dbHandler.deleteProduct(product.id).then(async () => {
                await this.refreshProducts();
                return true;
            });
        } catch (errors) {
            if (Array.isArray(errors) && errors.length > 0 && typeof errors[0] === 'object' && errors[0] !== null && 'errorType' in errors[0]) {
                if ((errors[0] as any).errorType === 'Unauthorized') {
                    this.toastService.showError('Gestion des produits', 'Vous n\'êtes pas autorisé à supprimer un produit à la vente');
                    return Promise.reject('Delete not authorized');
                }
            }

            this.toastService.showError('Gestion des produits', 'Une erreur est survenue lors de la suppression d\'un produit à la vente');
            return Promise.reject('Error deleting product');
        }
    }


    //utilities functions (once products are loaded)

    getProduct(product_id: string): Product {
        return this._products.find((product) => product.id === product_id) as Product;
    }

}