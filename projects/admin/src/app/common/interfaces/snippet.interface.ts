import { Schema } from "../../../../../../amplify/data/resource";

export interface Snippet {
    id: string;
    title: string;
    subtitle: string;
    content: string;
    template: string;
    featured: boolean;
    rank: number;
    image: string;
    file: string;
    createdAt?: string;
    updatedAt?: string;
}

export type Snippet_input = Omit<Schema['Snippet']['type'], 'id' | 'createdAt' | 'updatedAt'> ;


export enum SNIPPET_TEMPLATES {
    NEWS = 'news',
    BUREAU = 'bureau',
    CONTACTS = 'contacts',
    FONCTIONNEMENT = 'fonctionnement',
    ENSEIGNANTS = 'enseignants',
    DOCUMENTS = 'documents',
}