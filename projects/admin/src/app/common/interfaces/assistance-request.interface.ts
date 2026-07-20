export interface AssistanceRequest {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    type: string;
    texte: string;
    status: string;
    createdAt: string;
    ttl?: number;
}

export interface AssistanceRequestInput {
    nom: string;
    prenom: string;
    email: string;
    type: string;
    texte: string;
    status: string;
    ttl?: number;
}

const REQUEST_TYPES = [
    'Problème à la connexion',
    'Demande d’information',
    'Support technique',
    'Autre'
];

export { REQUEST_TYPES };

export enum REQUEST_STATUS {
    NEW = 'nouveau',
    IN_PROGRESS = 'en cours',
    RESOLVED = 'résolu'
}