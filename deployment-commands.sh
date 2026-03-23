#!/bin/bash
# deployment-commands.sh
# Commandes de déploiement Stripe - Copy-paste ready !

echo "🚀 Stripe Integration Deployment Commands"
echo "=========================================="
echo ""

# ============================================
# PHASE 1 : Installation dépendances
# ============================================

echo "📦 PHASE 1: Installation dépendances Lambda"
echo ""
echo "Commande 1 : Installer dépendances stripe-checkout"
echo "---"
echo 'npm install -w amplify/functions/stripe-checkout'
echo ""

echo "Commande 2 : Installer dépendances stripe-webhooks"
echo "---"
echo 'npm install -w amplify/functions/stripe-webhooks'
echo ""

# ============================================
# PHASE 2 : Configurer env variables
# ============================================

echo "⚙️  PHASE 2: Configuration variables d'environnement"
echo ""
echo "Créer amplify/.env.local:"
echo "---"
echo 'cat > amplify/.env.local << EOF
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_SECRET_HERE
EOF'
echo ""
echo "✅ Remplacer les XXX par vos vraies clés Stripe"
echo ""

# ============================================
# PHASE 3 : Déployer backend
# ============================================

echo "🚀 PHASE 3: Déployer backend Amplify"
echo ""
echo "Commande principale:"
echo "---"
echo 'amplify deploy'
echo ""
echo "ℹ️ Le système demandera confirmation - taper 'yes'"
echo "⏳ Attendre 5-10 minutes..."
echo ""

# ============================================
# PHASE 4 : Vérifier les URLs
# ============================================

echo "🔍 PHASE 4: Vérifier les URLs Lambda déployées"
echo ""
echo "Les URLs seront affichées à la fin du deploy:"
echo "---"
echo "Lambda stripe-checkout URL:"
echo "  https://xxxxx.lambda-url.region.on.aws/"
echo ""
echo "Lambda stripe-webhooks URL:"
echo "  https://xxxxx.lambda-url.region.on.aws/"
echo ""
echo "🔖 Copier ces URLs pour la configuration webhook Stripe!"
echo ""

# ============================================
# PHASE 5 : Configuration webhook Stripe
# ============================================

echo "⚙️  PHASE 5: Configuration Webhook dans Stripe Dashboard"
echo ""
echo "Étapes:"
echo "1. https://dashboard.stripe.com"
echo "2. Developers → Webhooks"
echo "3. Add endpoint"
echo "4. Paster URL Lambda stripe-webhooks"
echo "5. Select events to send:"
echo "   ✅ checkout.session.completed"
echo "   ✅ checkout.session.async_payment_succeeded"
echo "   ✅ checkout.session.async_payment_failed"
echo "   ✅ charge.failed"
echo "   ✅ charge.refunded"
echo "6. Add events"
echo "7. Copier Webhook Secret (whsec_test_XXXX)"
echo ""

# ============================================
# PHASE 6 : Ajouter webhook secret
# ============================================

echo "🔐 PHASE 6: Ajouter Webhook Secret à Amplify"
echo ""
echo "Ajouter à amplify/.env.local:"
echo "---"
echo 'echo "STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_SECRET" >> amplify/.env.local'
echo ""
echo "Redéployer:"
echo "---"
echo 'amplify deploy'
echo ""

# ============================================
# PHASE 7 : Tests locaux
# ============================================

echo "🧪 PHASE 7: Tests locaux"
echo ""
echo "Démarrer l'app:"
echo "---"
echo 'npm start'
echo ""
echo "Naviguer vers:"
echo "---"
echo 'http://localhost:4200/front/shop'
echo ""
echo "Test items:"
echo "  1. Ajouter produit au panier"
echo "  2. Cliquer 'Passer la commande'"
echo "  3. Carte test: 4242 4242 4242 4242"
echo "  4. Vérifier redirect page succès"
echo ""

# ============================================
# PHASE 8 : Debugging
# ============================================

echo "🔧 PHASE 8: Commandes de debugging"
echo ""
echo "Voir logs Lambda stripe-checkout:"
echo "---"
echo 'aws logs tail /aws/lambda/stripe-checkout --follow'
echo ""
echo "Voir logs Lambda stripe-webhooks:"
echo "---"
echo 'aws logs tail /aws/lambda/stripe-webhooks --follow'
echo ""
echo "Vérifier variables d'environnement:"
echo "---"
echo 'cat amplify/.env.local | grep STRIPE'
echo ""

# ============================================
# PHASE 9 : Production (Later)
# ============================================

echo "📍 PHASE 9: Passage en production (LATER)"
echo ""
echo "1. Remplacer clés API par clés LIVE:"
echo "   pk_live_XXXXX"
echo "   sk_live_XXXXX"
echo "   whsec_live_XXXXX"
echo ""
echo "2. Redéployer:"
echo "   amplify deploy"
echo ""
echo "3. Tester avec vraie petite transaction"
echo ""

# ============================================
# RÉSUMÉ
# ============================================

echo ""
echo "================================================"
echo "📋 RÉSUMÉ RAPIDE"
echo "================================================"
echo ""
echo "AVANT TOUT:"
echo "  1. Créer compte Stripe (gratuit): https://dashboard.stripe.com"
echo "  2. Copier clés API test (pk_test + sk_test)"
echo ""
echo "ENSUITE (copy-paste dans terminal):"
echo ""
echo "  npm install -w amplify/functions/stripe-checkout"
echo "  npm install -w amplify/functions/stripe-webhooks"
echo ""
echo "  cat > amplify/.env.local << EOF"
echo "  STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY"
echo "  STRIPE_SECRET_KEY=sk_test_YOUR_KEY"
echo "  STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_SECRET"
echo "  EOF"
echo ""
echo "  amplify deploy"
echo ""
echo "PUIS:"
echo "  URL Lambda → Dashboard Stripe → Webhooks → Add endpoint"
echo "  Copier webhook secret whsec_test_XXX"
echo "  Ajouter à .env.local"
echo "  amplify deploy (2ème fois)"
echo ""
echo "TESTS:"
echo "  npm start"
echo "  http://localhost:4200/front/shop"
echo "  Ajouter produit → Checkout → Carte: 4242 4242 4242 4242"
echo ""
echo "✅ DONE!"
echo ""
