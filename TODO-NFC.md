# TODO NFC - Badgeuse via ppTPE Android

## Situation actuelle

La branche utilise exclusivement l'ACR1555U connecté en Bluetooth à ppTPE
Android, pour le pointage et l'Espace NFC. Le prototype Windows ppNFC, son
diagnostic PowerShell et le choix de source PC ont été retirés. Une ancienne
préférence de source mémorisée dans le navigateur n'est plus utilisée.

La liaison est relayée par AppSync ; voir la phase Android ci-dessous. Le statut
connecté ne prouve pas qu'une carte est effectivement détectée.
Restent notamment à vérifier la lecture réelle avec l'ACR et le WisePad
connectés simultanément, les reprises après interruption et un paiement accepté.

**Protection entre pointage et Espace NFC non implémentée.** Pendant un
pointage, ne pas utiliser l'Espace NFC pour lire ou modifier des cartes,
commandes ou imports ; suspendre ou clôturer d'abord le pointage sur tous les
postes concernés. Le mode classique ne fournit pas non plus de verrou.
Un simple contrôle des boutons ou de l'état de la tablette ne suffit pas :
les lectures, les verdicts et les écritures peuvent encore se concurrencer.

La protection attendue doit donner la priorité au pointage avec un bail court
renouvelé, expirant après interruption, sans déblocage administratif. Une
opération NFC déjà engagée doit finir avant l'activation du pointage. Le contrôle
doit être atomique avec les écritures NFC et les pointages NFC, et préserver
la transmission des états et verdicts à ppTPE. À recetter : concurrence entre
postes, lecture déjà engagée, expiration et perte réseau, reprise d'un ancien
poste, ainsi que propagation des verdicts.

Les sections Windows ci-dessous décrivent des essais et décisions historiques ;
elles ne constituent plus des instructions d'installation ou de développement.

## Statut

Nouvelle baseline définie le 01/11/2026.

### Historique : commandes et session Windows du 16/11/2026

- Dans **Configuration > Pointage tournois**, le réglage
  **Autoriser le pointage par badgeuse NFC** (`nfc_check_in_active`) est
  désactivé par défaut. Il autorise la fonctionnalité indépendamment du tarif.
- Lorsque ce réglage est actif, le symbole **NFC** du bandeau de pointage ouvre
  le contrôle de la badgeuse : état ppNFC, état déclaré par Windows, test de
  lecture sans pointage, dernière lecture et activation/arrêt de la session.
  Sélectionner un tournoi à priorité Carte non clôturé démarre automatiquement
  la badgeuse, sans confirmation dans le panneau.
  Le bouton **NFC** intègre le voyant et l'état du lecteur, sans voyant
  **Lecteur** séparé. Si ppNFC ne fournit pas de sonde matérielle, la détection
  Windows reste orange avec **Éveil non vérifié**. La nouvelle sonde ACS
  différencie ce cas d'une réponse réelle du lecteur.
  Le voyant **Pointage** reste indépendant pour le cycle de lecture.
  Le pointage est bleu lorsqu'il est **Prêt**, orange pendant la vérification,
  vert si **Accepté** et rouge si **Refusé**. Le résultat reste affiché trois
  secondes, puis revient à **Prêt** si la session reste active. Une nouvelle
  carte relance immédiatement la vérification. Un refus métier ne modifie pas
  le voyant du lecteur. Une suspension ou un arrêt efface le résultat lumineux ;
  la dernière lecture reste consultable dans le panneau. Ces voyants sont
  purement visuels dans la page, sans pilotage Tuya ni commande matérielle.
  **Suspendre le pointage** reste respecté pour le tournoi affiché, même lors
  des mises à jour de la liste ; **Reprendre le pointage** réactive la lecture.
  Le panneau est affiché hors du cadre du tournoi et peut défiler si l'écran
  est trop bas, pour garder les commandes accessibles même avec peu de joueurs.
- En mode trace sys-conf, chaque résultat de pointage NFC ajoute un toast
  indiquant la confirmation ou le refus et l'UID lu. Ces toasts de diagnostic
  sont absents hors mode trace et pendant un simple test de lecture ; les
  alertes métier habituelles restent inchangées.
- Le diagnostic reste accessible en priorité Euro ou pour un tournoi verrouillé ;
  seule l'activation du pointage est interdite. La sonde ACS est une interrogation
  ponctuelle en lecture seule : elle ne réveille pas le lecteur et ne change aucun
  réglage.
- La session est **pilotée par la page fees-collector**, sur le même PC que ppNFC.
  Elle n'est ni autonome ni persistée : quitter la page, changer de tournoi,
  passer en priorité Euro, verrouiller le tournoi ou retirer l'autorisation
  globale interrompt les lectures. Un nouveau tournoi éligible démarre une
  nouvelle session après libération de l'ancienne. Le panneau peut être fermé sans arrêter
  la session. Une écriture déjà envoyée au backend peut néanmoins se terminer.
- La page demande successivement des lectures à la liaison locale ppNFC.
  Elle vérifie la carte et l'identité actuelle du membre, puis appelle le
  pointage partagé existant ; les crédits ne sont débités qu'à la clôture.
  Une autre acquisition en cours n'est pas reprise de force. Une erreur de
  liaison arrête la session et demande une nouvelle activation explicite.
- L'état `Ready` de PC/SC reste insuffisant pour prouver que le lecteur est
  physiquement éveillé. Le nouvel endpoint `/status` ajoute une interrogation
  ACS ponctuelle ; l'état affiché reste celui de l'instant du contrôle. La recette
  matérielle, les permissions du navigateur depuis l'URL HTTPS et les essais
  prolongés restent nécessaires.
- Essai utilisateur du 17/11/2026 sur localhost : lecteur alimenté par USB,
  voyants physiques éteints et état Windows disponible ; le test de lecture
  expire sans détecter de carte. Après appui sur le bouton latéral droit,
  les voyants vert, bleu et jaune s'allument et la carte est lue. Cet essai
  confirme que l'état Windows ne suffit pas ; il ne distingue pas la veille
  d'une extinction. Un délai de lecture seul ne modifie pas ce diagnostic.
- Sondes ponctuelles en lecture seule du 17/11/2026, via `SCardControl`
  sur le lecteur PICC exposé par le pilote ACS BLE : `Get PCD/PICC Status`
  (`E0 00 00 25 00`, manuel v2.02 §6.1.2) renvoie
  `E1 00 00 00 01 01` (**No PICC**) en 129 ms, puis 120 ms après environ
  dix minutes sans lecture de carte. `Get Firmware Version`
  (`E0 00 00 18 00`, §6.3.1) renvoie **ACR1555 FW 1.03.02** en 60 et
  63 ms. Les voyants sont restés allumés ; ppNFC continuait de surveiller
  le lecteur, mais le pointage était arrêté. Aucune configuration ni
  authentification n'a   été tentée. Ces commandes sont donc utilisables sur cette liaison lorsque le
  lecteur est réveillé ; voir le comparatif ci-dessous pour leur résultat avec
  les voyants éteints.
- Comparatif matériel suivant, le 17/11/2026 : avec toutes les LED éteintes,
  les mêmes deux commandes échouent en 13–15 ms avec `0x0000048F`
  (**Windows : périphérique non connecté**), alors que le nom PICC reste dans
  la liste PC/SC. Le bouton POWER a été maintenu environ trois secondes ;
  les LED verte, bleue et jaune se sont rallumées et les commandes ont répondu
  de nouveau : `No PICC` en 122 ms et firmware `1.03.02` en 38 ms. Ce test
  confirme que la sonde distingue le lecteur répondant du périphérique non
  connecté et que POWER le réactive dans cet essai. Les boutons sont identifiés
  par le schéma ACS (manuel utilisateur v1.07, p. 12) : face NFC vers soi,
  USB en haut, **MODE/Bluetooth à gauche**, **POWER ON/OFF à droite**. Ne pas
  confondre l'appui long MODE, qui peut basculer le mode USB/BLE, avec le réveil
  par POWER. L'état PC/SC `No PICC` signifie aucune carte, pas une erreur.
  Les commandes de statut/firmware ACS v2.02 sont documentées comme lecture
  sans authentification (§6.0, §6.1.2 et §6.3.1) ; aucune configuration n'a
  été changée.
- Intégration en cours : ppNFC `/status` interroge `Get PCD/PICC Status` à la
  demande et sérialise la commande avec la surveillance PC/SC. Le retour
  `No PICC` signifie que le lecteur répond sans carte ; l'erreur Windows
  `0x0000048F` est signalée comme lecteur non joignable. La page affiche la
  dernière réponse et son heure, sans polling périodique ; elle empêche
  l'activation du pointage si la sonde indique que le lecteur ne répond pas.
  Cette vérification n'établit pas à elle seule si le lecteur est en veille ou
  éteint.
- Validation locale du 17/11/2026 : build Angular de développement réussi,
  39 tests Angular ciblés réussis et build .NET de ppNFC/tests réussi sans
  avertissement. L'exécution des tests .NET reste bloquée par Windows
  Application Control (`0x800711C7`). Après redémarrage de ppNFC, `/status`
  ne renvoyait toujours pas `hardwareProbe` : le processus était l'ancien
  exécutable `dist\ppNFC\ppNFC.exe`. La nouvelle publication a été préparée
  séparément dans `dist\ppNFC-acs-probe\ppNFC.exe`, sans arrêter ni remplacer
  le processus en cours. Son lancement est bloqué par Smart App Control
  (exécutable non signé, sans réputation Microsoft ; l'ancien binaire du 14/11
  est accepté). Le fichier est soumis à Microsoft pour analyse. Chaque nouvelle
  publication non signée peut être bloquée de la même façon.
  Recette restante : lancer cette nouvelle version,
  vérifier `hardwareProbe` sur `/status`, puis tester les états lecteur allumé
  et éteint dans la page de tournoi.
- Validation locale : 56 tests Angular ciblés passent (commandes NFC,
  configuration, annulations, contrôles de pointage et gestion NFC existante).
  Le nouveau réglage a aussi été vérifié dans le navigateur, sans sauvegarder
  ni activer la badgeuse. Aucun essai physique de cette session n'est revendiqué.

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

### Validation de l'editeur du 13/11/2026

- En sandbox, deux cartes ont ete attribuees depuis l'admin. L'attribution a
  persiste apres actualisation ; desactivation et reactivation ont fonctionne.
- Le transfert d'une carte active a ete refuse. Apres desactivation, le
  transfert confirme vers un autre membre actif a reussi, puis la carte a ete
  reattribuee a son titulaire initial. Les deux cartes sont restees actives
  chez leurs titulaires respectifs apres reouverture des editeurs.
- L'annulation d'une lecture et le refus des confirmations de desactivation et
  de transfert ont ete verifies sans modification de la carte concernee.
- Le lecteur a du etre reactive avant de lire : les indications « Pret » dans
  ppNFC et « Online » dans l'outil ACS ne suffisaient pas a garantir une
  detection effective. Le lecteur etait branche sur un chargeur USB lors de
  l'incident : l'alimentation seule n'a donc pas suffi dans cet essai. La
  cause et la duree d'inactivite restent a determiner ; c'est bloquant pour
  l'exploitation sans intervention.
- Un test automatise simule le backend et l'identite pour rejouer l'attribution,
  le rechargement, la desactivation, le refus de transfert actif, le conflit
  d'edition et la reattribution, sans lecteur ni modification de la sandbox.
- L'expiration, la deconnexion pendant acquisition et l'usage depuis l'URL
  HTTPS hebergee restent a valider avec le materiel.
- Essai sur chargeur USB : apres 15 minutes sans lecture, une carte a ete lue
  sans action sur le bouton. Cet essai ne reproduit pas l'incident initial et
  ne valide pas encore la tenue sur plusieurs heures.
- Le manuel ACS v2.02 documente une veille reglable (60 secondes par defaut)
  et un reglage de desactivation de cette veille a partir du firmware 1.02.04.
  La lecture du firmware a retourne 1.03.02, mais la lecture du reglage de
  veille a renvoye `41`, valeur absente du tableau documente. Aucun reglage
  n'a ete modifie ; ne pas supposer que la veille est desactivee.

### Espace NFC - evolution du 14/11/2026

Observation utilisateur du 14/11 a 11:07 : hors charge USB-C, le lecteur
s'eteint apres inactivite, sans que ppNFC ni la verification de liaison ne
signalent cet etat. Le delai et la distinction veille/extinction restent a
mesurer. L'etat `Ready` actuel repose sur la presence du lecteur dans PC/SC
et l'absence de carte signalee par le pilote ; il ne prouve pas que le
lecteur physique est eveille. `/status` restitue cet etat, sans interrogation
materielle supplementaire. Priorite : identifier un controle ACS documente
sans carte pour distinguer liaison du pilote et disponibilite du lecteur,
puis valider la detection et les possibilites de reveil. Ne pas utiliser
l'absence de lecture ou un timeout comme preuve de veille, et ne pas envoyer
de commande de reglage non validee. Les essais de stock, commandes et imports
sont reportes a la reception des 158 cartes officielles.

Le perimetre inclut desormais une page admin **Adherents > cartes NFC /
badgeuse**, reservee aux administrateurs et au groupe Systeme :

- identification en lecture seule et recherche par nom, licence ou UID ;
- gestion centralisee des cartes, sans second editeur dans le repertoire ;
- resume informatif dans les parametres adherent et lien contextualise ;
- stock des cartes blanches, prets, restitution explicite, pertes et mise
  hors service, avec historique des changements ;
- demandes de cartes definitives, reference et quantite de la commande
  fournisseur (minimum 10), reception puis remise suivies separement ;
- imports Excel/CSV avec prevalidation, confirmation, rapports et reprise ;
- verification de la liaison locale ppNFC, etat du lecteur et lecture test.

Les parcours metier et l'orchestration des imports sont dans l'admin. Le
backend ne lit pas Excel et ne pilote pas les workflows : il controle les
droits, les formats, les invariants critiques et les versions, puis enregistre
les changements et leur historique dans une transaction DynamoDB.
ppNFC reste limite au materiel.

Ces sources doivent etre deployees en sandbox et la nouvelle interface testee
avec le lecteur avant validation fonctionnelle. Les essais du 13/11 concernent
l'ancien editeur, pas cette nouvelle page.

Validation locale du 14/11 : build Angular de developpement reussi,
33 tests Angular cibles reussis, 4 tests de persistance reussis et controle
TypeScript du handler reussi. ppNFC et son projet de tests compilent ; leur
execution est bloquee sur ce poste par la politique Windows de controle
d'applications (`0x800711C7`). Ne pas assimiler cette compilation a une
validation de l'endpoint `/status` en execution.

Recette restante apres deploiement :

Premiere verification apres deploiement sandbox du 14/11 : les quatre modeles
NFC figurent dans les sorties generees ; la page charge les deux cartes
existantes, leur consultation et le resume dans les parametres adherent
fonctionnent, ainsi que le retour filtre vers l'espace NFC. Aucune carte
n'a ete modifiee pendant cette verification. Le ppNFC en cours d'execution
repond 404 a `/status` : mise a jour de l'executable necessaire avant
validation du diagnostic. Les ecritures et les imports restent a recetter.

Apres publication et lancement manuel de la nouvelle version, verification
du 14/11 a 11:02 : la page admin joint ppNFC, affiche sa version `1.0.0.0`,
le lecteur ACS ACR1555U PICC en etat `Ready` et aucune acquisition en cours,
sans erreur. Avast avait bloque le lancement automatise via PowerShell ;
le lancement manuel a ete accepte sans desactivation des protections.
Cette verification valide `/status`. A 11:04, l'utilisateur confirme egalement
le fonctionnement de la lecture physique et de l'affichage du titulaire dans
l'espace NFC, en lecture seule. Les ecritures de gestion et les imports restent
a recetter.

- verifier les droits de la page et du resume, sans ouvrir les donnees NFC
  aux contributeurs ou membres ordinaires ;
- identifier les deux cartes existantes puis les classer explicitement ;
- enregistrer une blanche, la preter, la desactiver sans retour en stock,
  la restituer, puis la preter a un autre adherent ;
- verifier la persistance et l'historique apres actualisation ;
- prevalider un petit lot avec anomalies sans aucune ecriture, puis importer
  un lot valide, suspendre/reprendre et rejouer le meme fichier sans doublon ;
- enregistrer une demande, une commande d'au moins 10 cartes, une reception
  et une remise sans restitution implicite d'une blanche ;
- republier/relancer ppNFC, verifier `/status`, puis faire une lecture reelle
  depuis le poste de lecture et depuis l'origine HTTPS autorisee.

Les cartes historiques conservent leur attribution ; leur type n'est pas
devine. L'operateur les classe explicitement en carte blanche ou definitive.
Une desactivation ne rend jamais une carte disponible. La restitution physique
confirmee d'une blanche retire son titulaire et la remet en stock ; l'ancien
titulaire reste dans l'historique. La remise d'une carte definitive ne restitue
pas implicitement une blanche et ne desactive pas les autres cartes.

Le suivi des commandes enregistre une commande deja passee au fournisseur,
pas un achat automatique. La quantite est celle de la commande entiere,
au moins 10 ; plusieurs demandes peuvent partager sa reference. Ce minimum
n'est pas un seuil d'alerte du stock. Reception et remise restent explicites
apres l'import, pour ne pas confondre fichier fournisseur et remise physique.

Import v1 : une feuille XLSX ou CSV UTF-8, quatre colonnes texte dans cet ordre
`prenom`, `nom`, `licence`, `uid`. Maximum 500 cartes et 2 Mo par fichier ;
un lot trop volumineux pour conserver son rapport doit etre scinde. Licences
et UID doivent rester du texte pour conserver leurs zeros initiaux. La quantite
attendue doit etre saisie par l'operateur. Les ecarts de nom, doublons, licences
inconnues/ambigues, titulaires non actifs et cartes incompatibles bloquent le
demarrage. Les associations deja identiques sont ignorees, sans reactivation
ni transfert automatique. Chaque ligne et sa progression sont atomiques :
une interruption permet une reprise depuis les lots enregistres. Une erreur
de concurrence/reseau suspend l'import sans annoncer un succes ; actualiser
et reprendre. Les anomalies detectees en cours d'import sont consignees dans
le rapport ; un lot termine avec erreurs peut etre reimporte apres correction.

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

## Historique : objectif initial

Permettre aux joueurs de se pointer avec une carte NTAG213 attribuée à un membre.
ppNFC lit l'UID avec l'ACR1555U et le transmet à la page de pointage active.
La page applique les contrôles métier et enregistre le pointage partagé.
La restitution lumineuse sur la badgeuse reste une étape ultérieure.

Chaîne fonctionnelle :

`NTAG213 -> ACR1555U -> ppNFC local -> fees-collector -> backend (GameCheckIn)`

## Historique : architecture Windows initiale

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
- Transmet les UID demandés par la page de pointage via la liaison locale.
- Ne nécessite pas d'authentification backend propre dans ce mode piloté par la page.
- Ne porte pas les règles métier de pointage.

Le mode Bluetooth exact de l'ACR1555U reste à valider avec le matériel :

- Reader Mode est privilégié afin que ppNFC puisse recevoir les UID sans
  dépendre du focus Windows et surveiller la connexion ;
- HID est conservé comme solution de repli si Reader Mode n'est pas exploitable
  de manière fiable sous Windows.

La technologie de réalisation du `.exe` est .NET 10 / Windows Forms, choisie
pour l'intégration Windows, PC/SC et la zone de notification. Le démarrage
automatique est disponible dans le menu de l'icone.

### fees-collector et backend

- fees-collector sélectionne explicitement le tournoi et conserve une session
  locale tant que sa page reste ouverte et le pointage autorisé.
- ppNFC ne choisit jamais implicitement le tournoi.
- La page résout l'UID vers la carte et vérifie le membre actif inscrit au tournoi.
- Les contrôles métier restent ceux de fees-collector ; le backend conserve
  les contrôles indispensables et la persistance partagée existante.
- Sans session active, aucun badge ne peut être accepté.
- Le résultat métier est affiché dans le panneau NFC. Le retour à ppNFC
  pour piloter la signalétique reste à réaliser.

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
- Réserver le pointage NFC aux tournois à priorité de règlement par carte ; en priorité euro, le pointage reste manuel.

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

## Phase 0 bis - Prototype Android ACR1555U en Bluetooth

Branche `feature/nfc-android-prototype`, tablette Redmi Pad SE 8.7 (Android 16),
ACR1555U-A1 firmware 1.03.02, carte NTAG213 d'UID `04E50142E37384`.

- [x] Lire l'UID avec l'application ACS BLETest 0.6.2 (`FF CA 00 00 00`).
- [x] Lire sur batterie et sur chargeur USB secteur.
- [x] Lire après 40 minutes d'inactivité sur chargeur, liaison BLE continue.
- [x] Ajouter à ppTPE le plugin natif `AcrReader` et son panneau de diagnostic.
- [x] Valider ppTPE TEST avec le lecteur (UID affiché le 18/11/2026 à 10:01).
- [ ] Valider la coexistence avec le WisePad 3 (reporté : WisePad indisponible le 18/11/2026).
- [x] Réorganiser l'encart NFC de ppTPE : d'abord la liaison entre l'admin et
  ppTPE (fonction connectée : pointage ou gestion NFC, et état de la liaison),
  puis l'état du lecteur ACR1555U. Retirer le bouton de test du buzzer, sans
  retirer les bips par verdict. Rendu à vérifier sur la tablette.
- [x] Retirer le mode « ppNFC sur ce PC » et le prototype Windows de cette branche.
  La validation du WisePad 3 et de l'ACR1555U utilisés ensemble reste à faire.
- [ ] Détecter le blocage NFC décrit ci-dessous et inviter à redémarrer le lecteur.
- [ ] Reconnexion après redémarrage de ppTPE : le 18/11 à 11:43, la mise à jour
  de l'APK a coupé la liaison BLE et l'ACR1555U n'a plus émis d'annonce
  (aucun résultat de scan). À valider : un arrêt/redémarrage par POWER suffit-il,
  et faut-il un `disconnect` propre à l'arrêt de ppTPE pour l'éviter ?
  Le 20/11/2026, la reconnexion en rouvrant ppTPE TEST a réussi, l'ACR étant
  resté alimenté en USB plusieurs jours. Le scénario de mise à jour reste à valider.
  Le 24/11, ppTPE recherche l'ACR sans le trouver après une déconnexion BLE ;
  les permissions Bluetooth sont accordées. BLETest et nRF Connect ne l'ont pas
  trouvé non plus ; le scan nRF détectait d'autres appareils. Redémarrer l'ACR
  par POWER, puis désactiver et réactiver son mode Bluetooth par MODE n'a pas
  rétabli la détection. Le WisePad était aussi introuvable ; les deux recherches
  ppTPE ne recevaient aucune annonce correspondante, même après désactivation
  puis réactivation du Bluetooth Android. Après redémarrage de la tablette,
  l'utilisateur indique que les deux lecteurs sont connectés. Cause non
  déterminée ; lecture de carte non vérifiée à cette occasion.
- [x] Tester le buzzer de l'ACR depuis ppTPE TEST (20/11/2026, sur USB) :
  le bouton « Tester » a produit un bip court bien audible. Les motifs selon
  le verdict et l'audibilité en salle restent à valider.
- [x] Valider la lecture de carte depuis l'Espace NFC via la tablette.
  Le 20/11/2026, après ajout de la revérification de la demande dans AppSync,
  l'Espace NFC a affiché l'UID et reconnu une carte non enregistrée,
  sans pointage ni attribution.
- [x] Confirmer l'attribution dans l'Espace NFC sans rechargement manuel :
  l'admin décode le retour AWSJSON qui peut encapsuler la réponse JSON de la Lambda.
- [x] Relayer les lectures vers fees-collector et afficher son verdict sur ppTPE (code).
- [x] Valider le relais de bout en bout après déploiement du schéma (18/11/2026,
  sandbox, tournoi « COUPE DES CLUBS » : refus non-inscrit, acceptation,
  « déjà pointé », carte présentée pendant une suspension non transmise).
- [ ] Étudier les retours sonores (demande du 18/11/2026) :
  - [x] buzzer de l'ACR1555U piloté par ppTPE selon le verdict (`AcrReader.beep`,
    commande `E0 00 00 28 01 durée/10 ms`, manuel v2.02 §5.3.4) : accepté
    1 bip court, refusé 3 bips, carte lue 1 bip très court, non traitée 1 bip
    long ; activable dans ppTPE (`pptpe-acr-buzzer`). Volume à valider en salle ;
  - son sur la tablette selon le verdict (accepté / refusé), via le haut-parleur
    Android, avec un volume réglable dans ppTPE : pas encore implémenté.

Relais tablette → fees-collector (18/11/2026), via AppSync, sans liaison locale :
- `NfcReaderSession` (id = utilisateur Cognito de la tablette) : ppTPE y publie
  l'état du lecteur toutes les 15 s ; fees-collector y publie l'état de sa
  session de pointage (`collectorStatus`, tournoi) toutes les 15 s. Un état
  plus vieux que 45 s est considéré comme absent.
- `NfcScan` : ppTPE crée une lecture `pending` ; fees-collector la traite avec
  les contrôles existants puis écrit `accepted`/`refused` et le message, qui
  contient le nom du joueur. La tablette affiche « pas de réponse » après 10 s.
- Les deux tables sont purgées par TTL DynamoDB après environ 1 h.
- ppTPE ne publie qu'une fois connecté : utiliser de préférence un compte
  dédié à la tablette dans le groupe Support. Sans session de pointage active,
  la tablette n'envoie pas la carte et l'indique au joueur.
- Le panneau NFC de fees-collector utilise la **Tablette ppTPE** ; l'Espace
  NFC peut lire une carte sur la tablette pour l'attribuer (résultat
  `read`, sans pointage). Limite : si fees-collector pointe en même temps sur
  la même tablette, une carte lue pour l'Espace NFC est aussi soumise au pointage.
- En paysage, ppTPE affiche le TPE et la badgeuse côte à côte.
- Après modification du schéma : relancer la sandbox pour régénérer
  `amplify_outputs.json`, puis recompiler ppTPE TEST et fees-collector.

Essais du 18/11/2026 :
- Le chargeur USB secteur ne coupe ni le Bluetooth ni la lecture. Le Scan BLETest
  ne dure que 5 s et peut manquer les annonces du lecteur ; le plugin scanne 20 s.
- De 08:12 à 08:35, la liaison BLE fonctionnait mais aucune carte n'était
  détectée (`No card present`), même sur batterie. Un arrêt/redémarrage par
  POWER a rétabli la lecture. Cause non établie, non reproduite ensuite.
- Manuel utilisateur v1.07 p. 12 : vert fixe et bleu clignotant = détectable ;
  sinon MODE 3 s. Bleu fixe = connecté (p. 26). Orange et jaune non documentés.
- Le lecteur n'accepte qu'une connexion : fermer BLETest avant ppTPE TEST.

Installation du SDK ACS, propriétaire et non versionné : télécharger
`acssmcio-0.6.2-android21-20251203.zip` sur le site ACS, puis copier
`BLETest/app/libs/acssmcio-0.6.2.aar` et `smartcardio-0.1.7.aar` dans
`android/app/libs/`. Sans ces fichiers, la compilation Android échoue.

Compilation : Gradle 8.14.3 du wrapper avec un JDK 21 ; le JDK 25 d'Android
Studio et Gradle 9.6+ sont incompatibles avec le plugin Android du projet.
L'APK de débogage s'installe sous le nom « ppTPE TEST », à côté de ppTPE.

## Historique : phase 1 - Validation matérielle Windows

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

## Historique : phase 2 - Prototype ppNFC

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

## Phases historiques 3 à 7

Ces phases conservent le suivi initial ; leurs références à ppNFC ou à Windows
ne s'appliquent plus à l'architecture Android.

### Phase 3 - Attribution des cartes

- [x] Ajouter un modèle `MemberNfcCard`.
- [x] Enregistrer au minimum l'UID, le membre ou la licence, le statut, la date
  et l'auteur de l'attribution.
- [x] Garantir l'unicité de l'UID.
- [ ] Importer et valider en sandbox le lot fournisseur de 158 cartes avec
  la nouvelle interface (colonnes prenom, nom, licence et UID).
- [ ] Valider avec les donnees fournisseur la prevalidation des UID,
  licences, noms, doublons et ecarts de quantite.
- [ ] Valider les rapports et la reprise apres interruption.
- [x] Ajouter une interface d'attribution, désactivation, remplacement et
  réattribution contrôlée.
- [x] Valider ce parcours avec 2 ou 3 cartes blanches et l'éditeur admin.

Le modèle utilise l'UID comme clé primaire, le numéro de licence pour retrouver
les cartes d'un membre, un statut `ACTIVE` ou `DISABLED`, ainsi que la date et
l'auteur de l'attribution. Sa lecture et son écriture sont réservées aux
groupes `Systeme` et `Administrateur`.

La gestion est centralisee dans l'espace NFC pour ces deux groupes. Les
parametres adherent affichent un resume et un lien filtre sur sa licence.
**Lire une carte** demande la prochaine présentation
via une liaison locale sur le même PC, sans ouvrir le diagnostic ni copier
l'UID. L'enregistrement demande une confirmation distincte. Une carte active
doit être désactivée avant transfert à un autre titulaire ; aucune suppression
définitive n'est proposée. Les modifications utilisent une condition sur la
version et l'association lues pour refuser les mises à jour concurrentes.
Les attributions et réactivations vérifient que la licence correspond à un
unique membre explicitement `ACTIVE`.

L'import par script ponctuel est remplace par une ingestion de lots dans
l'espace NFC ; voir le perimetre et les limites du 14/11 ci-dessus.
La validation matérielle et la configuration des origines du navigateur sont décrites dans
le README du prototype Windows, retiré de cette branche.

### Phase 4 - Session de pointage

- [x] Autoriser globalement la badgeuse dans sys-conf ; démarrer automatiquement à la sélection d'un tournoi éligible.
- [x] Permettre à fees-collector d'activer une session locale pour un tournoi.
- [x] N'activer la session NFC qu'en priorité carte et la désactiver si le tournoi passe en priorité euro.
- [x] Associer chaque lecture au tournoi actif dans la page, sans session autonome ppNFC.
- [x] Arrêter les lectures en quittant la page ou si les conditions d'activation changent.
- [x] Refuser le pointage lorsqu'aucune session locale n'est active.
- [x] Afficher dans fees-collector l'état et les commandes de la badgeuse.

Le choix du mode piloté par la page remplace la publication d'une session
autonome à ppNFC. Il n'y a pas de nouveau modèle backend de session.

### Phase 5 - Intégration métier

- [x] Résoudre l'UID vers la licence du membre.
- [x] Exiger un membre explicitement `ACTIVE` ; refuser les membres
  `ARCHIVED`, `BANNED` ou dont le statut est absent/invalide, indépendamment
  du statut de licence FFB.
- [x] Vérifier que le joueur est inscrit au tournoi actif.
- [x] Réutiliser le traitement métier existant de `checkInByNfc`.
- [x] Refuser les pointages de source NFC en priorité euro dans le traitement métier partagé, sans bloquer le choix manuel de la carte.
- [x] Conserver les contrôles de crédits de carte de jeu.
- [x] Respecter les pointages manuels et l'état de clôture du tournoi.
- [x] Créer ou actualiser le `GameCheckIn`.
- [x] Synchroniser le résultat en temps réel dans fees-collector.
- [ ] Retourner à ppNFC un résultat explicite et stable.

### Phase 6 - Validation du pointage sans signalisation lumineuse

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

### Phase 7 - Signalisation lumineuse et validation finale

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
