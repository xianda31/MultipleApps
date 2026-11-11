# ppNFC - Prototype ACR Windows

Application Windows .NET 10 / Windows Forms en zone de notification.
Ce prototype lit les UID de cartes ISO 14443-A via l'ACR1555U en mode Reader
et le pilote ACS BLE PC/SC.

Il ne contient aucun appel au backend, aucune attribution de carte, aucun
pointage metier et aucune commande lumineuse ou sonore. La methode de buzzer
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
memoire. Aucun journal n'est ecrit sur disque et aucune donnee n'est envoyee.

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
connexion, la deduplication et les reponses UID malformees.

## Deploiement sur le PC du club

Aucun installateur n'est fourni : on copie l'executable autonome
(`dist\ppNFC\ppNFC.exe`, environ 116 Mo, runtime .NET inclus). Windows 10 ou 11
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
