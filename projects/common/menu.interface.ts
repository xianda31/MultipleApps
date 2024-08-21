export interface Menu {
    id: string;
    label: string;
    summary?: string;
    pages?: Page[];

}

export interface Page {
    id: string;
    menuId: string;
    link: string;
    layout: string;
    title: string;
    articles?: Article[];
}

export interface Article {
    id: string;
    title: string;
    content: string;
    tags: string[];
    pageId: string;
}