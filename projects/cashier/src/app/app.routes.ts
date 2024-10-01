import { Routes } from '@angular/router';
import { SalesComponent } from './sales//sales/sales.component'; // Adjust the import path as necessary
import { FeesComponent } from './fees/fees/fees.component';
import { BooksComponent } from './sales/books/books.component';
import { TestComponent } from './test/test.component';

export const routes: Routes = [
    { path: 'sales', component: SalesComponent },
    { path: 'books', component: BooksComponent },
    { path: 'fees', component: FeesComponent },
    // { path: 'test', component: TestComponent },
    // { path: '', redirectTo: 'sales', pathMatch: 'full' },
];
