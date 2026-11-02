# TODO NFC - Badgeuse murale ppNFC

## Statut

Nouvelle baseline définie le 01/11/2026.

Le lecteur ACR1555U a été reçu. Il sera intégré dans un boîtier mural avec une
ampoule Wi-Fi compatible Smart Life/Tuya afin de constituer une badgeuse.

Le prototype NFC Android réalisé dans ppTPE reste une validation technique
historique. Il n'est plus la cible d'exploitation :

- ppTPE est désormais cantonné au pilotage du WisePad 3 sur une tablette dédiée,
  allumée en permanence ;
- la lecture des badges NFC est confiée à une nouvelle application Windows
  appelée ppNFC ;
- ppNFC est un passe-plat entre la badgeuse et le pointage métier.

## Objectif

Permettre aux joueurs de se pointer avec une carte NTAG213 attribuée à un membre.
ppNFC lit l'UID avec l'ACR1555U, l'envoie avec la session de pointage active au
backend, puis restitue immédiatement le résultat sur la badgeuse.

Chaîne fonctionnelle :

`NTAG213 -> ACR1555U -> ppNFC -> backend -> fees-collector`

## Architecture cible

### ppTPE

- Fonctionne uniquement sur la tablette dédiée au WisePad 3.
- Pilote les paiements Stripe Terminal.
- Ne lit plus les cartes NTAG213.
- Ne pilote ni l'ACR1555U ni la signalétique de la badgeuse.

### ppNFC

- Application Windows distribuée sous forme de `.exe`.
- Application de zone de notification démarrée automatiquement avec la session
  Windows.
- Fonctionne en permanence sur le poste relié à la badgeuse.
- Fournit une fenêtre de diagnostic accessible depuis son icône.
- Affiche au minimum l'état du lecteur, du backend, de la session de pointage,
  de l'ampoule et la dernière lecture utile.
- Reçoit l'UID de l'ACR1555U en Bluetooth.
- Normalise l'UID en hexadécimal, majuscules et sans séparateur.
- Bloque les doubles lectures pendant une courte période.
- Transmet l'UID et le `gameId` actif au backend.
- Ne porte pas les règles métier de pointage.

Le mode Bluetooth exact de l'ACR1555U reste à valider avec le matériel :

- Reader Mode est privilégié afin que ppNFC puisse recevoir les UID sans
  dépendre du focus Windows, surveiller la connexion et commander le buzzer
  uniquement après un refus métier ;
- HID est conservé comme solution de repli si Reader Mode n'est pas exploitable
  de manière fiable sous Windows ;
- en HID, le buzzer conditionné au résultat métier peut nécessiter un actionneur
  séparé si le lecteur ne peut pas être commandé par ppNFC.

La technologie de réalisation du `.exe` reste à choisir. .NET est le candidat
privilégié pour l'intégration Windows, Bluetooth, zone de notification et
démarrage automatique.

### fees-collector et backend

- fees-collector sélectionne et publie explicitement la session de pointage
  active et son `gameId`.
- ppNFC ne choisit jamais implicitement le tournoi.
- Le backend résout l'UID vers le membre ou la licence.
- Les contrôles métier restent ceux de fees-collector.
- Sans session active, aucun badge ne peut être accepté.
- Le résultat métier est retourné à ppNFC pour piloter la signalétique.

## Signalétique de la badgeuse

L'ampoule Wi-Fi, initialement configurée avec Smart Life/Tuya, doit être pilotée
directement sur le réseau local. ppNFC ne doit faire aucun appel aux serveurs
Tuya pour la signalétique.

Le pilotage local a été validé avec `tinytuya` :

- protocole Tuya local 3.4 ;
- connexion directe à l'adresse IP locale courante de l'ampoule ;
- socket persistant ;
- DPS `20` pour l'alimentation ;
- DPS `21` avec la valeur `colour` pour le mode ;
- DPS `24` pour la couleur HSV encodée.

Codes déjà testés :

- bleu : `00f003e803e8` ;
- vert : `007803e803e8` ;
- rouge : `000003e803e8`.

Le code de l'orange reste à valider sur l'ampoule réelle. L'intégration doit être
isolée derrière une interface de signalisation locale.

| État | Signal lumineux | Signal sonore | Durée et transition |
|---|---|---|---|
| ppNFC opérationnel, session active, attente d'une carte | Bleu fixe | Aucun | Jusqu'à la prochaine lecture ou indisponibilité |
| Pointage accepté | Vert | Aucun | 2 secondes, puis retour au bleu |
| Pointage refusé | Rouge | Buzzer de l'ACR1555U | 2 secondes, puis retour au bleu |
| Badgeuse indisponible | Orange fixe | Aucun | Jusqu'au rétablissement |

L'état indisponible couvre au minimum :

- ACR1555U absent ou déconnecté ;
- backend inaccessible ;
- aucune session de pointage active ;
- ampoule locale non joignable, avec erreur visible dans ppNFC.

Une nouvelle lecture ne doit pas laisser la badgeuse dans un état incohérent.
La stratégie de sérialisation ou de remplacement des signaux temporaires sera
définie pendant le prototype.

## Décisions de sécurité et de données

- Utiliser l'UID usine du NTAG213 comme identifiant opaque.
- Ne stocker ni licence ni donnée personnelle sur la carte.
- Maintenir l'association UID-membre côté serveur.
- Garantir l'unicité de l'UID.
- Authentifier ppNFC auprès du backend.
- Conserver l'identifiant et la clé locale de l'ampoule dans une configuration
  sécurisée hors du dépôt.
- Considérer l'adresse IP comme une donnée dynamique et non comme un paramètre
  permanent.
- Ne jamais exposer la clé locale Tuya dans les journaux.
- Découvrir l'ampoule sur le LAN à partir de son identifiant Tuya, puis mettre
  en cache la dernière adresse IP fonctionnelle.
- En cas d'échec sur l'adresse connue, fermer la connexion, relancer la
  découverte locale et se reconnecter automatiquement.
- Une réservation DHCP peut optimiser la reconnexion, mais ne doit pas être
  obligatoire.
- Ne dépendre d'aucun service cloud Tuya pour le fonctionnement quotidien.
- Journaliser les erreurs techniques sans données personnelles inutiles.

## Phase 0 - Prototype Android historique

- [x] Ajouter la lecture NFC native Android à ppTPE.
- [x] Lire et normaliser l'UID.
- [x] Afficher l'UID lu.
- [x] Ajouter vibration et retour sonore.
- [x] Bloquer les doubles lectures.
- [x] Valider plusieurs NTAG213 sur Xiaomi Mi 10 Lite.

Validation du 20/10/2026 : prototype installé et lecture NFC confirmée sur le
Xiaomi Mi 10 Lite. Cette implémentation doit être retirée de ppTPE lors de la
mise en place de ppNFC.

## Phase 1 - Validation matérielle Windows

- [ ] Appairer l'ACR1555U en Bluetooth avec le poste Windows cible.
- [ ] Installer et documenter les pilotes ou outils ACS strictement nécessaires.
- [ ] Détecter l'ACR1555U en Reader Mode depuis un programme Windows minimal.
- [ ] Lire l'UID d'une NTAG213 sans dépendre du focus clavier.
- [ ] Déclencher le buzzer sur commande, indépendamment de la lecture.
- [ ] Désactiver ou éviter le bip automatique si celui-ci empêche de réserver le
  buzzer aux refus.
- [ ] Tester l'extinction, le rallumage et la reconnexion Bluetooth.
- [ ] Mesurer le délai de lecture et de commande du buzzer.
- [ ] Documenter la décision Reader Mode ou, en cas d'échec démontré, HID.
- [ ] Configurer si possible l'UID hexadécimal, ordre original, majuscules,
  aucun séparateur et terminaison explicite.
- [ ] Vérifier qu'une même carte produit le même UID que le prototype Android.
- [x] Valider le pilotage direct de l'ampoule avec le protocole Tuya local 3.4
  et `tinytuya`.
- [ ] Valider le code HSV de l'orange sur l'ampoule réelle.
- [ ] Valider la découverte locale de l'ampoule par son identifiant.
- [ ] Valider la redécouverte après changement d'adresse DHCP, coupure de
  l'ampoule et redémarrage du routeur.
- [ ] Mesurer le délai entre une commande et le changement de couleur.

## Phase 2 - Prototype ppNFC

- [ ] Choisir la pile Windows après le prototype Reader Mode ; .NET reste le
  candidat privilégié.
- [ ] Créer l'application Windows en zone de notification.
- [ ] Ajouter le démarrage automatique avec la session Windows.
- [ ] Ajouter une abstraction `INfcReader` pour isoler Reader Mode et un
  éventuel repli HID.
- [ ] Lire, normaliser et dédupliquer les UID.
- [ ] Exposer les états du lecteur : démarrage, prêt, lecture, déconnecté et
  erreur.
- [ ] Ajouter une abstraction pour la signalétique Tuya locale.
- [ ] Charger l'identifiant et la clé locale depuis une configuration
  sécurisée.
- [ ] Découvrir automatiquement l'adresse IP locale et mettre en cache la
  dernière adresse fonctionnelle.
- [ ] Maintenir ou rétablir la connexion locale persistante avec l'ampoule.
- [ ] Implémenter les états bleu, vert, rouge et orange.
- [ ] Déclencher le buzzer uniquement pour un pointage refusé.
- [ ] Garantir les temporisations de 2 secondes et le retour au bleu.
- [ ] Sérialiser les lectures et les transitions de signalétique pour empêcher
  deux badges rapprochés de produire un état incohérent.
- [ ] Ajouter la fenêtre de diagnostic.
- [ ] Ajouter des journaux locaux avec rotation et sans secret.
- [ ] Produire un `.exe` et un mécanisme d'installation ou de mise à jour.

## Phase 3 - Attribution des cartes

- [ ] Ajouter un modèle `MemberNfcCard`.
- [ ] Enregistrer au minimum l'UID, le membre ou la licence, le statut, la date
  et l'auteur de l'attribution.
- [ ] Garantir l'unicité de l'UID.
- [ ] Définir et importer le CSV fournisseur enrichi avec les UID.
- [ ] Valider les UID, licences inconnues, doublons et écarts de quantité.
- [ ] Produire un rapport d'import avant confirmation.
- [ ] Ajouter une interface d'attribution, désactivation, remplacement et
  réattribution contrôlée.

## Phase 4 - Session de pointage

- [ ] Permettre à fees-collector d'activer une session pour un tournoi.
- [ ] Publier le `gameId` actif à destination de ppNFC.
- [ ] Afficher dans ppNFC si le pointage est actif.
- [ ] Associer chaque lecture au tournoi actif.
- [ ] Refuser le pointage lorsqu'aucun tournoi n'est actif.
- [ ] Passer la badgeuse à l'orange lorsqu'aucune session n'est active.

## Phase 5 - Intégration métier

- [ ] Résoudre l'UID vers la licence du membre.
- [ ] Vérifier que le joueur est inscrit au tournoi actif.
- [ ] Réutiliser le traitement métier existant de `checkInByNfc`.
- [ ] Conserver les contrôles de crédits de carte de jeu.
- [ ] Respecter les pointages manuels et l'état de clôture du tournoi.
- [ ] Créer ou actualiser le `GameCheckIn`.
- [ ] Synchroniser le résultat en temps réel dans fees-collector.
- [ ] Retourner à ppNFC un résultat explicite et stable.

## Phase 6 - Validation de la badgeuse

- [ ] Tester succès, déjà pointé, carte inconnue, carte désactivée, crédits
  insuffisants, joueur non inscrit et absence de session.
- [ ] Vérifier les couleurs et temporisations pour chaque résultat.
- [ ] Vérifier que le buzzer ne sonne que sur un refus.
- [ ] Tester les lectures rapprochées et les doubles présentations.
- [ ] Tester les pertes et reprises Bluetooth, réseau et connexion Tuya locale.
- [ ] Tester la veille, la fermeture de session et le redémarrage Windows.
- [ ] Effectuer un test continu pendant plusieurs heures.
- [ ] Vérifier l'absence d'UID tronqué, fusionné ou dupliqué.
- [ ] Vérifier que chaque pointage accepté apparaît dans fees-collector.

## Premier jalon

Depuis Windows, lire une NTAG213 avec l'ACR1555U en Bluetooth, obtenir un UID
normalisé identique au prototype Android, commander le buzzer à la demande,
puis commander localement l'ampoule Tuya sans encore modifier le backend.

Critères de validation :

- lecture de 20 présentations consécutives sans UID tronqué ni saisie clavier ;
- même UID que sur Android ;
- buzzer déclenché uniquement sur commande du prototype ;
- reconnexion après extinction et rallumage du lecteur ;
- bleu, vert et rouge pilotés sans accès aux serveurs Tuya ;
- retour au bleu après une temporisation de 2 secondes ;
- passage à l'orange lorsqu'un composant requis est indisponible.
