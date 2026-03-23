# Stripe Integration - Documentation Sécurité

## Architecture sécurisée

```
Frontend (Angular)
    ↓
FrontCartService (gestion panier UI)
    ↓
StripeService (appel Lambda)
    ↓
Lambda Stripe-Checkout (🔒 VALIDATION STRICTE)
    ↓
Amplify Data (récupère vrais produits + prix)
    ↓
Stripe API (création session)
    ↓
Stripe Checkout (paiement)
    ↓
Stripe Webhooks → Lambda Webhook Handler
    ↓
DynamoDB StripeTransaction (enregistrement)
```

## 🔒 Principaux points de sécurité

### 1. **Validation des montants CÔTÉ SERVEUR**
- ❌ JAMAIS faire confiance aux prix du client
- ✅ Lambda récupère les produits depuis DynamoDB
- ✅ Recalcule les montants avec les vraies données

**Code clé** (`stripe-checkout/handler.ts`):
```typescript
// Récupérer les vrais produits depuis la DB
const { data: product } = await dbHandler.models.Product.get({ id: productId });
// Vérifier le produit existe et est actif
// Utiliser le prix de la DB, PAS celui du client
```

### 2. **Signature des webhooks Stripe**
- ✅ Valide la signature Stripe pour prouver que c'est vraiment Stripe
- ❌ N'accepte JAMAIS de webhook sans signature valide

**Code clé** (`stripe-webhooks/handler.ts`):
```typescript
const event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
// Lance une exception si la signature est invalide
```

### 3. **Clés Stripe en variables d'env**
- ✅ Secret Key en variable d'env sur Lambda (jamais en code)
- ✅ Publishable Key côté client seulement  
- ❌ Jamais secret key côté frontend

**File**: `amplify/functions/stripe-{checkout,webhooks}/resource.ts`

### 4. **Pas de manipulation d'IDs de session**
- ✅ Client ne peut pas modifier la sessionId
- ✅ Montants vérifiés côté serveur avant création session

## ⚙️ Mise en place

### 1. Créer compte Stripe
https://dashboard.stripe.com/register

### 2. Récupérer les clés API
- Aller à Settings → API Keys
- Copier :
  - `STRIPE_SECRET_KEY` (secret)
  - `STRIPE_PUBLISHABLE_KEY` (public)

### 3. Configurer les variables d'env
```bash
# Dans .env.local ou AWS Secrets Manager
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_... # Récupéré après)
```

### 4. Déployer Amplify
```bash
ampx sandbox
# Ou
amplify deploy
```

### 5. Configurer les webhooks Stripe
- Aller à Settings → Webhooks
- Ajouter un endpoint:
  - URL: `https://<votre-api-gateway-url>/api/stripe/webhooks`
  - Events: 
    - `checkout.session.completed`
    - `checkout.session.async_payment_succeeded`
    - `checkout.session.async_payment_failed`
    - `charge.refunded`
    - `charge.failed`
- Copier la clé de signature (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`
- Re-déployer Amplify avec cette clé

### 6. Ajouter StripeTransaction au modèle Amplify
✅ Déjà fait dans `amplify/data/resource.ts`

## 🧪 Test local

### 1. Tester le paiement en sandbox
```bash
# URL Stripe Checkout lors du test
# Utilisez une carte de test
Numéro: 4242 4242 4242 4242
Expiration: Futur (ex. 12/25)
CVC: Tout 3 chiffres
```

### 2. Tester les webhooks
```bash
# Installez stripe-cli
curl -X GET https://api.stripe.com/v1/events \
  -u sk_test_...:
# Puis utilisez stripe-cli pour relancer les événements
```

## 📊 Monitoring

### DynamoDB
- Table `StripeTransaction` enregistre tous les paiements
- Statuts: `pending`, `completed`, `failed`
- Query par email pour historique client

### CloudWatch Logs
- Lambda logs pour debugging
- Rechercher: "Stripe Checkout Handler", "Stripe Webhooks Handler"

## 🚨 Erreurs courantes

### "Invalid signature"
❌ Clé `STRIPE_WEBHOOK_SECRET` incorrecte ou manquante
✅ Re-configurer depuis dashboard Stripe

### "Product not found"
❌ L'ID produit n'existe pas en DB, ou le produit est inactif
✅ Vérifier dans DynamoDB que le produit existe et `active=true`

### "Mismatch between product IDs and quantities"
❌ Côté frontend, nombres d'IDs ≠ nombres de quantités
✅ Vérifier `FrontCartService.getCheckoutPayload()`

## 🔐 Checklist déploiement production

- [ ] Variables d'env configurées (SECRET keys)
- [ ] Webhook Stripe configuré avec bonne URL
- [ ] DynamoDB `StripeTransaction` table créée
- [ ] Permissions IAM: Lambda peut lire `Product` table
- [ ] Logs CloudWatch en place pour audit
- [ ] Email confirmation implémenté (optional)
- [ ] Facture automatique implémentée (optional)

## 📝 Logs d'audit

Chaque paiement est enregistré dans:
1. **DynamoDB** `StripeTransaction` table
2. **CloudWatch** Lambda logs (avec montants)
3. **Stripe Dashboard** (source de vérité)

Pour audit complet: faire jonction sur `stripeSessionId`.
