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
    template: TemplateEnum;
    icon?: string;
    image?: string;
    tags?: string[];
    pages?: Page[];
}

export enum TemplateEnum {
    defaultEnum = 'default',
    // imageEnum = 'image',
    // videoEnum = 'video',
    // audioEnum = 'audio',
    galleryEnum = 'gallery',
    tabsEnum = 'tabs',
    listEnum = 'list',
    tableEnum = 'table',
    formEnum = 'form',
    chartEnum = 'chart',
    calendarEnum = 'calendar',
    faqEnum = 'faq',
    blogEnum = 'blog',
    newsEnum = 'news',
    eventEnum = 'event',
    productEnum = 'product',
    socialEnum = 'social',
}