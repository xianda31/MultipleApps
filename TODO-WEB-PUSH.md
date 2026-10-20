# TODO Web Push

## Objectif

Permettre aux membres connectés de choisir les notifications Web Push reçues sur chaque navigateur, puis permettre au club d'envoyer des notifications ciblées et traçables.

Thèmes fonctionnels :

- `news` : actualités du club ;
- `partner` : recherches de partenaire ;
- `alerts` : reports, annulations et changements importants.

## État actuel - V1 abonnement navigateur

- [x] Générer et configurer la clé publique VAPID.
- [x] Détecter le support Web Push du navigateur.
- [x] Demander explicitement l'autorisation de notification.
- [x] Enregistrer un Service Worker dédié sous `/push/`.
- [x] Créer ou réutiliser la `PushSubscription` du navigateur.
- [x] Normaliser l'identifiant d'abonnement avec le hash SHA-256 de l'endpoint.
- [x] Enregistrer l'endpoint et les clés `p256dh` et `auth` dans Amplify.
- [x] Enregistrer les thèmes choisis pour chaque navigateur.
- [x] Réconcilier l'abonnement local avec l'abonnement réel du navigateur.
- [x] Supprimer un abonnement révoqué ou expiré détecté côté client.
- [x] Afficher la proposition d'abonnement sur toutes les pages du front pour un membre connecté.
- [x] Permettre de modifier les thèmes dans « Mes préférences ».
- [x] Recevoir une notification dans le Service Worker.
- [x] Ouvrir ou recentrer l'application au clic sur une notification.
- [x] Tester les fonctions de conversion VAPID, de hash et de persistance.

## Phase 1 - Stabiliser la V1

- [ ] Renommer les fichiers et symboles `notification-subscription-demo` pour retirer la notion de démonstration.
- [ ] Ajouter un délai persistant au choix « Plus tard » afin de ne pas reproposer à chaque nouvelle visite.
- [ ] Définir la durée du délai « Plus tard ».
- [ ] Ne pas afficher la proposition sur les navigateurs non compatibles.
- [ ] Afficher un état explicite lorsque les notifications sont bloquées dans les réglages du navigateur.
- [ ] Empêcher deux actions d'abonnement ou de désabonnement simultanées.
- [ ] Ajouter les tests du cycle complet : accepter, modifier les thèmes, refuser, révoquer et réconcilier.
- [ ] Vérifier la coexistence du Service Worker Push et du Service Worker Angular PWA.
- [ ] Vérifier Android, Windows Chrome, Windows Edge et macOS.

## Phase 2 - Sécuriser les abonnements

- [ ] Associer chaque abonnement à son propriétaire Cognito.
- [ ] Limiter la création, la modification et la suppression au propriétaire de l'abonnement.
- [ ] Réserver la lecture globale des endpoints et clés aux groupes serveur autorisés.
- [ ] Vérifier qu'un membre ne peut ni modifier ni supprimer l'abonnement d'un autre membre.
- [ ] Ne jamais exposer la clé privée VAPID au client ou au dépôt.
- [ ] Stocker la clé privée VAPID dans AWS Secrets Manager ou SSM.
- [ ] Documenter la rotation de la paire VAPID et son impact sur les abonnements existants.
- [ ] Définir une politique de conservation et de purge des abonnements inactifs.

## Phase 3 - Émetteur Web Push serveur

- [ ] Créer une fonction Amplify dédiée à l'envoi Web Push.
- [ ] Ajouter la dépendance serveur Web Push appropriée.
- [ ] Charger le sujet, la clé publique et la clé privée VAPID côté serveur.
- [ ] Valider strictement le titre, le corps, l'URL cible, le thème et les options du message.
- [ ] Sélectionner uniquement les abonnements ayant accepté le thème demandé.
- [ ] Envoyer par lots avec une concurrence limitée.
- [ ] Supprimer automatiquement les abonnements retournant HTTP 404 ou 410.
- [ ] Distinguer les erreurs permanentes des erreurs temporaires.
- [ ] Journaliser le nombre de destinataires, les succès, les expirations et les échecs.
- [ ] Retourner un bilan explicite à l'appelant, sans transformer un échec en succès apparent.
- [ ] Ajouter des tests unitaires avec transport Push simulé.

Résultat attendu : un appel serveur contrôlé peut envoyer une notification de test réelle à un navigateur abonné.

## Phase 4 - Envoi de test administrateur

- [ ] Ajouter une action administrateur « Envoyer une notification de test ».
- [ ] Permettre de choisir le thème, le titre, le message et l'URL cible.
- [ ] Proposer un mode limité au navigateur ou au membre courant.
- [ ] Afficher le bilan réel de l'envoi.
- [ ] Empêcher l'accès aux utilisateurs non autorisés.
- [ ] Tester la réception lorsque l'application est ouverte, en arrière-plan et fermée.
- [ ] Tester le clic et la navigation vers la page cible.

## Phase 5 - Notifications métier

### Actualités

- [ ] Définir précisément l'événement qui déclenche une notification `news`.
- [ ] Éviter une notification à chaque sauvegarde intermédiaire d'une actualité.
- [ ] Construire une URL directe vers le contenu publié.

### Recherche de partenaire

- [ ] Définir l'événement de création ou de réactivation qui déclenche `partner`.
- [ ] Éviter les doublons lors des mises à jour.
- [ ] Construire une URL directe vers la recherche concernée.

### Alertes

- [ ] Ajouter un envoi manuel contrôlé pour les alertes importantes.
- [ ] Exiger une confirmation avant l'envoi.
- [ ] Prévoir un aperçu du message et du nombre de destinataires.

## Phase 6 - Robustesse et exploitation

- [ ] Ajouter un identifiant d'envoi pour l'idempotence et le diagnostic.
- [ ] Empêcher le double envoi lors d'un retry ou d'un double clic.
- [ ] Définir une longueur maximale de titre et de corps.
- [ ] Valider que l'URL cible reste sur un domaine autorisé.
- [ ] Définir la stratégie `tag` et le remplacement des notifications similaires.
- [ ] Vérifier les icônes et badges sur chaque plateforme.
- [ ] Mesurer le taux d'abonnements invalides et les purger.
- [ ] Ajouter une procédure de diagnostic et de support utilisateur.
- [ ] Documenter le déploiement des ressources Amplify et des secrets.

## Validation de mise en production

- [ ] Déployer le modèle `PushSubscription` dans l'environnement cible.
- [ ] Vérifier que le site est servi en HTTPS.
- [ ] Vérifier la paire VAPID de production.
- [ ] S'abonner avec au moins un appareil Android et un navigateur desktop.
- [ ] Envoyer une notification de test par thème.
- [ ] Confirmer que seuls les abonnés du thème la reçoivent.
- [ ] Révoquer un abonnement puis vérifier sa suppression.
- [ ] Vérifier la navigation au clic.
- [ ] Vérifier l'absence de données sensibles dans le payload et les journaux.

## Prochain jalon

Sécuriser la propriété des `PushSubscription`, puis implémenter une fonction serveur capable d'envoyer une notification de test et de supprimer automatiquement les abonnements expirés.
