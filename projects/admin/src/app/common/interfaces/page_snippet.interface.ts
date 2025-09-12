import { Observable } from "rxjs";
import { Schema } from "../../../../../../amplify/data/resource";

export interface Snippet {
    id: string;
    title: string;
    subtitle: string;
    content: string;
    public: boolean;
    image: string;
    file: string;
    folder:string
    image_url?: Observable<string>;
    pageId?: string;
    createdAt?: string;
    updatedAt?: string;
}

export type Snippet_input = Omit<Schema['Snippet']['type'], 'id' | 'createdAt' | 'updatedAt'>;

export interface Page {
    id: string;
    title: string;
    template: PAGE_TEMPLATES;
    snippet_ids: string[];
    snippets?: Snippet[];
    createdAt?: string;
    updatedAt?: string;
}

export type Page_input = Omit<Schema['Page']['type'], 'id' | 'createdAt' | 'updatedAt'>;


export enum MENU_TITLES {
    NEWS = 'news',
    ACTEURS = 'acteurs',
    BUREAU = 'bureau',
    DOCUMENTS = 'documents',
    COURS = 'cours',
    ALBUMS = 'albums',
    LEGALS = 'mentions légales',
    POUBELLE = 'poubelle',
    // CONTACTS = 'contacts',
}

export enum PAGE_TEMPLATES {
    JOURNAL = 'journal',
    TROMBINOSCOPE = 'trombinoscope',
    LOADABLE = 'téléchargement',
    CARDS_top = 'fiches img haut',
    CARDS_bottom = 'fiches img bas',
    ALBUMS = 'albums',
    X_DEFAULT = 'journal',
}

