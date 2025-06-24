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
}

export enum PageTemplateEnum {
    default = 'default',
    sidebar = 'sidebar',
    par4 = 'par4',
    album = 'album'
}

export enum RenderingModeEnum {
    Full = 'Full',
    Thumbnail = 'Thumbnail',
    Image_and_title = 'Image and title',

} 