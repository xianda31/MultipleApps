import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from './common/shared.module';
import { RouterModule, Routes, ROUTES } from '@angular/router';




// Fonction d'accès aux routes dynamiques
export function navitemRoutesFactory(dynamicRoutesService: DynamicRoutesService): Routes {
  return dynamicRoutesService.getRoutes();
}

import { DynamicRoutesService } from './common/services/dynamic-routes.service';

@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule.forChild([])
  ],
  exports: [
    RouterModule
  ],
  providers:[
    {provide: ROUTES,
      useFactory: navitemRoutesFactory,
      deps: [DynamicRoutesService],
      multi: true
    },
  ]
})
export class FrontModule { }
