# TODO NFC - Pointage des membres par carte NTAG213

## Statut

En attente de matériel depuis le 20/10/2026.

Conditions de reprise :

- réception des cartes NTAG213 personnalisées et du CSV fournisseur enrichi avec les UID ;
- réception du lecteur ACR1555U pour la configuration tablette et les essais de coexistence avec le WisePad 3.

Le prototype NFC Android est validé sur Xiaomi Mi 10 Lite avec des cartes NTAG213 de test.

## Objectif

Permettre aux joueurs de se pointer avec une carte NTAG213 attribuée à un membre. Le pointage est reçu par ppTPE puis appliqué à fees-collector en temps réel.

Deux sources de lecture doivent partager la même logique :

- NFC natif d'un téléphone Android, utilisé pour le développement et potentiellement en exploitation ;
- lecteur ACR1555U connecté à une tablette, avec le mode HID privilégié initialement.

Le Reader Mode BLE de l'ACR1555U reste une option si les essais HID montrent une limitation réelle.

## Décisions d'architecture

- Utiliser l'UID usine du NTAG213 comme identifiant opaque.
- Ne pas stocker de licence ni de donnée personnelle sur la carte.
- Maintenir l'association UID-membre côté serveur.
- Normaliser tous les UID dans un format commun : hexadécimal, majuscules, sans séparateur.
- Isoler les lecteurs derrière une abstraction commune afin de ne pas dupliquer la logique métier.
- Laisser Stripe Terminal gérer seul le WisePad 3.
- En HID, laisser Android gérer la connexion Bluetooth de l'ACR1555U.
- Alimenter l'ACR1555U par un chargeur USB 5 V séparé, et non par le port USB hôte de la tablette.

## Phase 1 - Prototype NFC Android

- [x] Ajouter la lecture NFC native Android à ppTPE.
- [x] Lire l'UID avec l'API Android.
- [x] Normaliser l'UID.
- [x] Afficher l'UID lu dans ppTPE.
- [x] Ajouter une vibration à la lecture.
- [x] Confirmer un retour sonore à la lecture (système Android ou application).
- [x] Bloquer les doubles lectures pendant une courte période.
- [x] Valider le prototype sur le Xiaomi Mi 10 Lite avec plusieurs NTAG213.

Résultat attendu : une carte présentée au téléphone produit un UID normalisé fiable, sans modification du backend.

Validation du 20/10/2026 : prototype installé et lecture NFC confirmée sur le Xiaomi Mi 10 Lite avec des cartes NTAG213 physiques.

## Phase 2 - Attribution des cartes

- [ ] Ajouter un modèle `MemberNfcCard`.
- [ ] Enregistrer au minimum l'UID, le membre ou la licence, le statut, la date et l'auteur de l'attribution.
- [ ] Garantir l'unicité de l'UID.
- [ ] Définir le CSV fournisseur avec la licence comme clé stable, ainsi que le prénom et le nom pour l'impression.
- [ ] Demander au fournisseur de retourner le même CSV enrichi avec l'UID réellement lu sur chaque carte.
- [ ] Ajouter un import en masse du CSV fournisseur.
- [ ] Valider à l'import le format des UID, les licences inconnues, les doublons d'UID, les doublons de licence et les écarts de quantité.
- [ ] Produire un rapport d'import avant confirmation définitive.
- [ ] Contrôler physiquement un échantillon de cartes en comparant l'UID lu par ppTPE avec le CSV fournisseur.
- [ ] Ajouter une interface d'attribution d'une carte à un membre.
- [ ] Permettre la désactivation, le remplacement et la réattribution contrôlée d'une carte.
- [ ] Conserver un historique si nécessaire.

Résultat attendu : un UID actif permet de retrouver un membre ou une licence de manière non ambiguë.

## Phase 3 - Session de pointage

- [ ] Permettre à fees-collector d'activer une session de pointage pour un tournoi.
- [ ] Transmettre à ppTPE le tournoi ou `gameId` actif.
- [ ] Afficher clairement dans ppTPE si le pointage est actif.
- [ ] Associer chaque lecture au tournoi actif.
- [ ] Refuser le pointage lorsqu'aucun tournoi n'est actif.

Résultat attendu : ppTPE ne choisit jamais implicitement le tournoi à modifier.

## Phase 4 - Intégration fees-collector

- [ ] Résoudre l'UID vers la licence du membre.
- [ ] Vérifier que le joueur est inscrit au tournoi actif.
- [ ] Réutiliser le traitement métier existant de `checkInByNfc`.
- [ ] Conserver les contrôles de crédits de carte de jeu.
- [ ] Respecter les pointages manuels et l'état de clôture du tournoi.
- [ ] Créer ou actualiser le `GameCheckIn`.
- [ ] Synchroniser le résultat en temps réel dans fees-collector.

Résultat attendu : une carte valide pointe le bon joueur sans contourner les validations métier existantes.

## Phase 5 - Expérience utilisateur

- [ ] Afficher le nom du membre après lecture.
- [ ] Distinguer succès, déjà pointé, carte inconnue, carte désactivée, crédits insuffisants et joueur non inscrit.
- [ ] Utiliser des sons et vibrations différents pour le succès et l'erreur.
- [ ] Afficher les dernières lectures utiles.
- [ ] Conserver la connexion au lecteur pendant un paiement Stripe.
- [ ] Refuser ou différer fonctionnellement un pointage pendant un paiement.

## Phase 6 - ACR1555U en HID

- [ ] Configurer l'ACR1555U en HID avec UID hexadécimal, ordre original, majuscules, aucun séparateur et `Enter` final.
- [ ] Ajouter une source HID qui accumule les frappes jusqu'à `Enter`.
- [ ] Empêcher les frappes HID d'alimenter les champs de formulaire.
- [ ] Faire passer les UID HID par la même normalisation que les UID Android.
- [ ] Vérifier qu'une même carte produit le même UID sur Android et sur l'ACR1555U.
- [ ] Alimenter l'ACR1555U avec un chargeur USB séparé.

## Phase 7 - Validation WisePad 3 et ACR1555U

- [ ] Connecter le WisePad 3 avant d'activer l'écoute des badges.
- [ ] Tester l'ACR connecté avant et après la découverte du WisePad 3.
- [ ] Alterner lectures NTAG et paiements.
- [ ] Tester une lecture NTAG pendant un paiement.
- [ ] Tester la veille et la reprise de la tablette.
- [ ] Tester l'extinction et le retour de chaque lecteur indépendamment.
- [ ] Tester les pertes temporaires de portée.
- [ ] Effectuer un test continu pendant plusieurs heures.
- [ ] Vérifier l'absence de paiement perdu ou sensiblement ralenti.
- [ ] Vérifier l'absence d'UID tronqué, fusionné ou dupliqué.
- [ ] Vérifier l'absence de boucle de reconnexion.

## Phase 8 - Décision Reader Mode BLE

- [ ] Évaluer les limites constatées du mode HID.
- [ ] Réaliser un prototype ACS Reader Mode uniquement si ces limites le justifient.
- [ ] Comparer stabilité, reconnexion, maintenance et coexistence avec Stripe Terminal.
- [ ] Conserver HID si le gain du Reader Mode ne justifie pas sa complexité.

## Premier jalon

Lire une NTAG213 avec le Xiaomi depuis ppTPE et afficher un UID normalisé, sans backend ni effet sur fees-collector.
