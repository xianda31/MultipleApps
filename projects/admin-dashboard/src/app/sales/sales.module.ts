import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, Routes } from '@angular/router';
import { ProductsComponent } from './products/products.component';

const routes: Routes = [
  { path: 'price_list', component: ProductsComponent },
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
    // RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class SalesModule { }
