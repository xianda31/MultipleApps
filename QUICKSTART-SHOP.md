# 🚀 QUICK START - Stripe Integration

## ⏱️ TL;DR (Trop long à lire)

Vous avez une **intégration Stripe 100% sécurisée** prête à déployer. Voici les étapes immédiatement :

---

## Étape 1 : Créer compte Stripe (5 mins)

```
👉 Aller sur: https://dashboard.stripe.com
   - Cliquer "Create your account"
   - Remplir email + mot de passe
   - [EMAIL VERIFICATION]
   - Complétez le profil business
   ✅ Vous avez maintenant accès au dashboard
```

---

## Étape 2 : Obtenir les clés API (2 mins)

```
Dans dashboard Stripe:

1. Développeurs → API keys
2. Chercher:
   - Publishable Key: pk_test_XXXXXXXXXXX
   - Secret Key:      sk_test_XXXXXXXXXXX
3. Copier les deux quelque part sûr
```

---

## Étape 3 : Configurer Amplify (3 mins)

```bash
cd c:/Users/chrre/Develop/MultipleApps

# Créer fichier .env.local dans racine du projet
cat > amplify/.env.local << EOF
STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXX
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_test_XXXXXXXXXXX
EOF

# TODO (Phase 2): STRIPE_WEBHOOK_SECRET à remplir après webhooks créés

# Vérifier les variables sont là
cat amplify/.env.local
```

---

## Étape 4 : Déployer le Backend (10 mins)

```bash
# À la racine du projet
cd c:/Users/chrre/Develop/MultipleApps

# Installer les dépendances Lambda
npm install -w amplify/functions/stripe-checkout
npm install -w amplify/functions/stripe-webhooks

# Déployer tout
amplify deploy

# Le système demande confirmation - Taper: yes
# ⏳ Attendre 5-10 minutes...
# ✅ À la fin, vous verrez:
#    Deployment successful!
#    Lambda URLs affichées

# 📝 COPIER les URLs Lambda affichées (vous en aurez besoin à l'étape suivante)
```

---

## Étape 5 : Configurer Webhook Stripe (5 mins)

```
Dans dashboard Stripe:

1. Développeurs → Webhooks
2. "Add endpoint"
3. Coller URL Lambda stripe-webhooks:
   https://xxxxxx.lambda-url.us-east-1.on.aws/
   
4. "Select events to send":
   ✅ checkout.session.completed
   ✅ checkout.session.async_payment_succeeded
   ✅ checkout.session.async_payment_failed
   ✅ charge.failed
   ✅ charge.refunded

5. Cliquer "Add events"

6. Une fois créé, cliquer sur le webhook
7. Chercher "Signing secret"
8. Cliquer "Reveal"
9. Copier: whsec_test_XXXXXXXXXXX
```

---

## Étape 6 : Ajouter le Webhook Secret (3 mins)

```bash
# Mettre à jour amplify/.env.local
cat >> amplify/.env.local << EOF
STRIPE_WEBHOOK_SECRET=whsec_test_XXXXXXXXXXX
EOF

# Redéployer pour appliquer
amplify deploy

# ✅ Backend maintenant complètement prêt !
```

---

## Étape 7 : Tester (10 mins)

```bash
# Démarrer l'app (si pas déjà running)
npm start

# Naviguer vers:
http://localhost:4200/front/shop

# Ajouter un produit au panier
# Cliquer "Passer la commande"
# Remplir avec carte test: 4242 4242 4242 4242
# Expiration: 12/25
# CVC: 123

# ✅ Devrait rediriger vers page succès
```

---

## 📁 Fichiers créés / modifiés

### À connaître :

| Fichier | Type | Rôle |
|---------|------|------|
| `src/app/front/shop/*` | Composants | Affichage boutique + panier |
| `src/app/front/services/stripe*` | Services | Communication avec serveur |
| `amplify/functions/stripe-*` | Lambdas | Validation + webhooks |
| `STRIPE_SECURITY.md` | Doc | Explique la sécurité 🔒 |
| `DEPLOYMENT.md` | Doc | Guide complet déploiement |
| `README-SHOP.md` | Doc | Architecture générale |
| `CHECKLIST-SHOP.md` | Doc | Checklist déploiement |

### À ne pas toucher :

- ❌ `amplify/.env.local` (pas committer en git)
- ❌ Les clés API (jamais les exposer)

---

## 🧪 Cartes de test Stripe (Sandbox)

| Résultat | Numéro | Reste |
|----------|--------|-------|
| ✅ Succès | `4242 4242 4242 4242` | Fonctionne normalement |
| ❌ Déclinée | `4000 0000 0000 0002` | Rejetée par Stripe |
| 🔐 Authentification | `4000 0025 0000 3155` | Demande code secret |
| ❌ Pas de fonds | `4000 0000 0000 9995` | Fonds insuffisants |

**Pour toutes :** 
- Expiration : N'importe quelle date future (ex: 12/25)
- CVC : N'importe quel 3 chiffres (ex: 123)
- Nom : N'importe quel nom

---

## ✅ Checklist rapide

```
[ ] Compte Stripe créé
[ ] Clés API copiées
[ ] .env.local configuré
[ ] amplify deploy exécuté
[ ] Webhook créé dans Stripe
[ ] Webhook secret ajouté
[ ] amplify deploy exécuté (2eme fois)
[ ] Test en local : http://localhost:4200/front/shop
[ ] Panier fonctionne
[ ] Checkout fonctionne
[ ] Page succès apparaît
[ ] Transaction visible en BDD (optionnel mais cool)
```

---

## 🆘 Je suis bloqué...

### Erreur : "Invalid Stripe API Key"

```bash
# Vérifier que les clés sont correctes
cat amplify/.env.local

# Redéployer
amplify deploy
```

### Erreur : "Webhook signature verification failed"

```bash
# Vérifier dans Stripe dashboard que le secret correspond
# Puis:
amplify deploy
```

### "Module not found" erreurs au déploiement

```bash
# Réinstaller les dépendances
npm install -w amplify/functions/stripe-checkout
npm install -w amplify/functions/stripe-webhooks

# Redéployer
amplify deploy
```

### Panier vide / Produits pas affichés

```bash
# Vérifier que ProductService retourne des produits
# Aller dans back-office et créer un produit test
# Recharger page shop
```

---

## 📚 Documentation complète

- 🔒 **Sécurité** : Voir `STRIPE_SECURITY.md`
- 🚀 **Déploiement complet** : Voir `DEPLOYMENT.md`
- 🏗️ **Architecture** : Voir `README-SHOP.md`
- ✅ **Checklist détaillée** : Voir `CHECKLIST-SHOP.md`

---

## 💡 Points importants

1. ✅ **Backend vérifie TOUT** - Pas de confiance au client
2. 🔒 **Sekrets jamais en git** - utilisez `.env.local`
3. 📱 **Mobile friendly** - Design responsive inclus
4. 🎨 **Moderne & joli** - Animations, gradients, etc.
5. 🔐 **Webhooks signés** - Pas de faux paiements

---

## 🎯 Prochaines étapes après premiers tests

1. ✅ Valider en sandbox (ce que vous faites là)
2. Passer à clés **LIVE** (après tests complets)
3. Tests avec vraie carte (petit montant)
4. Monitoring CloudWatch configuré
5. Support utilisateurs formé

---

## 📞 Besoin d'aide ?

- Problèmes Stripe : https://support.stripe.com
- Problèmes AWS/Amplify : https://docs.amplify.aws
- Problèmes Tech : Vérifier CloudWatch logs

---

**Status** : 🟢 Prêt à déployer  
**Temps estimé** : 30-45 mins (étapes 1-6)  
**Complexité** : Basse (copy-paste surtout)

**GO !! 🚀🚀🚀**
