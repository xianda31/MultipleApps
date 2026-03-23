# 🚀 Deployment & Setup Guide - Stripe E-commerce Integration

Ce guide couuvre le déploiement complet et la configuration de l'intégration Stripe pour votre système d'e-commerce.

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Configuration Stripe](#configuration-stripe)
3. [Configuration AWS & Amplify](#configuration-aws--amplify)
4. [Déploiement](#déploiement)
5. [Configuration webhooks](#configuration-webhooks)
6. [Tests](#tests)
7. [Production](#production)
8. [Dépannage](#dépannage)

---

## Prérequis

### Avant de commencer, assurez-vous d'avoir :

- ✅ Un compte Stripe (gratuit) : https://dashboard.stripe.com
- ✅ AWS Amplify configuré et déployé
- ✅ Node.js v18+ installé localement
- ✅ AWS CLI configuré avec les bonnes credentials
- ✅ Accès au repository code source
- ✅ Un domain ou ngrok pour tester les webhooks localement

---

## Configuration Stripe

### Étape 1 : Créer un compte Stripe

1. Allez sur https://dashboard.stripe.com
2. Complétez votre profil commercial
3. Acceptez les conditions de service

### Étape 2 : Récupérer les API keys

1. Connectez-vous au dashboard Stripe
2. Allez à **Developers** → **API keys**
3. Vous verrez 2 clés :
   - **Publishable Key** : commence par `pk_test_` ou `pk_live_`
   - **Secret Key** : commence par `sk_test_` ou `sk_live_`

> ⚠️ **SÉCURITÉ** : Ne partagez JAMAIS la Secret Key publiquement !

### Étape 3 : Récupérer le Webhook Signing Secret

Ce secret sera généré après [configuration des webhooks](#configuration-des-webhooks-stripe).

---

## Configuration AWS & Amplify

### Étape 1 : Ajouter les variables d'environnement

Créez/mettez à jour `amplify/.env.local` :

```bash
# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_SECRET_HERE  # À remplir après création du webhook
```

> **NOTE** : Ce fichier ne doit PAS être commité dans git (ajoutez-le à `.gitignore`)

### Étape 2 : Configurer les variables d'environnement Amplify

```bash
cd amplify/functions/stripe-checkout
cat > .env.local << EOF
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
EOF

cd ../stripe-webhooks
cat > .env.local << EOF
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_SECRET_HERE
EOF
```

---

## Déploiement

### Étape 1 : Déployer le backend Amplify

```bash
# À la racine du projet
cd c:/Users/chrre/Develop/MultipleApps

# Installer les dépendances des Lambda functions
npm install -w amplify/functions/stripe-checkout
npm install -w amplify/functions/stripe-webhooks

# Déployer l'infrastructure Amplify
amplify deploy

# Le système demandera confirmation des changements
# Sélectionnez "Yes" pour déployer
```

**Output attendu :**
```
✓ Deployed backend: amplify [xxxxxxxx]
✓ Stripe-Checkout Lambda URL: https://xxxxxxxxx.lambda-url.region.on.aws/
✓ Stripe-Webhooks Lambda URL: https://xxxxxxxxx.lambda-url.region.on.aws/
```

### Étape 2 : Récupérer les URLs des Lambdas

Après déploiement, récupérez les URLs des fonctions Lambda :

```bash
# Les URLs sont affichées dans le résumé Amplify deploy
# Format: https://xxxxx.lambda-url.us-east-1.on.aws/
```

---

## Configuration des Webhooks Stripe

### Étape 1 : Créer le Webhook

1. Connectez-vous au dashboard Stripe
2. Allez à **Developers** → **Webhooks**
3. Cliquez sur **"Add endpoint"**
4. Remplissez :
   - **URL** : `https://xxxxx.lambda-url.region.on.aws/` (URL du Lambda stripe-webhooks)
   - **Version API** : Laissez par défaut (dernière version)
5. Cliquez **"Select events to send"**
6. Sélectionnez ces événements :
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `charge.failed`
   - `charge.refunded`

### Étape 2 : Récupérer le Webhook Secret

1. Après création du webhook, cliquez dessus pour voir les détails
2. Scrollez jusqu'à **"Signing secret"**
3. Cliquez sur **"Reveal"**
4. Copiez la clé (commence par `whsec_`)

### Étape 3 : Ajouter le secret à Amplify

```bash
# Sauvegardez dans amplify/.env.local ET dans les variables de déploiement
STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_SECRET_HERE

# Redéployez pour mettre à jour les variables d'environnement Lambda
amplify deploy
```

---

## Tests

### Test Local avec Postman/cURL

#### Créer une session de paiement

```bash
curl -X POST http://localhost:3000/api/stripe/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "productIds": ["prod-id-1", "prod-id-2"],
    "quantities": [1, 2],
    "successUrl": "http://localhost:4200/front/checkout-success",
    "cancelUrl": "http://localhost:4200/front/checkout-cancel"
  }'
```

**Réponse attendue :**
```json
{
  "sessionId": "cs_test_xxxxxx",
  "sessionUrl": "https://checkout.stripe.com/pay/cs_test_xxxxxx"
}
```

### Test avec Stripe CLI (Pour webhooks)

```bash
# Installer Stripe CLI
# https://stripe.com/docs/stripe-cli

# Vous authentifier
stripe login

# Écouter les webhooks en local
stripe listen --forward-to http://localhost:3000/api/stripe/webhooks

# Copier le Webhook Secret affiché et l'ajouter à .env.local
```

### Test des Webhooks

```bash
# Envoyer un événement de test
stripe trigger checkout.session.completed --add checkout_session:metadata="userId=test-user"
```

### Test dans le Navigateur

1. Accédez à `http://localhost:4200/front/shop`
2. Ajoutez des produits au panier
3. Cliquez **"Passer la commande"**
4. Utilisez une carte de test Stripe :

#### Cartes de test (Sandbox)

| Carte | Numéro | Résultat |
|-------|--------|----------|
| Succès | `4242 4242 4242 4242` | ✅ Paiement approuvé |
| Déclinée | `4000 0000 0000 0002` | ❌ Carte déclinée |
| Authentification | `4000 0025 0000 3155` | 🔐 Authentification requise |
| Pas de fonds | `4000 0000 0000 9995` | ❌ Fonds insuffisants |

**Pour tous les tests :**
- Expiration : N'importe quelle date future (ex: 12/25)
- CVC : N'importe quel code 3 chiffres (ex: 123)
- Nom : N'importe quel nom

### Vérifier la Base de Données

Après un paiement réussi :

```bash
# Vérifier les transactions Stripe dans DynamoDB
aws dynamodb scan \
  --table-name='StripeTransaction' \
  --region=us-east-1

# Ou utiliser la console AWS
# Services → DynamoDB → Tables → Chercher "StripeTransaction"
```

---

## Production

### Avant de passer à la production

**CHECKLIST :**

- ⚠️ Basculer à des clés API **LIVE** (commencent par `pk_live_` et `sk_live_`)
- ⚠️ Tester complètement avec des clés LIVE (les montants réels ne sont pas débités)
- ✅ Configurer HTTPS/SSL (Amplify le fait automatiquement)
- ✅ Configurer le webhook production
- ✅ Mettre à jour les URLs de succès/annulation vers le domaine production
- ✅ Tester les emails de confirmation
- ✅ Activer les logs CloudWatch pour debugging
- ✅ Configurer les alertes CloudWatch pour les erreurs Lambda

### Étapes de Transition

#### Étape 1 : Mettre à jour les clés API

```bash
# Dans amplify/.env.local
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_KEY
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_KEY
STRIPE_WEBHOOK_SECRET=whsec_live_YOUR_LIVE_SECRET
```

#### Étape 2 : Créer le webhook production

Répétez [Configuration des Webhooks](#configuration-des-webhooks-stripe) avec :
- L'URL Lambda production
- Les clés API **LIVE**

#### Étape 3 : Déployer

```bash
amplify deploy
```

#### Étape 4 : Tester avec une vraie carte

Utilisez une vraie carte bancaire pour un petit montant. Vérifiez que :
- ✅ La transaction s'affiche dans le dashboard Stripe
- ✅ Le webhooks est reçu
- ✅ La base de données est mise à jour
- ✅ L'email de confirmation est envoyé

---

## Dépannage

### Erreur : "Invalid Stripe API Key"

**Cause :** Variables d'environnement non correctement configurées

```bash
# Vérifier les variables
echo $STRIPE_SECRET_KEY

# Redéployer
amplify deploy
```

### Erreur : "Webhook signature verification failed"

**Cause :** STRIPE_WEBHOOK_SECRET incorrect

```bash
# Vérifier dans le dashboard Stripe que le secret est correct
# Et que le secret dans .env.local correspond
```

### Erreur : "Product not found" au checkout

**Cause :** Les IDs produits dans le panier ne correspondent pas aux IDs en base

```bash
# Vérifier dans DynamoDB que les produits existent
aws dynamodb get-item \
  --table-name='Product' \
  --key='{ "id": {"S": "your-product-id"} }' \
  --region=us-east-1
```

### Erreur 502 ou 504 (Lambda timeout)

**Cause :** La Lambda met trop de temps à répondre (> 30 secondes)

```bash
# Vérifier les logs CloudWatch
aws logs tail /aws/lambda/stripe-checkout --follow
```

### Webhooks non reçus

**Checklist :**

1. ✅ Le webhook est configuré dans le dashboard Stripe
2. ✅ L'URL est accessible publiquement (pas d'authentification)
3. ✅ Le Webhook Secret est correct
4. ✅ Les événements sélectionnés sont corrects
5. ✅ Vérifier les logs du webhook dans le dashboard Stripe

---

## Logs & Monitoring

### Voir les logs Lambda

```bash
# Stripe-Checkout Lambda
aws logs tail /aws/lambda/stripe-checkout --follow

# Stripe-Webhooks Lambda
aws logs tail /aws/lambda/stripe-webhooks --follow
```

### Dashboard Stripe - Monitoring

- **Developers** → **Events** : Tous les webhooks reçus
- **Developers** → **Logs** : Les erreurs d'API Stripe

### CloudWatch Dashboard

```bash
# Créer un dashboard pour monitorer les Lambdas
# AWS Console → CloudWatch → Dashboards → Create dashboard
# Ajouter des graphs pour :
# - Invocations Lambda
# - Errors Lambda
# - Duration moyenne
# - Throttling
```

---

## Questions Fréquentes

### Q: Mes montants sont-ils en centimes ou en euros ?

**R:** En centimes dans la base de données et l'API Stripe. Les UI affichent automatiquement en euros avec le formatage correct.

```javascript
// Exemple
100 centimes = 1,00 EUR
9999 centimes = 99,99 EUR
```

### Q: Les cartes de test fonctionnent-elles en production ?

**R:** Non. Les cartes de test ne fonctionnent qu'en Sandbox. Les vraies cartes peuvent être utilisées en production.

### Q: Combien de temps avant que les fonds arrivent ?

**R:** Dépend de votre configuration bancaire Stripe. Délai typique : 1-3 jours ouvrables.

### Q: Puis-je tester les webhooks en local ?

**R:** Oui, avec Stripe CLI :

```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhooks
stripe trigger checkout.session.completed
```

### Q: Que se passe-t-il si le webhook échoue ?

**R:** Stripe réessaye automatiquement pendant 3 jours. Vérifiez les logs dans Developers → Webhooks → History → Select endpoint

---

## Support

- 📖 Docs Stripe : https://stripe.com/docs
- 🐛 rapport les bugs : Utilisez GitHub Issues
- 💬 Chat support : Contactez votre équipe support

---

**Dernière mise à jour :** 2024-01-15  
**Version Stripe API :** Latest  
**Node.js :** v18+
