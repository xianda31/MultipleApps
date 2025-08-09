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
    createdAt?: string;
    updatedAt?: string;
}

export type Snippet_input = Omit<Schema['Snippet']['type'], 'id' | 'createdAt' | 'updatedAt'> ;
