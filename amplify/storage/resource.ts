import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'bcstoDrive',
    access: (allow) => ({
        'portraits/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme', 'Administrateur','Contributeur','Editeur','Membre']).to(['read', 'write', 'delete']),
        ],
        'documents/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme', 'Administrateur','Editeur']).to(['read', 'write', 'delete']),
            allow.groups(['Contributeur', 'Membre']).to(['read']),
        ],

        'images/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme', 'Administrateur', 'Editeur', 'Contributeur']).to(['read', 'write', 'delete']),
            allow.groups(['Membre']).to(['read']),
        ],

        'albums/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme', 'Administrateur', 'Editeur', 'Contributeur']).to(['read', 'write', 'delete']),
            allow.groups(['Membre']).to(['read']),
        ],

        'thumbnails/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme', 'Administrateur', 'Editeur', 'Contributeur']).to(['read', 'write', 'delete']),
            allow.groups(['Membre']).to(['read']),
        ],

        'system/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme']).to(['read', 'write', 'delete']),
            allow.groups(['Administrateur', 'Contributeur', 'Editeur', 'Membre']).to(['read']),
        ],
        'accounting/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme', 'Administrateur']).to(['read', 'write', 'delete']),
            allow.groups(['Contributeur','Editeur', 'Membre']).to(['read']),
        ],
        'any/*': [
            allow.guest.to(['read','write', 'delete']),
            allow.groups(['Systeme', 'Administrateur','Contributeur','Editeur','Membre']).to(['read', 'write', 'delete']),
        ],
    })
})
