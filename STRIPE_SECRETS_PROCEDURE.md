# Configuration Stripe — Guide complet

Compte Stripe : **Bridge Club de Saint-Orens** (`acct_1TUT9cEZzRSlmbmG`)
URL Dashboard : https://dashboard.stripe.com/acct_1TUT9cEZzRSlmbmG

---

## 1. Récupérer les clés API Stripe

### Clés de test (sandbox / dev)
1. Se connecter au Dashboard Stripe
2. Activer **Mode test** (toggle en haut à gauche)
3. Aller dans **Développeurs → Clés API**
4. Copier :
   - **Clé publiable** : `pk_test_51TUT9c...` → `STRIPE_PUBLISHABLE_KEY`
   - **Clé secrète** : `sk_test_51TUT9c...` → `STRIPE_SECRET_KEY`

### Clés live (production)
Même démarche, mais avec le **Mode live** (toggle désactivé).
Les clés commencent par `pk_live_` et `sk_live_`.

---

## 2. Configurer le webhook Stripe

### URL de l'endpoint
| Environnement | URL |
|---|---|
| Sandbox / Dev | `https://z3rkjs1mak.execute-api.eu-west-3.amazonaws.com/api/stripe/webhooks` |
| Production | `https://<API_GW_PROD>.execute-api.eu-west-3.amazonaws.com/api/stripe/webhooks` |

> L'URL prod se trouve dans `amplify_outputs.json` après déploiement production
> (`endpoint` sous la clé `custom`).

### Créer l'endpoint dans Stripe Dashboard
1. **Mode test** (ou live selon l'env) → **Développeurs → Webhooks**
2. Cliquer **"Ajouter une destination"**
3. Sélectionner les événements :
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Type de destination : **Webhook**
5. Saisir l'URL ci-dessus
6. Créer → cliquer sur l'endpoint créé → **"Secret de signature" → Révéler**
7. Copier le `whsec_...` → `STRIPE_WEBHOOK_SECRET`

---

## 3. Mettre à jour les secrets SSM

### ⚠️ Piège connu
`ampx sandbox secret set` **sans `--identifier`** écrit dans le mauvais path SSM.
→ **Toujours utiliser `aws ssm put-parameter` directement.**

### Trouver le path SSM exact

```powershell
aws ssm describe-parameters --profile amplify-dev `
  --parameter-filters "Key=Path,Option=Recursive,Values=/amplify/multipleapps" `
  --query "Parameters[].Name" --output table
```

### Sandbox (clés `sk_test_` / `pk_test_`)
Path actuel : `/amplify/multipleapps/toto-sandbox-7be7f8659d/`

```powershell
aws ssm put-parameter `
  --name "/amplify/multipleapps/toto-sandbox-7be7f8659d/STRIPE_SECRET_KEY" `
  --value "sk_test_..." --type SecureString --overwrite --profile amplify-dev

aws ssm put-parameter `
  --name "/amplify/multipleapps/toto-sandbox-7be7f8659d/STRIPE_PUBLISHABLE_KEY" `
  --value "pk_test_..." --type SecureString --overwrite --profile amplify-dev

aws ssm put-parameter `
  --name "/amplify/multipleapps/toto-sandbox-7be7f8659d/STRIPE_WEBHOOK_SECRET" `
  --value "whsec_..." --type SecureString --overwrite --profile amplify-dev
```

### Production (clés `sk_live_` / `pk_live_`)
Récupérer le `<BRANCH_ID>` prod via la commande "Trouver le path" avec `--profile amplify-prod`.

```powershell
aws ssm put-parameter `
  --name "/amplify/multipleapps/<BRANCH_ID>/STRIPE_SECRET_KEY" `
  --value "sk_live_..." --type SecureString --overwrite --profile amplify-prod

aws ssm put-parameter `
  --name "/amplify/multipleapps/<BRANCH_ID>/STRIPE_PUBLISHABLE_KEY" `
  --value "pk_live_..." --type SecureString --overwrite --profile amplify-prod

aws ssm put-parameter `
  --name "/amplify/multipleapps/<BRANCH_ID>/STRIPE_WEBHOOK_SECRET" `
  --value "whsec_..." --type SecureString --overwrite --profile amplify-prod
```

---

## 4. Vérifier les secrets en SSM

```powershell
aws ssm get-parameter `
  --name "/amplify/multipleapps/toto-sandbox-7be7f8659d/STRIPE_SECRET_KEY" `
  --with-decryption --profile amplify-dev `
  --query "Parameter.{Value:Value,Version:Version}"
```

---

## 5. Déclencher le redéploiement des Lambdas

> Les secrets sont résolus **au déploiement**, pas au runtime.
> Un changement SSM seul ne suffit pas.

### Sandbox (mode watch actif)
```powershell
(Get-Item "amplify\functions\stripe-webhooks\handler.ts").LastWriteTime = Get-Date
(Get-Item "amplify\functions\stripe-checkout\handler.ts").LastWriteTime = Get-Date
(Get-Item "amplify\functions\stripe-connection-token\handler.ts").LastWriteTime = Get-Date
```
Le sandbox détecte les changements et redéploie automatiquement.

### Production
```bash
git push origin main
```
Amplify CI/CD redéploie toutes les Lambdas avec les nouveaux secrets.

---

## 6. Activer le paiement TPE (flag en base)

Dans l'app admin → **Sys-Conf** → toggle **"Paiement TPE"** → Sauvegarder.

| Flag | Effet |
|---|---|
| `tpe_payment_active = true` | Affiche le bouton TPE dans le shop |
| `environment.tpe_simulated = true` | Dev : reader virtuel Stripe (pas de hardware requis) |
| `environment.tpe_simulated = false` | Prod : WisePad 3 via Bluetooth LE (Electron requis) |

---

## 7. Valeurs actuelles (mai 2026)

| Paramètre | Valeur |
|---|---|
| Compte Stripe | `acct_1TUT9cEZzRSlmbmG` — Bridge Club de Saint-Orens |
| SSM sandbox | `/amplify/multipleapps/toto-sandbox-7be7f8659d/` |
| API Gateway sandbox | `https://z3rkjs1mak.execute-api.eu-west-3.amazonaws.com/` |
| `pk_test_` (sandbox) | `pk_test_51TUT9cEZzRSlmbmGgSAK7jO...` |
| Webhook secret (sandbox) | `whsec_5gKv63VECUa4fbiEljNrnKJzALKSFQvs` |

---

## 1. Trouver le path SSM exact

```powershell
aws ssm describe-parameters --profile amplify-dev `
  --parameter-filters "Key=Path,Option=Recursive,Values=/amplify/multipleapps" `
  --query "Parameters[].Name" --output table
```

---

## 2. Mettre à jour les secrets

### Sandbox (clés `sk_test_` / `pk_test_`)

```powershell
aws ssm put-parameter `
  --name "/amplify/multipleapps/toto-sandbox-7be7f8659d/STRIPE_SECRET_KEY" `
  --value "sk_test_..." --type SecureString --overwrite --profile amplify-dev

aws ssm put-parameter `
  --name "/amplify/multipleapps/toto-sandbox-7be7f8659d/STRIPE_PUBLISHABLE_KEY" `
  --value "pk_test_..." --type SecureString --overwrite --profile amplify-dev

aws ssm put-parameter `
  --name "/amplify/multipleapps/toto-sandbox-7be7f8659d/STRIPE_WEBHOOK_SECRET" `
  --value "whsec_..." --type SecureString --overwrite --profile amplify-dev
```

### Production (clés `sk_live_` / `pk_live_`)

Remplacer `toto-sandbox-7be7f8659d` par le nom du branch prod
(récupéré à l'étape 1) et `--profile amplify-dev` par `--profile amplify-prod`.

```powershell
aws ssm put-parameter `
  --name "/amplify/multipleapps/<BRANCH_ID>/STRIPE_SECRET_KEY" `
  --value "sk_live_..." --type SecureString --overwrite --profile amplify-prod

aws ssm put-parameter `
  --name "/amplify/multipleapps/<BRANCH_ID>/STRIPE_PUBLISHABLE_KEY" `
  --value "pk_live_..." --type SecureString --overwrite --profile amplify-prod

aws ssm put-parameter `
  --name "/amplify/multipleapps/<BRANCH_ID>/STRIPE_WEBHOOK_SECRET" `
  --value "whsec_..." --type SecureString --overwrite --profile amplify-prod
```

---

## 3. Vérifier

```powershell
aws ssm get-parameter `
  --name "/amplify/multipleapps/<BRANCH_ID>/STRIPE_SECRET_KEY" `
  --with-decryption --profile amplify-dev `
  --query "Parameter.{Value:Value,Version:Version}"
```

---

## 4. Déclencher le redéploiement

> Les secrets sont résolus **au déploiement**, pas au runtime.
> Un changement SSM seul ne suffit pas — il faut redéployer.

### Sandbox
Modifier un fichier Lambda (ex: ajouter un commentaire dans `handler.ts`)
→ le sandbox en mode watch détecte le changement et redéploie automatiquement.

### Production
```bash
git push origin main
```
→ Amplify CI/CD redéploie les Lambdas avec les nouveaux secrets.

---

## 5. Confirmer le bon compte Stripe

Après un paiement test, vérifier que la transaction apparaît bien dans
le dashboard Stripe du bon compte (vérifier l'URL : `acct_1TE8mq...`).
