# ppTPE — Test e2e sandbox ↔ prod (WisePad3)

## Architecture

```
Admin web (sandbox)          ppTPE TEST (.debug APK)
amplify_outputs.json         isTest: true / tpe_simulated: false
sandbox AppSync ──────────── sandbox AppSync
sandbox Lambda               sandbox Lambda
STRIPE_SECRET_KEY=sk_test_…  connexion-token → sk_test_…
                             WisePad3 (firmware TEST)
```

Transactions visibles dans **Stripe Dashboard → Test mode → Payments / Terminal**.

---

## Basculer en mode TEST (sandbox + WP3 test)

### 1. Configurer l'environnement de développement

Dans `projects/pptpe/src/environments/environment.development.ts` :
```typescript
tpe_simulated: false,   // WP3 physique BLE
tpe_isTest: true,
tpe_location_id: 'tml_GgeMgAM0xIX5YQ',  // location Stripe test
```

### 2. Appliquer le patch BT (obligatoire — resetté par npm install)

```powershell
.\scripts\patch-stripe-terminal-android.ps1
```

Ce patch corrige `BluetoothDiscoveryConfiguration(0, isTest=true)` →
`BluetoothDiscoveryConfiguration(0, isSimulated=false)` pour que le SDK
découvre le WP3 physique et non les lecteurs simulés.

> ⚠️ **Note SDK v5.x** : Les lecteurs simulés (chipper2X, stripeM2, wisePad3Sim,
> S700) sont **tous cassés** en v5.x à cause d'un bug `readMethodFromTlv` dans
> `BaseSimulatedAdapter.updatePaymentIntent`. Le contournement
> (`updatePaymentIntent=false`) cause une autre erreur (`emv_data required`)
> lors de `confirmPaymentIntent`. Seul le WP3 **physique** avec `isTest=true`
> fonctionne en sandbox.

### 3. Construire et installer

```powershell
.\scripts\deploy-pptpe-local-install.ps1 -BuildApk
```

### 4. Firmware WisePad3 (première fois seulement)

Au premier `connectReader` après bascule live→test, le WP3 télécharge le
firmware de test (~10 min, barre de progression sur le reader). Les fois
suivantes : connexion immédiate.

### 5. Vérifier la session (adb logcat)

```
[ppTPE] StripeTerminal.initialize() appelé (isTest: true )
```

---

## Revenir en mode PROD (WP3 live)

```powershell
.\scripts\deploy-pptpe-local-install.ps1 -BuildApk -Prod -Release
```

Le fichier `amplify_outputs.json` bascule automatiquement sur les endpoints
prod le temps du build (backup/restore). Le WP3 re-flash le firmware live
au premier `connectReader` (~10 min).

---

## Clés Stripe par environnement

| Environnement | SSM path | Valeur |
|---|---|---|
| Sandbox | `/amplify/multipleapps/chrre-sandbox-bbca7e7f8c/STRIPE_SECRET_KEY` | `sk_test_51…` |
| Prod | `/amplify/multipleapps/master/STRIPE_SECRET_KEY` | `sk_live_…` |

> ⚠️ Utiliser `aws ssm put-parameter` directement (pas `ampx sandbox secret set`
> qui écrit au mauvais chemin). Après changement SSM, toucher les handlers
> Lambda pour forcer un redéploiement (les secrets sont résolus au déploiement,
> pas au runtime).

---

## Packages Android installés simultanément

| Icône | Package | Build | Environnement |
|---|---|---|---|
| Rouge "ppTPE TEST" | `fr.bridgeclubsaintorens.pptpe.debug` | `assembleDebug` | sandbox / test |
| Normal "ppTPE" | `fr.bridgeclubsaintorens.pptpe` | `assembleRelease` | prod / live |

Les deux APKs coexistent sur la tablette. Le WP3 ne peut être en firmware
test ou live, pas les deux à la fois.

---

## Prérequis

- adb installé et tablette en mode développeur
- Profil AWS `amplify-dev` configuré (pour génération des outputs prod)
- WisePad3 allumé et à portée BLE lors du scan (30s timeout)
