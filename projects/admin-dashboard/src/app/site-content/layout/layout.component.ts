import { Component } from '@angular/core';
import { MenusComponent } from '../menus/menus.component';
import { PagesComponent } from '../pages/pages.component';
import { SiteLayoutService } from '../../../../../common/services/site-layout.service';
import { Menu, Page, PageTemplateEnum } from '../../../../../common/menu.interface';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop'; // Import DragDropModule
import { take } from 'rxjs';
import { PageComponent } from '../page/page.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, MenusComponent, PagesComponent, PageComponent], // Add DragDropModule to the imports array
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  menus: Menu[] = [];
  selectedPage: Page | null = null;
  new_menu_label: string = '';

  constructor(
    private siteLayoutService: SiteLayoutService) {

    this.siteLayoutService.menus$
      .subscribe((menus) => {
        this.menus = menus;
        this.menus = this.menus.map((menu) => {
          menu.pages = menu.pages.sort((a, b) => a.rank - b.rank);
          return menu;
        });
      });
  }
  onDropPage(menu: Menu, event: CdkDragDrop<string[]>) {

    if (event.previousContainer === event.container) {
      this.menus = this.menus.map((m) => {
        if (m.id === menu.id) {
          moveItemInArray(m.pages!, event.previousIndex, event.currentIndex);
          let rank = 0;
          m.pages?.forEach((page) => {
            page.rank = rank;
            rank++;
            this.siteLayoutService.updatePage(page);
          });
        }
        return m;
      });
    } else {
      //
    }
  }

  onDropMenu(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.menus, event.previousIndex, event.currentIndex);
    let rank = 0;
    this.menus.forEach(async (menu) => {
      menu.rank = rank;
      rank++;
      this.siteLayoutService.updateMenu(menu);
    });
  }

  onClick(page: Page) {
    this.selectedPage = page;
  }

  onCreateMenu() {
    const new_menu: Menu = { id: '', label: this.new_menu_label, rank: 0, pages: [] };
    this.siteLayoutService.createMenu(new_menu)
      .then(() => { this.new_menu_label = ''; })
      .catch((error) => {
        console.error('menu creation error', error);
      }
      );
  }

  onDeleteMenu(menu: Menu) {
    this.siteLayoutService.deleteAllPages(menu.id);
    this.siteLayoutService.deleteMenu(menu.id);
  }

  onAddPage(menu: Menu) {
    let page: Page = { id: '', menuId: menu.id, rank: 0, link: 'new page', template: PageTemplateEnum.default, member_only: false };

    this.siteLayoutService.createPage(page);
  }
}
