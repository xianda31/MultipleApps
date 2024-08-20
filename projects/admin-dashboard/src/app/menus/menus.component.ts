import { Component, OnInit } from '@angular/core';
import { Schema } from '../../../../../amplify/data/resource';
import { generateClient } from 'aws-amplify/api';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

type Menu = {
  id: string;
  label: string;
  has_submenu: boolean;
  endItem?:
  {
    link: string;
    pageId?: string | null;
  } | null;
  // rootmenu?: string;
  // submenus?: Menu[];
}


@Component({
  selector: 'app-menus',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './menus.component.html',
  styleUrl: './menus.component.scss'
})
export class MenusComponent implements OnInit {
  menus: Menu[] = [];
  creation: boolean = true;

  menuGroup: FormGroup = new FormGroup({
    id: new FormControl(''),
    label: new FormControl('', Validators.required),
    has_submenu: new FormControl(false),
    endItem: new FormGroup({
      link: new FormControl(''),
      pageId: new FormControl
    })
  });

  constructor() { }



  ngOnInit(): void {
    this.listMenus();

    let menu_child1: Menu = {
      id: 'id_child1',
      label: 'label_child1',
      has_submenu: false,
      endItem: {
        link: 'link_child1',
        pageId: 'pageId_child1'
      },
    };

    let menu0: Menu = {
      id: 'id_root0',
      label: 'label_root0',
      has_submenu: true,
      // submenus: []
    };

    // this.createMenu(menu_child1);
  }

  // onSubmit() {
  //   console.log(this.menuGroup.value);
  //   this.createMenu(this.menuGroup.value);
  // }

  async listMenus() {

    const client = generateClient<Schema>();
    const { data: menus, errors } = await client.models.Menu.list();
    if (errors) { console.error(errors); return; }
    console.log('listMenus', menus);
    this.menus = menus as Menu[];
  }



  editMenu(menu: Menu) {
    console.log('editMenu', menu);
    // this.menuGroup.patchValue({ menu });
    this.menuGroup.patchValue({ id: menu.id, label: menu.label, has_submenu: menu.has_submenu, endItem: menu.endItem });
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
        this.menus = this.menus.map((m) => m.id === updatedMenu.id ? updatedMenu : m);
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
      const { data: newMenu, errors } = await client.models.Menu.create(menuCreateInput);
      if (errors) { console.error(errors); reject(errors); }

      console.log('newMenu', newMenu);
      if (newMenu) {
        resolve(newMenu);
      } else {
        reject('Menu not created');
      }
    });
  }
}
