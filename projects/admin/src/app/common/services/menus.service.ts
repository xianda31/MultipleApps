import { Injectable } from '@angular/core';
import { Menu } from '../interfaces/menus.interface';

@Injectable({
  providedIn: 'root'
})
export class MenusService {

  private configurableMenus: Menu[] = [
    {
      title: 'Le Club',
      routerLink: '',
      icon: 'bi-people',
      children: [
        {
          title: 'Les acteurs',
          routerLink: 'club/acteurs',
        },
        {
          title: 'Documents',
          routerLink: 'club/documents',
        },
        {
          title: 'Le bureau',
          routerLink: 'club/bureau',
        },
      ],
    },
    {
      title: 'L\'école de Bridge',
      routerLink: '',
      icon: 'bi-book',
      children: [
        {
          title: 'Cours',
          routerLink: 'école/cours',
        },
      ],
    },
  ];
  constructor() { }

  get_menus(): Menu[] {
    return this.configurableMenus;
  }
}
