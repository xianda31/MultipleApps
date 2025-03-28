import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'bcstoDrive',
    access: (allow) => ({
        'profile-pictures/{entity_id}/*': [
            allow.guest.to(['read']),
            allow.entity('identity').to(['read', 'write', 'delete'])
        ],
        'thumbnails/*': [
            allow.authenticated.to(['read', 'write', 'delete']),
            allow.guest.to(['read'])
        ],
        'albums/*': [
            allow.authenticated.to(['read', 'write', 'delete']),
            allow.guest.to(['read'])
        ],
        'system/*': [
            allow.authenticated.to(['read', 'write', 'delete']),
            allow.guest.to(['read'])
        ],
        'accounting/*': [
            allow.authenticated.to(['read', 'write', 'delete']),
            allow.guest.to(['read'])
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