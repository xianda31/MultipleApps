import { Routes } from '@angular/router';
import { PageNotFoundComponent } from '../common/page-not-found/page-not-found.component';
import { FrontComponent } from './front/front/front.component';
import { CheckoutSuccessComponent } from './shop/checkout-success.component';
import { CheckoutCancelComponent } from './shop/checkout-cancel.component';


// Minimal, safe front routes used at bootstrap. Dynamic/nav-driven routes
// (home, tournaments listing, purchases, etc.) are injected at runtime
// by the navitem/dynamic routes service to avoid early token-dependent calls.

export const minimal_routes: Routes = [
  {
    path: '',
    component: FrontComponent,
    children: [
      // Routes with dynamic parameters (not configurable via editor => refer to plugin meta for these)

      // Stripe E-commerce routes
      { path: 'checkout-success', component: CheckoutSuccessComponent },
      { path: 'checkout-cancel', component: CheckoutCancelComponent },

      // System routes (redirects and fallbacks)
      { path: 'back_office', redirectTo: '/back', pathMatch: 'full' },
      { path: '404', component: PageNotFoundComponent },
      { path: '**', component: PageNotFoundComponent }, // catch-all route to handle custom routing
    ]
  },
];