import { PagesComponent } from "../admin-dashboard/src/app/site-content/pages/pages.component";

export interface Menu {
    id: string;
    label: string;
    summary?: string;
    rank: number;
    pages?: Page[];

}

export interface Page {
    id: string;
    menuId: string;
    link: string;
    summary: string;
    title: string;
    articles?: Article[];
}

export interface Article {
    id: string;
    title: string;
    content: string;
    tags?: string[];
    pages?: Page[];
}