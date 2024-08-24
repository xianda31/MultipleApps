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
    pageId?: string;
    icon?: string;
    image?: string;
    tags?: string[];
    pages?: Page[];
}

export enum TemplateEnum {
    defaultTemplate = 'default',
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
    eventTemplate = 'event',
    productTemplate = 'product',
    socialTemplate = 'social',
}