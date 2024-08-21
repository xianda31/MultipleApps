import { Component, OnInit } from '@angular/core';
import { Schema } from '../../../../../../amplify/data/resource';
import { generateClient } from 'aws-amplify/api';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Menu } from '../../../../../common/menu.interface';
import { PagesComponent } from "../pages/pages.component";
import { SelectionSet } from 'aws-amplify/data';

@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, PagesComponent],
  templateUrl: './menus.component.html',
  styleUrl: './menus.component.scss'
})
export class MenusComponent implements OnInit {
  menus: Menu[] = [];
  creation: boolean = true;

  menuGroup: FormGroup = new FormGroup({
    id: new FormControl(''),
    label: new FormControl('', Validators.required),
    summary: new FormControl(''),
  });

  constructor() { }



  ngOnInit(): void {
    this.listMenus();


  }

  showMenu(menu: Menu) {
    this.getMenu(menu.id).then((menu) => {
      console.log('showMenu', menu);
    });
  }


  async listMenus() {

    const client = generateClient<Schema>();
    const { data: menus, errors } = await client.models.Menu.list({ selectionSet: ["id", "label", "summary", "pages.*"] });
    if (errors) { console.error(errors); return; }

    console.log('listMenus', menus);
    this.menus = menus as unknown as Menu[];
  }

  async getMenu(id: string): Promise<Menu | null | undefined> {
    return new Promise<Menu | null | undefined>(async (resolve, reject) => {

      const client = generateClient<Schema>();
      const { data: menu, errors } = await client.models.Menu.get({ id }, { selectionSet: ["id", "pages.*"] });
      if (errors) {
        console.error(errors);
        reject(errors);
        return;
      }
      console.log('getMenu', menu);
      resolve(menu as unknown as Menu);
      return
    });
  }


  editMenu(menu: Menu) {
    console.log('editMenu', menu);
    // this.menuGroup.patchValue({ menu });
    this.menuGroup.patchValue({ id: menu.id, label: menu.label, summary: menu.summary });
    this.creation = false;
  }

  saveMenu() {
    if (this.menuGroup.invalid) {
      return;
    }
    if (this.creation) {
      this.createMenu(this.menuGroup.value);
    } else {
      this.updateMenu(this.menuGroup.value);
    }
    this.clear();
  }

  clear() {
    this.menuGroup.reset();
  }

  async deleteMenu(menuId: string): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {

      const client = generateClient<Schema>();
      const { data: deletedMenu, errors } = await client.models.Menu.delete({ id: menuId });
      if (errors) { console.error(errors); reject(errors); }

      console.log('deletedMenu', deletedMenu);
      if (deletedMenu) {
        this.menus = this.menus.filter((m) => m.id !== menuId);
        resolve(deletedMenu);
      } else {
        reject('Menu not deleted');
      }
    });
  }

  async updateMenu(menu: Menu): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      const { data: updatedMenu, errors } = await client.models.Menu.update(menu);
      if (errors) { console.error(errors); reject(errors); }

      console.log('updatedMenu', updatedMenu);
      if (updatedMenu) {
        this.menus = this.menus.map((m: Menu) => m.id === updatedMenu.id ? updatedMenu : m) as Menu[];
        resolve(updatedMenu);
      } else {
        reject('Menu not updated');
      }
    });
  }

  async createMenu(menu: Menu): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      let { id, ...menuCreateInput } = menu;
      const client = generateClient<Schema>();
      const { data: data, errors } = await client.models.Menu.create(menuCreateInput);
      if (errors) { console.error(errors); reject(errors); }
      let newMenu: Menu = { id: data?.id!, ...menuCreateInput };;
      console.log('newMenu', newMenu);
      if (newMenu) {
        this.menus.push(newMenu as Menu);
        resolve(newMenu);
      } else {
        reject('Menu not created');
      }
    });
  }
}
