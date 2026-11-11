# TODO NFC - Badgeuse murale ppNFC

## Statut

Nouvelle baseline définie le 01/11/2026.

### Revue du 09/11/2026

- La branche de développement est `feature/nfc-reader`.
- Le prototype Android est présent dans `projects/pptpe/src/app/nfc/` et
  démarré par ppTPE. Il reste une référence de comparaison, pas le prochain
  chantier d'intégration.
- Un prototype ppNFC Windows .NET 10 / Windows Forms est present dans
  `desktop/ppNFC/` : zone de notification, diagnostic et lecteur PC/SC partage.
  La compilation, les tests unitaires et le lancement ont ete valides le
  10/11/2026 ; les essais materiels sont consignes dans son README.
- Rebase des 2 commits NFC sur `origin/master` effectue le 09/11/2026 ;
  build Angular de developpement valide.
- La validation matérielle Windows etait le prochain jalon de cette revue ;
  voir la mise a jour du 10/11/2026 pour l'ordre de reprise actuel.

Ordre de reprise historique du 09/11/2026 :

1. Rebase sur `master` et build de developpement termines ; poursuivre les
   validations materielles.
2. Consolider le mode Reader Bluetooth sous Windows avec les outils ACS.
3. Compléter le diagnostic minimal : UID et état de connexion, sans backend.
4. Essais locaux Tuya en pause : orange, découverte et reconnexion à reprendre
   après les travaux d'intégration ACR.
5. Pile ppNFC choisie : .NET 10 / Windows Forms. Valider le prototype en zone
   de notification dans un environnement autorise.

### Mise a jour du 10/11/2026

- Sur le poste de test, les 20 tests .NET passent et l'executable autonome
  demarre. Les essais materiels ppNFC listes dans son README ont ete confirmes
  fonctionnels, y compris comparaison Android, lecteur absent puis present,
  lecture fenetre masquee et fermeture propre.
- Les sons occasionnels a la presentation/retrait sont emis par Windows et
  juges acceptables ; ppNFC ne joue aucun son.
- Le menu de l'icone ppNFC permet maintenant d'activer le lancement automatique
  pour l'utilisateur Windows courant, sans droits administrateur.
- Le lecteur PC/SC est isole derriere `INfcReader` : etat, changements, cycle
  de surveillance et liberation des ressources. `ReaderMonitor` conserve le
  comportement existant ; aucune implementation HID n'est ajoutee.
- Ordre de reprise actuel : attribution des cartes, session de pointage,
  integration et validation metier, puis signalisation lumineuse en dernier.
- La signaletique Tuya locale et les validations restantes de l'ampoule sont
  reportees a la phase 7. Le diagnostic ppNFC permettra de valider le pointage
  avant l'ajout des couleurs.

### Essais Windows du 09/11/2026

- Liaison uniquement Bluetooth, sans cable USB au PC, en mode Reader via le
  pilote ACS BLE PC/SC et Bluetooth Reader Management Tool.
- QuickView detecte la carte sur PICC 0 ; double-cliquer sur la ligne pour
  afficher les details.
- Le diagnostic `scripts/test-nfc-reader.ps1` lit un UID de 7 octets, en
  hexadecimal majuscule sans separateur, sans saisie clavier.
- Premier essai : 20 lectures abouties avec UID identique, mais plusieurs
  indisponibilites PC/SC `0x80100017`, recuperees par le script.
- Essai controle : 10 presentations lentes, carte maintenue 2 secondes apres
  lecture et retiree 2 secondes, sans avertissement et avec UID identique.
- Ces resultats ne valident pas encore 20 presentations consecutives sans
  erreur, la comparaison Android, la reconnexion ou la latence.
- Commande `-Beep` confirmee physiquement : un bip, juge tres faible.
- Decision du 09/11/2026 : signal lumineux uniquement. Le buzzer integre n'est
  pas assez audible en salle ; aucun buzzer externe n'est prevu.
- Priorité : reconnexion Bluetooth et intégration ACR. La partie lumineuse
  est mise en pause ; les essais Tuya reprendront ensuite.
- Essai extinction/rallumage confirme : deuxieme scan reussi apres redemarrage
  du lecteur pendant le diagnostic.
  Ne pas conclure a une coupure Bluetooth sur le seul code PC/SC `0x80100017`.

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
  dépendre du focus Windows et surveiller la connexion ;
- HID est conservé comme solution de repli si Reader Mode n'est pas exploitable
  de manière fiable sous Windows.

La technologie de réalisation du `.exe` est .NET 10 / Windows Forms, choisie
pour l'intégration Windows, PC/SC et la zone de notification. Le démarrage
automatique reste à implémenter.

### fees-collector et backend

- fees-collector sélectionne et publie explicitement la session de pointage
  active et son `gameId`.
- ppNFC ne choisit jamais implicitement le tournoi.
- Le backend résout l'UID vers le membre ou la licence.
- Les contrôles métier restent ceux de fees-collector.
- Sans session active, aucun badge ne peut être accepté.
- Le résultat métier est retourné à ppNFC pour piloter la signalétique.

## Signalétique de la badgeuse

La restitution métier est uniquement lumineuse : ppNFC ne déclenche aucun
buzzer, ni intégré ni externe. Le son n'est pas un critère de validation.

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
Sa realisation et les essais restants sont reportes apres la validation du
pointage metier, en phase 7.

| État | Signal lumineux | Durée et transition |
|---|---|---|
| ppNFC opérationnel, session active, attente d'une carte | Bleu fixe | Jusqu'à la prochaine lecture ou indisponibilité |
| Pointage accepté | Vert | 2 secondes, puis retour au bleu |
| Pointage refusé | Rouge | 2 secondes, puis retour au bleu |
| Badgeuse indisponible | Orange fixe | Jusqu'au rétablissement |

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

- [x] Connecter l'ACR1555U en Bluetooth avec le poste Windows cible via ACS.
- [x] Installer et documenter les pilotes ou outils ACS strictement nécessaires.
- [x] Détecter l'ACR1555U en Reader Mode depuis un programme Windows minimal.
- [x] Lire l'UID d'une NTAG213 sans dépendre du focus clavier.
- [x] Essai historique du buzzer : commande fonctionnelle, mais signal sonore
  abandonné car trop faible en salle.
- [x] Tester l'extinction, le rallumage et la reconnexion Bluetooth.
- [ ] Mesurer le délai de lecture.
- [x] Documenter la decision Reader Mode ; aucun echec ne justifie HID.
- [x] Normaliser l'UID lu en hexadecimal majuscule, sans separateur, dans
  l'ordre renvoye par le lecteur.
- [x] Vérifier qu'une même carte produit le même UID que le prototype Android.
- [x] Valider le pilotage direct de l'ampoule avec le protocole Tuya local 3.4
  et `tinytuya`.

Les validations restantes de l'ampoule sont regroupees en phase 7.

## Phase 2 - Prototype ppNFC

- [x] Choisir la pile Windows : .NET 10 / Windows Forms.
- [x] Creer les sources de l'application Windows en zone de notification,
  compiler et valider son execution.
- [x] Ajouter le démarrage automatique avec la session Windows (menu de l'icone,
  cle Run de l'utilisateur courant).
- [x] Ajouter une abstraction `INfcReader` pour isoler Reader Mode et un
  éventuel repli HID.
- [x] Lire, normaliser et dédupliquer les UID.
- [x] Exposer les états du lecteur : démarrage, prêt, lecture, déconnecté et
  erreur.
- [x] Ajouter la fenêtre de diagnostic.
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

## Phase 5 - Intégration métier

- [ ] Résoudre l'UID vers la licence du membre.
- [ ] Exiger un membre explicitement `ACTIVE` ; refuser les membres
  `ARCHIVED`, `BANNED` ou dont le statut est absent/invalide, indépendamment
  du statut de licence FFB.
- [ ] Vérifier que le joueur est inscrit au tournoi actif.
- [ ] Réutiliser le traitement métier existant de `checkInByNfc`.
- [ ] Conserver les contrôles de crédits de carte de jeu.
- [ ] Respecter les pointages manuels et l'état de clôture du tournoi.
- [ ] Créer ou actualiser le `GameCheckIn`.
- [ ] Synchroniser le résultat en temps réel dans fees-collector.
- [ ] Retourner à ppNFC un résultat explicite et stable.

## Phase 6 - Validation du pointage sans signalisation lumineuse

- [ ] Tester succès, déjà pointé, carte inconnue, carte désactivée, crédits
  insuffisants, joueur non inscrit et absence de session.
- [ ] Tester le refus d'un membre archivé ou banni, ainsi que d'un membre
  sans statut valide, même avec une carte attribuée et une inscription.
- [ ] Afficher les resultats metier dans le diagnostic ppNFC pour valider le
  pointage sans dependance a l'ampoule.
- [ ] Tester les lectures rapprochées et les doubles présentations.
- [ ] Tester les pertes et reprises Bluetooth et réseau.
- [ ] Tester la veille, la fermeture de session et le redémarrage Windows.
- [ ] Effectuer un test continu pendant plusieurs heures.
- [ ] Vérifier l'absence d'UID tronqué, fusionné ou dupliqué.
- [ ] Vérifier que chaque pointage accepté apparaît dans fees-collector.

## Phase 7 - Signalisation lumineuse et validation finale

Cette phase intervient en dernier, apres validation du pointage metier.

- [ ] Ajouter une abstraction pour la signalétique Tuya locale.
- [ ] Charger l'identifiant et la clé locale depuis une configuration
  sécurisée.
- [ ] Valider le code HSV de l'orange sur l'ampoule réelle.
- [ ] Valider la découverte locale de l'ampoule par son identifiant.
- [ ] Découvrir automatiquement l'adresse IP locale et mettre en cache la
  dernière adresse fonctionnelle.
- [ ] Maintenir ou rétablir la connexion locale persistante avec l'ampoule.
- [ ] Valider la redécouverte après changement d'adresse DHCP, coupure de
  l'ampoule et redémarrage du routeur.
- [ ] Mesurer le délai entre une commande et le changement de couleur.
- [ ] Implémenter les états bleu, vert, rouge et orange.
- [ ] Passer la badgeuse à l'orange lorsqu'aucune session n'est active.
- [ ] Garantir les temporisations de 2 secondes et le retour au bleu.
- [ ] Sérialiser les lectures et les transitions de signalétique pour empêcher
  deux badges rapprochés de produire un état incohérent.
- [ ] Vérifier les couleurs et temporisations pour chaque résultat métier.
- [ ] Vérifier que la restitution métier repose uniquement sur les couleurs,
  sans commande de buzzer.
- [ ] Tester les pertes et reprises Bluetooth, réseau et connexion Tuya locale.
- [ ] Rejouer les scenarios de la phase 6 avec la signalisation lumineuse,
  y compris les lectures rapprochees et un test continu de plusieurs heures.

## Premier jalon

Prototype ppNFC : voir [construction, utilisation et limites de validation](desktop/ppNFC/README.md).

Diagnostic UID Windows, sans backend :

```powershell
powershell -NoProfile -File .\scripts\test-nfc-reader.ps1 -ListReaders
powershell -NoProfile -File .\scripts\test-nfc-reader.ps1 -Count 20
```

Le pilote ACS BLE PC/SC doit etre installe et le lecteur ajoute dans Bluetooth
Reader Management Tool en mode Reader. Fermer QuickView avant le diagnostic.
Retirer la carte entre les lectures ; interrompre avec Ctrl+C si necessaire.
Le script affiche l'UID en hexadecimal majuscule, sans separateur, et sa longueur.
Le mode lecture UID ne pilote ni le buzzer ni la signaletique.
Le test historique du buzzer reste disponible à titre de diagnostic uniquement,
hors du périmètre ppNFC, et ne requiert aucune carte :

```powershell
powershell -NoProfile -File .\scripts\test-nfc-reader.ps1 -Beep
```

Cette option envoie une seule commande de 200 ms et verifie la reponse du
lecteur ; un bip faible a ete confirme physiquement.
Commande issue du manuel ACS ACR1555U 2.02, sections 5.3.4 et 6.3.4 :
`SCardControl(SCARD_CTL_CODE(3500))`, donnees `E0 00 00 28 01 14`.
Le support de cette commande par le pilote BLE a ete confirme sur le materiel.
Une indisponibilite PC/SC `0x80100017` est signalee et attendue pendant au plus
10 secondes avant arret en erreur. La presentation interrompue n'est pas comptee ;
retirer puis representer la carte apres le retablissement du lecteur.

Depuis Windows, lire une NTAG213 avec l'ACR1555U en Bluetooth, obtenir un UID
normalisé identique au prototype Android, puis commander localement l'ampoule
Tuya sans encore modifier le backend.

Critères de validation :

- lecture de 20 présentations consécutives sans UID tronqué ni saisie clavier ;
- même UID que sur Android ;
- reconnexion après extinction et rallumage du lecteur ;
- bleu, vert et rouge pilotés sans accès aux serveurs Tuya ;
- retour au bleu après une temporisation de 2 secondes ;
- passage à l'orange lorsqu'un composant requis est indisponible.
