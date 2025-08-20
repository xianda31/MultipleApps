import { Observable } from "rxjs";
import { Schema } from "../../../../../../amplify/data/resource";

export interface Snippet {
    id: string;
    title: string;
    subtitle: string;
    content: string;
    template: string;
    public: boolean;
    rank: string;
    image: string;
    file: string;
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

// export enum SNIPPET_TEMPLATES {
//     NEWS = 'news',
//     BUREAU = 'bureau',
//     CONTACTS = 'contacts',
//     FONCTIONNEMENT = 'fonctionnement',
//     ENSEIGNANTS = 'enseignants',
//     DOCUMENTS = 'documents',
//     // ACTEURS = 'acteurs',
// }

export enum MENU_TITLES {
    NEWS = 'news',
    BUREAU = 'bureau',
    CONTACTS = 'contacts',
    FONCTIONNEMENT = 'fonctionnement',
    ENSEIGNANTS = 'enseignants',
    DOCUMENTS = 'documents',
    ACTEURS = 'acteurs',
}

export enum PAGE_TEMPLATES {
    JOURNAL = 'journal',
    FACEBOOK = 'facebook',
    LOADABLE = 'téléchargement',
    X_DEFAULT = 'journal',
    NEWS = 'news',
}

