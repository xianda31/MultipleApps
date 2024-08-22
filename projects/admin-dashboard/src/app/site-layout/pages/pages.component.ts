import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { generateClient } from 'aws-amplify/api';
import { Schema } from '../../../../../../amplify/data/resource';
import { Menu, Page } from '../../../../../common/menu.interface';

@Component({
  selector: 'app-pages',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './pages.component.html',
  styleUrl: './pages.component.scss'
})
export class PagesComponent implements OnInit, OnChanges {

  @Input() menus!: Menu[];
  @Output() pageChange: EventEmitter<Page> = new EventEmitter<Page>();
  pages: Page[] = [];
  creation: boolean = true;

  pageGroup: FormGroup = new FormGroup({
    id: new FormControl(''),
    menuId: new FormControl(''),
    link: new FormControl(''),
    layout: new FormControl(''),
    title: new FormControl(''),
  });

  constructor() { }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('menus change', this.menus);
  }


  ngOnInit(): void {
    this.listPages();
  }

  getMenu(id: string): Menu | undefined {
    return this.menus.find((m) => m.id === id);
  }
  get menuId() { return this.pageGroup.get('menuId')?.value; }

  async listPages() {

    const client = generateClient<Schema>();
    const { data: data, errors } = await client.models.Page.list({ selectionSet: ["id", "menuId", "link", "layout", "title"] });
    if (errors) { console.error(errors); return; }
    console.log('data', data);
    let pages: Page[] = data as unknown as Page[];
    this.pages = pages;
    console.log('listPages', this.pages);
    // this.pages = this.pages.sort((a, b) => a.id.localeCompare(b.id));
  }



  editPage(page: Page) {
    console.log('editPage', page);
    // this.pageGroup.patchValue({ page });
    this.pageGroup.patchValue({ id: page.id, menuId: page.menuId, link: page.link, layout: page.layout, title: page.title });
    this.creation = false;
  }

  savePage() {
    if (this.pageGroup.invalid) {
      return;
    }
    if (this.creation) {
      this.createPage(this.pageGroup.value);
    } else {
      this.updatePage(this.pageGroup.value);
    }
    console.log('emit', this.pageGroup.value);
    this.pageChange.emit(this.pageGroup.value);
    this.clear();
  }

  clear() {
    this.pageGroup.reset();
  }

  async deletePage(pageId: string): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {

      const client = generateClient<Schema>();
      const { data: deletedPage, errors } = await client.models.Page.delete({ id: pageId });
      if (errors) { console.error(errors); reject(errors); }

      console.log('deletedPage', deletedPage);
      if (deletedPage) {
        this.pages = this.pages.filter((m) => m.id !== pageId);
        resolve(deletedPage);
      } else {
        reject('Page not deleted');
      }
    });
  }

  async updatePage(page: Page): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      const client = generateClient<Schema>();
      console.log('updating Page', page);
      const { data: updatedPage, errors } = await client.models.Page.update(page);
      if (errors) {
        console.error('error', errors);
        reject(errors);
        return;
      }

      console.log('updatedPage', updatedPage);
      if (updatedPage) {
        this.pages = this.pages.map((m: Page) => m.id === updatedPage.id ? updatedPage : m) as Page[];
        resolve(updatedPage);
      } else {
        reject('Page not updated');
      }
    });
  }

  async createPage(page: Page): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
      let { id, ...pageCreateInput } = page;
      const client = generateClient<Schema>();
      const { data: data, errors } = await client.models.Page.create(pageCreateInput);
      if (errors) { console.error(errors); reject(errors); }
      let newPage: Page = { id: data?.id!, ...pageCreateInput };;
      console.log('newPage', newPage);
      if (newPage) {
        this.pages.push(newPage as Page);
        resolve(newPage);
      } else {
        reject('Page not created');
      }
    });
  }

}

