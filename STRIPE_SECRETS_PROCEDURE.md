# Procédure : Mise à jour des secrets Stripe dans Amplify

## ⚠️ Piège connu
`ampx sandbox secret set` **sans `--identifier`** écrit dans le mauvais path SSM
(ex: `chrre-sandbox-bbca7e7f8c` au lieu de `toto-sandbox-7be7f8659d`).
→ **Toujours utiliser `aws ssm put-parameter` directement.**

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
