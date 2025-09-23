import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'bcstoDrive',
    access: (allow) => ({
        'portraits/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme', 'Administrateur','Contributeur', 'Membre']).to(['read', 'write', 'delete']),
        ],
        'documents/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme', 'Administrateur']).to(['read', 'write', 'delete']),
            allow.groups(['Contributeur', 'Membre']).to(['read']),
        ],

        'images/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme', 'Administrateur', 'Contributeur']).to(['read', 'write', 'delete']),
            allow.groups(['Membre']).to(['read']),
        ],

        'albums/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme', 'Administrateur', 'Contributeur']).to(['read', 'write', 'delete']),
            allow.groups(['Membre']).to(['read']),
        ],

        'thumbnails/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme', 'Administrateur', 'Contributeur']).to(['read', 'write', 'delete']),
            allow.groups(['Membre']).to(['read']),
        ],

        'system/*': [
            allow.guest.to(['read']),
            // allow.authenticated.to(['read', 'write', 'delete']),
            allow.groups(['Systeme', 'Administrateur']).to(['read', 'write', 'delete']),
            allow.groups(['Contributeur', 'Membre']).to(['read', 'write']),
        ],
        'accounting/*': [
            allow.guest.to(['read']),
            allow.groups(['Systeme', 'Administrateur']).to(['read', 'write', 'delete']),
            allow.groups(['Contributeur', 'Membre']).to(['read']),
            // allow.authenticated.to(['read', 'write', 'delete'])
        ],
    })
})

// export const firstBucket = defineStorage({
//     name: 'publicBucket',
//     access: (allow) => ({
//         'public/*': [
//             allow.guest.to(['read'])
//         ]
//     })
//     // isDefault: true, // identify your default storage bucket (required)
// });

// export const secondBucket = defineStorage({
//     name: 'protectedBucket',
//     access: (allow) => ({
//         'private/{entity_id}/*': [
//             allow.entity('identity').to(['read', 'write', 'delete'])
//         ]
//     })
// })