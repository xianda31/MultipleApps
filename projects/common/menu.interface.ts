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
    template: string;
    // title: string;
    articles?: Article[];
}

export interface Article {
    id: string;
    title: string;
    template: TemplateEnum;
    content: string;
    featured: boolean;
    rank: number;
    image?: string;
    pageId?: string;
    pages?: Page[];
}

export enum TemplateEnum {
    defaultTemplate = 'default',
    eventTemplate = 'event',
    // imageTemplate = 'image',
    // videoTemplate = 'video',
    // audioTemplate = 'audio',
    galleryTemplate = 'gallery',
    tabsTemplate = 'tabs',
    listTemplate = 'list',
    tableTemplate = 'table',
    formTemplate = 'form',
    chartTemplate = 'chart',
    calendarTemplate = 'calendar',
    faqTemplate = 'faq',
    blogTemplate = 'blog',
    newsTemplate = 'news',
    productTemplate = 'product',
    socialTemplate = 'social',
}