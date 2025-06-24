import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, Routes } from '@angular/router';
import { ProductsComponent } from './products/products.component';
import { ReactiveFormsModule, Form, FormsModule } from '@angular/forms';

const routes: Routes = [
  { path: 'products', component: ProductsComponent },
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),

  ],
  declarations: [ProductsComponent],

  providers: [SalesModule],

  exports: [ProductsComponent]
})
export class SalesModule { }
