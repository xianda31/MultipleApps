import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'bcstoDrive',
    access: (allow) => ({
        'profile-pictures/{entity_id}/*': [
            allow.guest.to(['read']),
            allow.entity('identity').to(['read', 'write', 'delete'])
        ],
        'thumbnails/*': [
            allow.guest.to(['read']),
            allow.authenticated.to(['read', 'write', 'delete']),

        ],
        'albums/*': [
            allow.guest.to(['read']),
            allow.authenticated.to(['read', 'write', 'delete']),

        ],
        'system/*': [
            allow.guest.to(['read']),
            // allow.authenticated.to(['read', 'write', 'delete']),
            allow.groups(['Systeme','Administrateur']).to(['read', 'write', 'delete']),
            allow.groups(['Contributeur','Membre']).to(['read', 'write']),
        ],
        'accounting/*': [
            allow.guest.to(['read']),
            allow.authenticated.to(['read', 'write', 'delete'])
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