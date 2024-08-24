import { Component } from '@angular/core';
import { MenusComponent } from "../menus/menus.component";
import { PagesComponent } from "../pages/pages.component";

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [MenusComponent, PagesComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {

}
