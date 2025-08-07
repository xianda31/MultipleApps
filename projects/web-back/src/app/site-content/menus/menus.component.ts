import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Menu } from '../../../common/menu.interface';
import { PagesComponent } from "../pages/pages.component";
import { SiteLayoutService } from '../../../common/services/site-layout.service';

@Component({
    selector: 'app-menus',
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './menus.component.html',
    styleUrl: './menus.component.scss'
})
export class MenusComponent {
  menus: Menu[] = [];
  creation: boolean = true;

  menuGroup: FormGroup = new FormGroup({
    id: new FormControl({ value: '', disabled: true }),
    label: new FormControl('', Validators.required),
    // summary: new FormControl('', Validators.required),
    rank: new FormControl(0),
  });

  constructor(
    private siteLayoutService: SiteLayoutService) {
    this.siteLayoutService.getMenus().subscribe((menus) => {
      this.menus = menus;
    });
  }

  onEdit(menu: Menu) {
    this.menuGroup.patchValue({ id: menu.id, label: menu.label, rank: menu.rank });
    this.creation = false;
  }

  onDelete(menuId: string): void {
    this.siteLayoutService.deleteMenu(menuId).then((deletedMenu) => {
    }).catch((error) => {
      console.error('menu deletion error', error);
    });
  }

  onClear() {
    this.menuGroup.reset();
  }

  onSave() {
    if (this.menuGroup.invalid) return;
    let menu: Menu = this.menuGroup.getRawValue() as Menu;
    let pages = this.menus.find((m) => m.id === menu.id)?.pages;
    if (pages) {
      menu.pages = pages
    } else {
      console.log('oops ! no pages found for menu', menu.id);
    }
    this.creation ? this.createMenu(menu) : this.updateMenu(menu);
    this.onClear();
    this.creation = true;
  }

  updateMenu(menu: Menu): void {
    this.siteLayoutService.updateMenu(menu).then(() => {
      console.log('menusComponent : menu updated', menu);
    }
    ).catch((error) => {
      console.error('menu update error', error);
    });
  }

  createMenu(menu: Menu): void {
    this.siteLayoutService.createMenu(menu).then((newMenu) => {
    }).catch((error) => {
      console.error('menu creation error', error);
    });
  }
}
