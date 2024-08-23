import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Menu } from '../../../../../common/menu.interface';
import { PagesComponent } from "../pages/pages.component";
import { SiteLayoutService } from '../../../../../common/site-layout/site-layout.service';

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PagesComponent],
  templateUrl: './menus.component.html',
  styleUrl: './menus.component.scss'
})
export class MenusComponent {
  menus: Menu[] = [];
  creation: boolean = true;

  menuGroup: FormGroup = new FormGroup({
    id: new FormControl({ value: '', disabled: true }),
    label: new FormControl('', Validators.required),
    summary: new FormControl('', Validators.required),
    rank: new FormControl(0),
  });

  constructor(
    private siteLayoutService: SiteLayoutService) {
    this.siteLayoutService.menus$.subscribe((menus) => {
      this.menus = menus;
      // console.log('menus', menus);
    });
  }

  onEdit(menu: Menu) {
    this.menuGroup.patchValue({ id: menu.id, label: menu.label, summary: menu.summary, rank: menu.rank });
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
    this.creation ? this.createMenu(menu) : this.updateMenu(menu);
    this.onClear();
    this.creation = true;
  }

  updateMenu(menu: Menu): void {
    this.siteLayoutService.updateMenu(menu).then((updatedMenu) => {
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
