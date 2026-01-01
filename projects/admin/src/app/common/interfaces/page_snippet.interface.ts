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
    featured: boolean;
    image_url?: string;
    pageId?: string;
    createdAt?: string;
    updatedAt?: string;     // in ISO format
    publishedAt?: string;  // in YYYY-MM-DD format
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

export enum PAGE_TEMPLATES {
    SEQUENTIAL = 'séquentiel',
    PUBLICATION = 'publication',
    A_LA_UNE = 'à la une',
    TROMBINOSCOPE = 'trombinoscope',
    LOADABLE = 'téléchargement',
    CARDS_top = 'fiches img haut',
    CARDS_top_left = 'fiches img haut-gauche',
    CARDS_bottom = 'fiches img bas',
    ALBUMS = 'albums',
    // FLIPPER = 'flipper',
    // X_DEFAULT = 'journal',
}

export enum MENU_TITLES {
    NEWS = 'news',
    ACTEURS = 'acteurs',
    BUREAU = 'bureau',
    HISTOIRE = 'histoire',
    DOCUMENTS = 'documents',
    COURS = 'cours',
    ALBUMS = 'albums',
    LEGALS = 'mentions légales',
    CONTACTS = 'contacts',
    POUBELLE = 'poubelle',
    AUTRES_RDV = 'autres rendez-vous',
}
export const CLIPBOARD_TITLE = '__CLIPBOARD__'

export enum EXTRA_TITLES {
    HIGHLIGHTS = 'à la une',
}

// export enum ALIAS_TITLES {
//     HIGHLIGHTS = 'à la une',
// }
// export const ALIAS_REDIRECTIONS: { [key in ALIAS_TITLES]: {title: MENU_TITLES, template: PAGE_TEMPLATES} } = {
//     [ALIAS_TITLES.HIGHLIGHTS]: { title: MENU_TITLES.NEWS, template: PAGE_TEMPLATES.A_LA_UNE },  
// }


