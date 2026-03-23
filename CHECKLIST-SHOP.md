# 📋 Stripe Integration - Implementation Checklist

## Phase 1 : Configuration Initiale (Jour 1-2)

### [ ] Compte Stripe créé
- [ ] Créer compte sur https://dashboard.stripe.com
- [ ] Compléter informations professionnelles
- [ ] Accepter conditions de service
- [ ] Dashboard accessible

### [ ] API Keys récupérées (Mode TEST)
- [ ] Aller à Developers → API keys
- [ ] Copier `pk_test_XXXXXXXXXXX`
- [ ] Copier `sk_test_XXXXXXXXXXX`
- [ ] Stocker dans document sécurisé (password manager)

### [ ] Variables Amplify configurées
- [ ] Créer `amplify/.env.local`
- [ ] Ajouter `STRIPE_PUBLISHABLE_KEY=pk_test_XXX`
- [ ] Ajouter `STRIPE_SECRET_KEY=sk_test_XXX`
- [ ] Vérifier dans `.gitignore` (ne pas commiter)
- [ ] Tester en local : `echo $STRIPE_SECRET_KEY`

### [ ] Backend déployé
- [ ] `npm install` (si pas fait)
- [ ] `amplify deploy`
- [ ] Attendre validation (~5-10 min)
- [ ] ✅ Voir "Deployment successful"
- [ ] Copier URLs Lambda affichées

---

## Phase 2 : Configuration Webhooks (Jour 3)

### [ ] Webhook Endpoint créé
- [ ] Dashboard Stripe → Developers → Webhooks
- [ ] Cliquer "Add endpoint"
- [ ] Coller URL Lambda stripe-webhooks
- [ ] Vérifier format: `https://xxxxx.lambda-url.region.on.aws/`
- [ ] Cliquer "Select events to send"

### [ ] Événements sélectionnés (6 au minimum)
- [ ] ✅ `checkout.session.completed`
- [ ] ✅ `checkout.session.async_payment_succeeded`
- [ ] ✅ `checkout.session.async_payment_failed`
- [ ] ✅ `charge.failed`
- [ ] ✅ `charge.refunded`
- [ ] Cliquer "Add events"

### [ ] Webhook Secret copié
- [ ] Après création, cliquer sur le webhook
- [ ] Scrollez jusqu'à "Signing secret"
- [ ] Cliquer "Reveal"
- [ ] Copier `whsec_test_XXXXXXXXXXX`
- [ ] Ajouter à `amplify/.env.local` : `STRIPE_WEBHOOK_SECRET=whsec_test_XXX`

### [ ] Backend redéployé avec secret
- [ ] `amplify deploy`
- [ ] Attendre confirmation
- [ ] Vérifier dans AWS Secrets Manager (Amplify console)

---

## Phase 3 : Tests Locaux (Jour 4)

### [ ] Application stockée start
- [ ] npm start (terminal 1)
- [ ] Attendre "Listening on port 4200"

### [ ] Frontend accessible
- [ ] http://localhost:4200
- [ ] Pas d'erreurs console
- [ ] Identifier l'app correctement

### [ ] Page shop accessible
- [ ] Naviguer vers `/front/shop`
- [ ] Voir liste de produits
- [ ] Voir panier sur la droite (responsive)

### [ ] Test d'ajout au panier
- [ ] Cliquer "Ajouter au panier" sur un produit
- [ ] Toast success affiché
- [ ] Produit visible dans le panier
- [ ] Quantité peut être modifiée
- [ ] Total recalculé correctement

### [ ] Test de checkout
- [ ] Panier a 2-3 produits
- [ ] Cliquer "Passer la commande"
- [ ] Redirect vers Stripe Checkout
- [ ] Page de paiement charge
- [ ] Stripe logo visible

### [ ] Test de paiement (Carte test)
- [ ] Entrer détails carte : `4242 4242 4242 4242`
- [ ] Expiration : `12/25` ou future
- [ ] CVC : `123` (n'importe quel 3 chiffres)
- [ ] Nom : n'importe quel nom
- [ ] Cliquer "Pay"
- [ ] Voir écran "Payment succeeded"

### [ ] Vérifier page success
- [ ] URL = `http://localhost:4200/front/checkout-success?session_id=cs_test_XXX`
- [ ] Message "Paiement réussi" visible
- [ ] Checkmark animation affichée
- [ ] Bouton "Retourner à la boutique" cliquable

### [ ] Vérifier transaction en BDD
- [ ] TBD : Accéder à DynamoDB (AWS Console → DynamoDB)
- [ ] Chercher table `StripeTransaction`
- [ ] Voir enregistrement avec sessionId correct
- [ ] Vérifier `status: completed`
- [ ] Vérifier montant en centimes

### [ ] Test d'annulation
- [ ] Retourner à /front/shop
- [ ] Ajouter un produit
- [ ] Cliquer "Passer la commande"
- [ ] Sur page Stripe : cliquer "Back to..." (haut gauche)
- [ ] Redirect vers `/checkout-cancel`
- [ ] Message d'annulation visible
- [ ] Panier toujours rempli (permettre réessai)

---

## Phase 4 : Tests avec Stripe CLI (Optionnel - Jour 5)

### [ ] Stripe CLI installée
- [ ] Télécharger depuis https://stripe.com/docs/stripe-cli
- [ ] `stripe --version` affiche version
- [ ] Fonctionnalité disponible en terminal

### [ ] Stripe CLI authentifiée
- [ ] `stripe login`
- [ ] Autoriser via navigateur
- [ ] Copier API key temporaire dans terminal
- [ ] Voir "✓ Your credentials have been saved"

### [ ] Webhooks écoutés en local
- [ ] Terminal 2 : `stripe listen --forward-to http://localhost:3000/api/stripe/webhooks`
- [ ] Voir "Ready!" et webhook secret affiché
- [ ] Copier secret : `STRIPE_WEBHOOK_SECRET=whsec_test_XXXXX`
- [ ] Ajouter à `.env.local`
- [ ] Redéployer avec `amplify deploy`

### [ ] Webhook test envoyé
- [ ] Terminal 3 : `stripe trigger checkout.session.completed`
- [ ] Voir dans terminal 2 : "Received checkout.session.completed"
- [ ] Aucune erreur affichée
- [ ] Webhook traité correctement

---

## Phase 5 : Intégration Front-Back (Jour 6)

### [ ] Produits achetables créés
- [ ] Dans back-office admin
- [ ] Créer 2-3 produits pour test
- [ ] Définir prix (en centimes dans BDD)
- [ ] Marquer comme "achetable" (si champ existe)

### [ ] ProductService retourne les bons produits
- [ ] Vérifier service retourne produits achetables
- [ ] Vérifier montants en centimes

### [ ] Email de confirmation (Optionnel)
- [ ] Si MailingApiService existe
- [ ] Ajouter integration dans stripe-webhooks/handler.ts
- [ ] Envoyer email après succès

### [ ] Facture/Invoice (Optionnel)
- [ ] Générer PDF après paiement
- [ ] Stocker dans S3 via Amplify Storage
- [ ] Envoyer lien dans email

---

## Phase 6 : Sécurité & Hardening (Jour 7)

### [ ] Code Review
- [ ] Lire `STRIPE_SECURITY.md`
- [ ] Vérifier aucun secret en hardcoded
- [ ] Vérifier validation côté serveur pour tous les montants
- [ ] Vérifier signature webhook validée

### [ ] Tests de sécurité
- [ ] Tenter modifier montant dans network inspector → ❌ Rejeté (validation serveur)
- [ ] Tenter replay webhook sans signature → ❌ Rejeté
- [ ] Tenter avec Secret Key invalide → ❌ Erreur API Stripe

### [ ] HTTPS forcé
- [ ] Vérifier app charge uniquement HTTPS
- [ ] Pas de mixed content warnings

### [ ] Logs configurés
- [ ] CloudWatch logs visibles pour lambdas
- [ ] Pas de secrets dans logs
- [ ] Erreurs captées et loggées

---

## Phase 7 : Documentation (Jour 8)

### [ ] README mis à jour
- [ ] Ajouter section "E-commerce / Shop"
- [ ] Lier vers DEPLOYMENT.md
- [ ] Lier vers STRIPE_SECURITY.md

### [ ] Runbook créé pour ops
- [ ] Comment déployer nouvelles versions
- [ ] Comment monitorer erreurs
- [ ] Comment gérer remboursements
- [ ] Contacts escalade

### [ ] Documentation Team
- [ ] Architecture expliquée à l'équipe
- [ ] Montrer comment tests

---

## Phase 8 : Passage en Production (Semaine 2)

### ⚠️ IMPORTANT : NE PAS IGNORER

### [ ] Backup effectué
- [ ] Backup base de données avant prod
- [ ] Backup code dans git (tag release)
- [ ] Plan de rollback documenté

### [ ] Clés API LIVE obtenues
- [ ] Dans dashboard Stripe
- [ ] Clés commencent par `pk_live_` et `sk_live_`
- [ ] Copier et sauvegarder securely

### [ ] Test avec vraie carte (Sandbox LIVE)
- [ ] Amplify `.env.local` mise à jour avec clés LIVE
- [ ] `amplify deploy` avec clés LIVE
- [ ] Tester workflow complet
- [ ] Vérifier transaction dans dashboard Stripe

### [ ] Webhook production créé
- [ ] Dashboard Stripe → Webhooks
- [ ] Add endpoint avec URL Lambda production
- [ ] Vérifier même liste d'événements
- [ ] Copier webhook secret production : `whsec_live_XXX`

### [ ] URLs production mises à jour
- [ ] successUrl : `https://yourdomain.com/front/checkout-success`
- [ ] cancelUrl : `https://yourdomain.com/front/checkout-cancel`
- [ ] Vérifier HTTPS
- [ ] Tester lien manuellement fonctionne

### [ ] Alertes configurées
- [ ] CloudWatch : alerte si Lambda erreurs > 2%
- [ ] Stripe : alerte si transactions déclinées > seuil
- [ ] PagerDuty/Slack : notifications en cas problème

### [ ] Monitoring en place
- [ ] Dashboard CloudWatch créé
- [ ] Metrics: invocations, erreurs, durée
- [ ] Logs: accès rapide pour debug

### [ ] Première vraie transaction
- [ ] Produit a peu coûteux pour test
- [ ] Vrai paiement depuis vraie carte
- [ ] Vérifier dans dashboard Stripe
- [ ] Vérifier email confirmation reçu
- [ ] Vérifier DynamoDB transaction créée

### [ ] Go/No-Go decision
- [ ] Tout fonctionne ? ✅ GO
- [ ] Problèmes significants ? ❌ NO-GO (revert to dev)

---

## Phase 9 : Post-Go-Live (Semaine 3+)

### [ ] Monitoring actif
- [ ] Vérifier dashboard quotidiennement
- [ ] Lire alertes CloudWatch
- [ ] Réviser logs Stripe

### [ ] Support utilisateurs
- [ ] Former support sur processus remboursement
- [ ] Documenter réponses FAQ
- [ ] Créer templates de réponses

### [ ] Optimisation
- [ ] Analyser taux de conversion
- [ ] Vérifier temps de chargement page
- [ ] A/B test : wording buttons, messages

### [ ] Compliance
- [ ] PCI-DSS checklist reviewed
- [ ] Data retention policies defined
- [ ] Audit trail properly maintained

---

## Statut Global

```
[ ] Phase 1 : Configuration
[ ] Phase 2 : Webhooks
[ ] Phase 3 : Tests locaux
[ ] Phase 4 : Stripe CLI (optionnel)
[ ] Phase 5 : Integration front-back
[ ] Phase 6 : Sécurité
[ ] Phase 7 : Documentation
[ ] Phase 8 : Production
[ ] Phase 9 : Post-go-live
```

**Statut actuel :** Phase 0 ✅ (Code généré et prêt)  
**Prochaine étape :** Commencer Phase 1

---

## 📞 Contact pour blocages

- DynamoDB issues : AWS console
- Stripe API issues : https://dashboard.stripe.com/developers/logs
- Lambda errors : CloudWatch logs
- Angular issues : Browser console + Network tab

---

**Document créé :** 2024-01-15  
**Prochaine révision :** Après Phase 3  
**Responsable :** [À remplir]
