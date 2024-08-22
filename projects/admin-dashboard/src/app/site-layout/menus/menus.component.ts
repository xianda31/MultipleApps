import { Component, OnInit } from '@angular/core';
import { Schema } from '../../../../../../amplify/data/resource';
import { generateClient } from 'aws-amplify/api';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Menu } from '../../../../../common/menu.interface';
import { PagesComponent } from "../pages/pages.component";
import { disable } from 'aws-amplify/analytics';

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
    id: new FormControl({ value: '', disabled: true }),
    label: new FormControl('', Validators.required),
    summary: new FormControl(''),
    rank: new FormControl(0, Validators.required),
  });

  constructor() { }



  ngOnInit(): void {
    // this.listMenus();

    this.queryMenus();
    this.subscribeToPagesEvents();

  }

  // showMenu(menu: Menu) {
  //   this.getMenu(menu.id).then((menu) => {
  //     console.log('showMenu', menu);
  //   });
  // }

  pageChange() {
    console.log('pageChange');
    // this.listMenus();
  }

  subscribeToPagesEvents() {
    const client = generateClient<Schema>();
    client.models.Page.onCreate()
      .subscribe({
        next: (data) => {
          console.log('page onCreate event : ', data);
          this.listMenus();
        },
        error: (error) => {
          console.error('error', error);
        }
      });
    client.models.Page.onUpdate()
      .subscribe({
        next: (data) => {
          console.log('page onUpdate event : ', data);
          this.listMenus();

        },
        error: (error) => {
          console.error('error', error);
        }
      });
  }
  queryMenus() {
    const client = generateClient<Schema>();
    client.models.Menu.observeQuery({ selectionSet: ["id", "label", "summary", "rank", "pages.*"] })
      .subscribe({
        next: (data) => {
          console.log('menus', data.items);
          this.menus = data.items as Menu[];
        },
        error: (error) => {
          console.error('error', error);
        }
      });
  }

  async listMenus() {

    const client = generateClient<Schema>();
    const { data: menus, errors } = await client.models.Menu.list({ selectionSet: ["id", "label", "summary", "rank", "pages.*"] });
    if (errors) { console.error(errors); return; }

    this.menus = menus as unknown as Menu[];
    this.menus = this.menus.sort((a, b) => a.rank - b.rank);
    console.log('listMenus', this.menus);
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
    this.menuGroup.patchValue({ id: menu.id, label: menu.label, summary: menu.summary, rank: menu.rank });
    this.creation = false;
  }

  saveMenu() {
    if (this.menuGroup.invalid) {
      return;
    }
    let menu: Menu = this.menuGroup.getRawValue() as Menu;
    if (this.creation) {
      this.createMenu(menu);
    } else {
      this.updateMenu(menu);
    }
    this.clear();
    this.creation = true;
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
    console.log('updating Menu...', menu);
    return new Promise<any>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      // let AWSmenu = { id: menu.id, label: menu.label, summary: menu.summary, rank: menu.rank };
      const { data: data, errors } = await client.models.Menu.update(menu);
      if (errors) { console.error(errors); reject(errors); }
      let updatedMenu: Menu = { ...menu };
      console.log('updatedMenu', updatedMenu);
      if (updatedMenu) {
        this.menus = this.menus
          .map((m: Menu) => m.id === updatedMenu.id ? updatedMenu : m)
          .sort((a, b) => a.rank - b.rank);
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
