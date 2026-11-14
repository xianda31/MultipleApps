# ppNFC - Prototype ACR Windows

Application Windows .NET 10 / Windows Forms en zone de notification.
Ce prototype lit les UID de cartes ISO 14443-A via l'ACR1555U en mode Reader
et le pilote ACS BLE PC/SC.

Il ne contient aucun appel au backend, aucun pointage metier et aucune commande
lumineuse ou sonore. L'editeur de cartes de l'admin peut lui demander une
acquisition d'UID via une liaison locale ; l'association au membre est
enregistree par l'admin, jamais par ppNFC. La methode de buzzer
du lecteur partage reste reservee au diagnostic PowerShell historique.

## Utilisation

1. Installer le pilote ACS BLE PC/SC et ajouter le lecteur en mode Reader
   dans Bluetooth Reader Management Tool.
2. Fermer QuickView et les diagnostics PowerShell avant de lancer ppNFC.
3. Executer `dist\ppNFC\ppNFC.exe` depuis la racine du depot apres publication.
4. Presenter une carte. L'UID et le compteur apparaissent dans le diagnostic.
5. Fermer ou masquer la fenetre pour conserver la lecture en arriere-plan.
   Double-cliquer sur l'icone de notification pour rouvrir le diagnostic.
6. Utiliser **Quitter ppNFC**, ou **Quitter** dans le menu de l'icone, pour arreter
   le lecteur et liberer les ressources PC/SC.

La fenetre s'ouvre au demarrage de ce prototype. Le menu de l'icone de
notification permet d'activer ou desactiver **Demarrer avec Windows** pour
l'utilisateur courant, sans droits administrateur. Une seule instance est
autorisee par session.

Une carte maintenue devant le lecteur ne produit qu'une lecture. Il faut la
retirer avant de la representer. Une nouvelle presentation du meme UID moins
d'une seconde apres la lecture precedente est ignoree ; un UID different
n'est pas bloque par ce delai.

Les indisponibilites du lecteur et du service PC/SC sont affichees. Le prototype
retente automatiquement la connexion, sans limite de dix secondes contrairement
au diagnostic PowerShell. Apres une erreur, retirer la carte avant de la
representer : une carte restee en place ne doit pas produire un faux pointage.
Si plusieurs ACR1555 PICC sont connectes, une erreur explicite demande de n'en
conserver qu'un ; le prototype ne choisit pas arbitrairement un lecteur.

Le journal de diagnostic conserve uniquement les 200 derniers changements en
memoire. Aucun journal n'est ecrit sur disque. Un UID n'est transmis que si un
editeur local autorise demande explicitement une nouvelle lecture.

## Espace NFC dans l'admin

L'admin et ppNFC doivent tourner sur le meme PC. Un utilisateur `Systeme` ou
`Administrateur` ouvre **Adherents > cartes NFC / badgeuse**, puis **Lire une
carte**. Les parametres adherent contiennent un resume et un lien vers cette
page filtre sur sa licence ; il n'y a plus d'editeur NFC par ligne du repertoire.
Presenter une carte apres avoir clique ; une carte deja posee doit etre retiree
puis representee. L'UID apparait automatiquement dans le navigateur, sans ouvrir
le diagnostic ppNFC, sans presse-papiers et sans pointage.

La lecture ne sauvegarde rien : le titulaire, la licence et le statut sont
affiches en lecture seule. L'utilisateur confirme separement toute attribution.
Les cartes sont desactivees, jamais supprimees par l'editeur. Pour reattribuer
une carte definitive a une autre personne, la desactiver puis choisir le nouveau
titulaire et confirmer. Une carte blanche doit etre restituee et remise en
stock avant un nouveau pret ; desactiver n'est pas restituer.
La reactivation et l'attribution sont reservees aux membres explicitement
`ACTIVE`. Plusieurs cartes peuvent etre associees a une licence ; l'attribution
d'une nouvelle carte ne desactive pas implicitement une carte existante.

Le volet **Poste de lecture** verifie separement la liaison HTTP locale et
l'etat du lecteur. Il utilise `POST /status` avec les memes controles d'origine
et d'en-tete que `/capture`. Cette reponse contient la version de ppNFC, l'etat,
le nom et le message du lecteur, et indique si une acquisition est en cours.
Elle ne renvoie pas l'UID memorise et ne declenche pas de lecture. Une ancienne
version de ppNFC doit etre republiee et relancee pour fournir cet endpoint.
Un etat « Pret » n'est pas une preuve de detection : effectuer une lecture
reelle, sans pointage, depuis ce meme volet.

Les parcours de stock, commandes et imports sont decrits dans
[le plan NFC](../../TODO-NFC.md). Leur logique est dans l'admin, pas dans ppNFC.

### Autoriser le site admin

La liaison HTTP ecoute uniquement sur `127.0.0.1:17835`, pas sur le reseau local.
Par defaut, seul `http://localhost:4200` est autorise.
Pour un site heberge ou un autre port de developpement, creer le fichier
`%LOCALAPPDATA%\ppNFC\editor-origins.json`, puis relancer ppNFC. Exemple :

```json
[
  "http://localhost:4200",
  "https://admin.example.test"
]
```

Remplacer l'exemple par l'origine exacte de l'admin (protocole, nom d'hote et
port eventuel, sans chemin ni slash final). Seules les origines HTTPS ou HTTP
de boucle locale sont acceptees ; aucun joker n'est autorise. Le navigateur
peut demander l'autorisation d'acceder au reseau local : l'accorder au site
admin de confiance. Aucun jeton Cognito ni secret AWS n'est transmis a ppNFC.

Le service accepte uniquement une acquisition a la fois et exige une requete
`POST /capture`, une origine autorisee et l'en-tete `X-ppNFC-Editor: 1`.
Il ne fournit aucun acces a la derniere lecture memorisee. L'attente expire
apres 30 secondes ; fermer l'editeur ou annuler la lecture libere l'acquisition.
Une deconnexion du lecteur fait echouer la lecture, sans UID de secours.
Les reponses UID ne sont pas mises en cache.

Si le port est occupe ou la configuration invalide, ppNFC affiche une erreur
explicite ; le lecteur et le diagnostic restent utilisables. Il faut corriger
la configuration ou le conflit de port puis relancer ppNFC pour retablir
l'editeur.

## Construction et tests

Depuis la racine du depot, avec le SDK .NET 10 sous Windows :

```powershell
dotnet build .\desktop\ppNFC\ppNFC.csproj -c Release
dotnet test .\desktop\ppNFC.Tests\ppNFC.Tests.csproj -c Release
dotnet publish .\desktop\ppNFC\ppNFC.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o .\dist\ppNFC
```

La publication embarque le runtime : le poste d'exploitation n'a pas besoin du
SDK ni d'une installation globale de .NET. Le pilote ACS reste necessaire.
L'executable n'est pas signe et aucun installateur n'est fourni a ce stade.

Le lecteur natif [PcscReader.cs](./PcscReader.cs) est partage avec
[le diagnostic PowerShell](../../scripts/test-nfc-reader.ps1). Sa syntaxe reste
compatible avec `Add-Type` sous Windows PowerShell.

### Abstraction du lecteur

[INfcReader](./INfcReader.cs) est le contrat utilise par l'application :
`Current` expose l'etat et la derniere lecture, `Updated` signale les changements,
`Tick(now)` effectue un cycle de surveillance et `Dispose()` libere le lecteur.
Les appels a `Tick` sont serialises sur la tache de fond ; l'application l'arrete
avant d'appeler `Dispose`. Les evenements sont emis sur cette meme tache puis
transmis au thread graphique par l'application.

[ReaderMonitor](./ReaderMonitor.cs) est l'implementation PC/SC de ce contrat :
il conserve la selection ACR1555 PICC, la reconnexion et la deduplication.
`IPcscReader` reste le contrat technique de bas niveau, partage avec le diagnostic
PowerShell. Seule la construction du lecteur dans `TrayContext` choisit PC/SC ;
la surveillance et l'affichage utilisent le contrat independant du transport.
Aucune implementation HID n'est ajoutee.

Les tests sans materiel couvrent le contrat `INfcReader`, les transitions de
connexion, la deduplication, les reponses UID malformees, l'acquisition fraiche,
son annulation/expiration, l'exclusion entre editeurs et la liaison HTTP locale
(origines, preflight, entete obligatoire, arret et retour d'un UID).

Essais a rejouer avec le materiel pour l'editeur :

- Lire puis attribuer 2 ou 3 cartes blanches depuis le navigateur, diagnostic
  ppNFC masque ; verifier l'association et sa persistance apres reouverture.
- Verifier qu'une carte posee avant **Lire** n'est pas reutilisee.
- Annuler, fermer l'editeur et attendre l'expiration sans presenter de carte.
- Desactiver/reactiver une carte et transferer une carte desactivee a un autre
  adherent ; verifier que le transfert d'une carte active est refuse.
- Eteindre le lecteur pendant l'acquisition, puis le rallumer et reessayer.
- Tester depuis l'URL HTTPS hebergee apres configuration des origines et
  autorisation du navigateur pour les connexions locales.

## Deploiement sur le PC du club

Aucun installateur n'est fourni : on copie l'executable autonome
(`dist\ppNFC\ppNFC.exe`, environ 144 Mo, runtimes .NET et ASP.NET Core inclus).
Windows 10 ou 11
en 64 bits est requis. Le deploiement n'a pas encore ete essaye sur le PC du club.

Prerequis sur le PC du club :

1. Bluetooth compatible BLE.
2. Pilote ACS BLE PC/SC et Bluetooth Reader Management Tool.
3. Lecteur appaire en mode Reader, visible comme
   « ACR1555 1S CL Reader (BLE) ». Il ne doit etre appaire qu'a un seul PC.
4. Aucun autre programme utilisant le lecteur (QuickView, diagnostic PowerShell).

Procedure :

1. Publier si le code a change (commande de la section precedente).
2. Copier `ppNFC.exe`, de preference par cle USB, dans un dossier fixe, par
   exemple `C:\ppNFC\`.
3. Installer le pilote ACS, appairer le lecteur en mode Reader et verifier la
   detection de la carte dans QuickView.
4. Lancer `ppNFC.exe` et verifier qu'une carte presentee s'affiche dans le
   diagnostic.
5. Dans le menu de l'icone ppNFC, cocher **Demarrer avec Windows** pour lancer
   l'application automatiquement a l'ouverture de session. La commande est
   enregistree dans la cle de demarrage de l'utilisateur courant ; la decocher
   pour desactiver ce lancement.

Points d'attention :

- **SmartScreen** : l'executable n'est pas signe. Si le fichier a ete telecharge,
  Windows peut afficher « Windows a protege votre ordinateur » : choisir
  *Informations complementaires* puis *Executer quand meme*.
- **Antivirus** : un executable non signe peut etre signale ; l'autoriser
  explicitement si necessaire.
- **Controle d'applications** : si le PC applique AppLocker, WDAC ou Smart App
  Control, l'executable peut etre refuse (`0x800711C7`). Ne pas desactiver la
  protection ; faire autoriser le fichier ou le signer. Une signature de code
  reconnue est payante.
- **Sons Windows** : des sons de connexion/deconnexion de peripherique peuvent
  accompagner la presentation ou le retrait d'une carte. Ils ne viennent pas de
  ppNFC et peuvent etre coupes dans les parametres de son Windows.

## Validation au 13/11/2026 - Editeur de cartes

- En sandbox, deux cartes ont ete attribuees depuis l'admin. La persistance
  apres actualisation, la desactivation et la reactivation ont ete confirmees.
- Le transfert d'une carte active a ete refuse ; apres desactivation, son
  transfert confirme a reussi, puis elle a ete rendue a son titulaire initial.
  Les deux cartes sont actives chez leurs titulaires apres reouverture.
- L'annulation d'une lecture et le refus des confirmations de desactivation et
  de transfert ont ete verifies.
- Le lecteur a du etre reactive avant de detecter une carte alors que ppNFC
  indiquait « Pret » et l'outil ACS « Online ». Ces etats ne suffisent donc
  pas a etablir que la lecture fonctionne. Il etait branche sur un chargeur
  USB lors de l'incident ; la cause et la duree d'inactivite restent a
  determiner avant exploitation sans intervention.
- Un essai ulterieur sur chargeur USB a permis une lecture sans reveil manuel
  apres 15 minutes d'inactivite ; la tenue sur plusieurs heures reste a tester.
  Le manuel ACS v2.02 documente une veille reglable, mais la lecture du reglage
  sur ce lecteur a renvoye `41`, valeur non documentee. Le firmware lu est
  1.03.02. Aucun reglage du lecteur n'a ete modifie.
- Un test automatise du service simule le backend et l'identite pour rejouer
  le cycle d'attribution et de reattribution sans lecteur ni sandbox.
- L'expiration, la deconnexion pendant acquisition et l'usage depuis l'URL
  HTTPS hebergee restent a valider avec le materiel.

## Validation au 11/11/2026 - Editeur de cartes

- Les 36 tests .NET passent, y compris les echanges HTTP sur boucle locale.
- Les 23 tests Angular cibles passent dans Chrome Headless : lecture sans
  sauvegarde implicite, confirmation, annulation, desactivation/reactivation,
  transfert controle, erreurs, pagination et acces depuis le repertoire.
- Le build Angular de developpement et la publication autonome win-x64
  reussissent. La publication embarque aussi ASP.NET Core pour la liaison locale.
- L'executable publie n'a pas ete relance et le parcours complet avec lecteur
  reel / sauvegarde dans la sandbox reste a valider manuellement.

## Validation au 10/11/2026

- La compilation Release du prototype reussit.
- Le lecteur partage reste compilable par PowerShell et liste le lecteur reel.
- Les essais PowerShell ont confirme les UID de 7 octets et un second scan apres
  extinction/rallumage. Dix presentations lentes sont passees sans avertissement.
- Un premier lancement des tests .NET avait ete bloque au chargement de
  `ppNFC.dll` par la strategie de controle d'application Windows (`0x800711C7`).
- Le 10/11/2026, sur le poste de test, apres reinstallation du SDK .NET 10.0.403,
  les 20 tests unitaires passent et `dist\ppNFC\ppNFC.exe` (publie en
  autonome) demarre et affiche la fenetre de diagnostic. Aucune protection
  Windows n'a ete modifiee.
- Les lectures reelles dans ppNFC ont ete validees manuellement le 10/11/2026
  (voir ci-dessous).
- Apres introduction de `INfcReader`, la compilation Release et les 22 tests
  unitaires passent. Les essais materiels ci-dessous n'ont pas ete rejoues
  apres cette refactorisation.
- Windows joue parfois deux sons de peripherique a la presentation ou au
  retrait de la carte. Ils ne viennent pas de ppNFC (aucun son dans le code) ;
  ils sont juges acceptables et peuvent etre coupes dans les parametres de son
  Windows (connexion/deconnexion de peripherique).

## Essais materiels dans ppNFC (10/11/2026)

Valides manuellement, resultat conforme :

- Lire 20 presentations consecutives sans UID tronque ni erreur.
- Maintenir une carte en place et verifier que le compteur ne progresse pas.
- Retirer puis representer la carte et verifier une seule nouvelle lecture.
- Comparer l'UID au prototype Android.
- Eteindre/rallumer l'ACR et verifier la reprise sans relancer ppNFC.
- Lancer ppNFC sans lecteur puis allumer le lecteur.
- Verifier la lecture lorsque la fenetre est masquee et que le focus est dans
  une autre application.
- Verifier la fermeture propre et la liberation du lecteur.
