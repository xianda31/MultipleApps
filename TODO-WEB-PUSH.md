# TODO Web Push

## Objectif

Permettre aux membres connectés de choisir les notifications Web Push reçues sur chaque navigateur, puis permettre au club d'envoyer des notifications ciblées et traçables.

Thèmes fonctionnels :

- `news` : actualités du club ;
- `partner` : recherches de partenaire ;
- `alerts` : reports, annulations et changements importants.

## État actuel - V1 abonnement navigateur

- [x] Protéger toutes les surfaces clientes par `web_push_active`, désactivé par défaut si absent de la configuration système.
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

- [x] Renommer les fichiers et symboles `notification-subscription-demo` pour retirer la notion de démonstration.
- [x] Ajouter un délai persistant au choix « Plus tard » afin de ne pas reproposer à chaque nouvelle visite.
- [x] Définir la durée du délai « Plus tard » : 30 jours.
- [x] Ne pas afficher la proposition sur les navigateurs non compatibles.
- [x] Afficher un état explicite lorsque les notifications sont bloquées dans les réglages du navigateur.
- [x] Empêcher deux actions d'abonnement ou de désabonnement simultanées.
- [ ] Ajouter les tests du cycle complet : accepter, modifier les thèmes, refuser, révoquer et réconcilier.
- [ ] Vérifier la coexistence du Service Worker Push et du Service Worker Angular PWA.
- [ ] Vérifier Android, Windows Chrome, Windows Edge et macOS.

Validation sandbox du 21 octobre 2026 :

- [x] Créer un abonnement depuis la proposition navigateur.
- [x] Vérifier l'ajout automatique du propriétaire Cognito.
- [x] Mettre à jour les thèmes depuis « Mes préférences » sans créer de doublon.
- [x] Supprimer l'abonnement en désactivant tous les thèmes.

## Phase 2 - Sécuriser les abonnements

- [x] Associer chaque abonnement à son propriétaire Cognito.
- [x] Limiter la création, la modification et la suppression au propriétaire de l'abonnement.
- [x] Réserver la lecture globale des endpoints et clés au groupe système utilisé par le serveur.
- [x] Vérifier par revue de code qu'un membre ne peut ni modifier ni supprimer l'abonnement d'un autre membre.
- [x] Ne jamais exposer la clé privée VAPID au client ou au dépôt.
- [x] Charger la clé privée VAPID depuis un paramètre SSM SecureString côté serveur.
- [ ] Documenter la rotation de la paire VAPID et son impact sur les abonnements existants.
- [ ] Définir une politique de conservation et de purge des abonnements inactifs.

Migration V1 : purger les enregistrements `PushSubscription` créés avant l'ajout de la règle
propriétaire. Ils ne contiennent aucune identité permettant d'attribuer leur propriétaire de façon
fiable ; les navigateurs concernés devront se réabonner.

Validation de l'isolation : la règle `allow.owner().to(['create', 'update', 'delete'])` ajoute le
propriétaire Cognito à la création et impose sa correspondance pour les mutations. Le test dynamique
avec deux comptes n'a pas été exécuté, par choix. Un changement de compte dans un même profil
navigateur reste à gérer explicitement avant la production.

## Phase 3 - Émetteur Web Push serveur

- [x] Créer une fonction Amplify dédiée à l'envoi Web Push.
- [x] Ajouter la dépendance serveur `web-push`.
- [x] Charger le sujet, la clé publique et la clé privée VAPID côté serveur.
- [x] Valider strictement le titre, le corps, l'URL cible, le thème et les options du message.
- [x] Sélectionner uniquement les abonnements ayant accepté le thème demandé.
- [x] Envoyer par lots avec une concurrence limitée à dix envois.
- [x] Supprimer automatiquement les abonnements retournant HTTP 404 ou 410.
- [x] Distinguer les erreurs permanentes des erreurs temporaires.
- [x] Journaliser le nombre de destinataires, les succès, les expirations et les échecs.
- [x] Retourner un bilan explicite à l'appelant, sans transformer un échec en succès apparent.
- [x] Ajouter des tests unitaires avec transport Push simulé.

Configuration SSM attendue :

- `/multiple-apps/web-push/vapid-subject` : chaîne `mailto:` ou URL HTTPS ;
- `/multiple-apps/web-push/vapid-public-key` : clé publique VAPID ;
- `/multiple-apps/web-push/vapid-private-key` : clé privée VAPID de type `SecureString`.

La mutation `sendWebPush` est réservée au seul groupe Cognito `Systeme`. Elle accepte un ciblage
optionnel par identifiant d'abonnement pour les essais, sans exposer les endpoints ou les clés.

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

- [ ] Activer `web_push_active` dans la configuration système uniquement après les validations ci-dessous.
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

La branche peut être fusionnée avec `web_push_active` absent ou à `false` : aucune proposition, préférence ou réconciliation Push n'est alors lancée côté client. L'activation en production reste conditionnée aux validations de plateforme, au déploiement du modèle et à la configuration VAPID.

Ajouter l'envoi de test administrateur, puis terminer les validations multi-navigateurs avant toute activation en production.
