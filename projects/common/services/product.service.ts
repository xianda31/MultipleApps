import { Injectable } from '@angular/core';
import { Product } from '../../admin-dashboard/src/app/sales/products/product.interface';
import { from, map, Observable, of, tap } from 'rxjs';
import { data, Schema } from '../../../amplify/data/resource';
import { generateClient } from 'aws-amplify/api';


@Injectable()
export class ProductService {
    private products!: Product[];

    // Create a new product
    createProduct(product: Product): Observable<Product> {
        let { id, ...productCreateInput } = product;
        const client = generateClient<Schema>();
        return from(client.models.Product.create(productCreateInput)).pipe(
            map((response) => response.data as unknown as Product),
            tap((product) => this.products.push(product))
        );
    }

    // Retrieve all products
    getAllProducts(): Observable<Product[]> {

        const listProducts = (): Observable<Product[]> => {
            const client = generateClient<Schema>();
            return from(client.models.Product.list({ selectionSet: ["id", "name", "description", "price", "category", "active"] }))
                .pipe(
                    map((response) => response.data as unknown as Product[]),
                    tap((products) => this.products = products)
                );
        }

        return this.products ? of(this.products) : listProducts();


    }

    getProductById(id: string): Product | undefined {
        return this.products.find(product => product.id === id);
    }

    // Update a product by ID
    updateProduct(id: string, updatedProduct: Product): Product | undefined {
        const productIndex = this.products.findIndex(product => product.id === id);
        if (productIndex === -1) {
            return undefined;
        }
        this.products[productIndex] = updatedProduct;
        return updatedProduct;
    }

    // Delete a product by ID
    deleteProduct(id: string): boolean {
        const productIndex = this.products.findIndex(product => product.id === id);
        if (productIndex === -1) {
            return false;
        }
        this.products.splice(productIndex, 1);
        return true;
    }
}