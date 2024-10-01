import { Injectable } from '@angular/core';
import { Product } from '../../admin-dashboard/src/app/sales/products/product.interface';
import { BehaviorSubject, from, map, Observable, of, tap } from 'rxjs';
import { data, Schema } from '../../../amplify/data/resource';
import { generateClient } from 'aws-amplify/api';


@Injectable({
    providedIn: 'root'
})
export class ProductService {
    private _products!: Product[];

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
                    tap((products) => this._products = products)
                );
        }
        return this._products ? of(this._products) : _listProducts();
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

    getProduct(id: string): Product {
        return this._products.find((product) => product.id === id) as Product;
    }
}