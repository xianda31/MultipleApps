import { PagesComponent } from "../admin-dashboard/src/app/site-content/pages/pages.component";

export interface Menu {
    id: string;
    label: string;
    // summary?: string;
    rank: number;
    pages: Page[];

}

export interface Page {
    id: string;
    menuId: string;
    link: string;
    template: PageTemplateEnum;
    rank: number;
    member_only: boolean;
    // title: string;
    articles?: Article[];
}

export interface Article {
    id: string;
    title: string;
    template: ArticleTemplateEnum;
    content: string;
    featured: boolean;
    rank: number;
    pageId?: string;
    image?: string;
}

export enum ArticleTemplateEnum {
    default = 'default',
    header = 'header',
    letter = 'letter',
    IDcard = 'IDcard-side',
    photo = 'photo',
    // imageTemplate = 'image',
    // videoTemplate = 'video',
    // audioTemplate = 'audio',
    // galleryTemplate = 'gallery',
    // tabsTemplate = 'tabs',
    // listTemplate = 'list',
    // tableTemplate = 'table',
    // formTemplate = 'form',
    // chartTemplate = 'chart',
    // calendarTemplate = 'calendar',
    // faqTemplate = 'faq',
    // blogTemplate = 'blog',
    // newsTemplate = 'news',
    // productTemplate = 'product',
    // socialTemplate = 'social',
}

export enum PageTemplateEnum {
    default = 'default',
    sidebar = 'sidebar',
    par4 = 'par4',
    album = 'album'
}