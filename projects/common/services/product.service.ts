import { Injectable } from '@angular/core';
import { Product } from '../../admin-dashboard/src/app/sales/products/product.interface';
import { BehaviorSubject, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { data, Schema } from '../../../amplify/data/resource';
import { generateClient } from 'aws-amplify/api';
import { SystemDataService } from './system-data.service';


@Injectable({
    providedIn: 'root'
})
export class ProductService {
    private _products!: Product[];
    products_keys: string[] = [];

    constructor(
        private systemDataService: SystemDataService
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
    createProduct(product: Product): Promise<Product> {
        let promise: Promise<Product> = new Promise<Product>((resolve, reject) => {
            let { id, ...productCreateInput } = product;
            const client = generateClient<Schema>();
            client.models.Product.create(productCreateInput)
                .then((response) => {
                    let _product = response.data as unknown as Product;
                    // this.products.push(_product);
                    // this.products = [...this.products, _product];
                    this._products.push(_product);
                    resolve(_product);
                })
                .catch((error) => {
                    console.error("error : ", error);
                    reject(error);
                });
        });
        return promise;
    }

    // Retrieve all products
    listProducts(): Observable<Product[]> {
        const _listProducts = (): Observable<Product[]> => {
            const client = generateClient<Schema>();
            return from(client.models.Product.list())
                .pipe(
                    map((response) => response.data as unknown as Product[]),
                    map((products) => products.filter((product) => product.active)),
                    map((products) => products.sort((a, b) => b.price - a.price)),
                    switchMap((products) => this.sorted_products(products)),
                    tap((products) => this._products = products),
                );
        }
        return this._products ? of(this._products) : _listProducts();
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
    updateProduct(product: Product): Promise<Product> {
        let promise: Promise<Product> = new Promise<Product>((resolve, reject) => {
            const client = generateClient<Schema>();
            client.models.Product.update(product)
                .then((response) => {
                    const index = this._products.findIndex((p) => p.id === product.id);
                    this._products[index] = product;
                    let _product = response.data as unknown as Product;
                    resolve(_product);
                })
                .catch((error) => {
                    console.error("error : ", error);
                    reject(error);
                });
        });
        return promise;
    }

    // Delete a product by ID
    deleteProduct(product: Product): Promise<Product> {
        let promise: Promise<Product> = new Promise<Product>((resolve, reject) => {
            const client = generateClient<Schema>();
            client.models.Product.delete({ id: product.id })
                .then((response) => {
                    const index = this._products.findIndex((p) => p.id === product.id);
                    this._products.splice(index, 1);
                    let _product = response.data as unknown as Product;
                    resolve(_product);
                })
                .catch((error) => {
                    console.error("error : ", error);
                    reject(error);
                });
        });
        return promise;
    }


    //utilities functions (once products are loaded)

    getProduct(product_id: string): Product {
        return this._products.find((product) => product.id === product_id) as Product;
    }

}