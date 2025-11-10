import { Injectable } from '@angular/core';
import { Routes } from '@angular/router';
import { routes } from '../../front/front.routes';

@Injectable({ providedIn: 'root' })
export class DynamicRoutesService {
  private _routes: Routes = [] ;

  async fetchRoutes(): Promise<void> {
    // Replace with your async DB/API call
    // this._routes = await this.getRoutesFromService();
  }

  setRoutes(routes: Routes): void {
      this._routes = routes;
      console.log('DynamicRoutesService - Routes set:', this._routes);
    }

    getRoutes(): Routes {
      console.log('DynamicRoutesService - Getting routes:', this._routes);  
      return this._routes;
    }
}
