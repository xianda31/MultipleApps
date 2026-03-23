# deployment-commands.ps1
# Windows PowerShell - Commandes de déploiement Stripe

Write-Host ""
Write-Host "🚀 Stripe Integration Deployment Commands (Windows)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# PHASE 1 : Installation dépendances
# ============================================

Write-Host "📦 PHASE 1: Installation dépendances Lambda" -ForegroundColor Yellow
Write-Host ""

Write-Host "Commande 1 : Installer dépendances stripe-checkout" -ForegroundColor Green
Write-Host "-----" -ForegroundColor Gray
Write-Host 'npm install -w amplify/functions/stripe-checkout' -ForegroundColor White
Write-Host ""

Write-Host "Commande 2 : Installer dépendances stripe-webhooks" -ForegroundColor Green
Write-Host "-----" -ForegroundColor Gray
Write-Host 'npm install -w amplify/functions/stripe-webhooks' -ForegroundColor White
Write-Host ""

# ============================================
# PHASE 2 : Configuration env variables
# ============================================

Write-Host "⚙️  PHASE 2: Configuration variables d'environnement" -ForegroundColor Yellow
Write-Host ""

Write-Host "Créer amplify\.env.local:" -ForegroundColor Green
Write-Host "-----" -ForegroundColor Gray
Write-Host '@"
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_SECRET_HERE
"@ | Out-File -FilePath "amplify\.env.local" -Encoding UTF8' -ForegroundColor White
Write-Host ""
Write-Host "✅ Remplacer les XXX par vos vraies clés Stripe" -ForegroundColor Green
Write-Host ""

# ============================================
# PHASE 3 : Déployer backend
# ============================================

Write-Host "🚀 PHASE 3: Déployer backend Amplify" -ForegroundColor Yellow
Write-Host ""

Write-Host "Commande principale:" -ForegroundColor Green
Write-Host "-----" -ForegroundColor Gray
Write-Host 'amplify deploy' -ForegroundColor White
Write-Host ""
Write-Host "ℹ️ Le système demandera confirmation - taper 'yes'" -ForegroundColor Cyan
Write-Host "⏳ Attendre 5-10 minutes..." -ForegroundColor Cyan
Write-Host ""

# ============================================
# PHASE 4 : Vérifier les URLs
# ============================================

Write-Host "🔍 PHASE 4: Vérifier les URLs Lambda déployées" -ForegroundColor Yellow
Write-Host ""

Write-Host "Les URLs seront affichées à la fin du deploy:" -ForegroundColor Green
Write-Host "-----" -ForegroundColor Gray
Write-Host "Lambda stripe-checkout URL:" -ForegroundColor White
Write-Host "  https://xxxxx.lambda-url.region.on.aws/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Lambda stripe-webhooks URL:" -ForegroundColor White
Write-Host "  https://xxxxx.lambda-url.region.on.aws/" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔖 Copier ces URLs pour la configuration webhook Stripe!" -ForegroundColor Green
Write-Host ""

# ============================================
# PHASE 5 : Configuration webhook Stripe
# ============================================

Write-Host "⚙️  PHASE 5: Configuration Webhook dans Stripe Dashboard" -ForegroundColor Yellow
Write-Host ""

Write-Host "Étapes:" -ForegroundColor Green
Write-Host "1. https://dashboard.stripe.com" -ForegroundColor White
Write-Host "2. Developers → Webhooks" -ForegroundColor White
Write-Host "3. Add endpoint" -ForegroundColor White
Write-Host "4. Paster URL Lambda stripe-webhooks" -ForegroundColor White
Write-Host "5. Select events to send:" -ForegroundColor White
Write-Host "   ✅ checkout.session.completed" -ForegroundColor Green
Write-Host "   ✅ checkout.session.async_payment_succeeded" -ForegroundColor Green
Write-Host "   ✅ checkout.session.async_payment_failed" -ForegroundColor Green
Write-Host "   ✅ charge.failed" -ForegroundColor Green
Write-Host "   ✅ charge.refunded" -ForegroundColor Green
Write-Host "6. Add events" -ForegroundColor White
Write-Host "7. Copier Webhook Secret (whsec_test_XXXX)" -ForegroundColor White
Write-Host ""

# ============================================
# PHASE 6 : Ajouter webhook secret
# ============================================

Write-Host "🔐 PHASE 6: Ajouter Webhook Secret à Amplify" -ForegroundColor Yellow
Write-Host ""

Write-Host "Ajouter à amplify\.env.local:" -ForegroundColor Green
Write-Host "-----" -ForegroundColor Gray
Write-Host "Ouvrir amplify\.env.local avec notepad ou VS Code et ajouter:" -ForegroundColor White
Write-Host 'STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_SECRET' -ForegroundColor Cyan
Write-Host ""

Write-Host "Redéployer:" -ForegroundColor Green
Write-Host "-----" -ForegroundColor Gray
Write-Host 'amplify deploy' -ForegroundColor White
Write-Host ""

# ============================================
# PHASE 7 : Tests locaux
# ============================================

Write-Host "🧪 PHASE 7: Tests locaux" -ForegroundColor Yellow
Write-Host ""

Write-Host "Démarrer l'app (nouveau terminal):" -ForegroundColor Green
Write-Host "-----" -ForegroundColor Gray
Write-Host 'npm start' -ForegroundColor White
Write-Host ""

Write-Host "Naviguer vers dans navigateur:" -ForegroundColor Green
Write-Host "-----" -ForegroundColor Gray
Write-Host 'http://localhost:4200/front/shop' -ForegroundColor Cyan
Write-Host ""

Write-Host "Test items:" -ForegroundColor Green
Write-Host "  1. Ajouter produit au panier" -ForegroundColor White
Write-Host "  2. Cliquer 'Passer la commande'" -ForegroundColor White
Write-Host "  3. Carte test: 4242 4242 4242 4242" -ForegroundColor Cyan
Write-Host "  4. Expiration date: 12/25 (n'importe quel futur)" -ForegroundColor Cyan
Write-Host "  5. CVC: 123 (n'importe quel 3 chiffres)" -ForegroundColor Cyan
Write-Host "  6. Vérifier redirect page succès" -ForegroundColor White
Write-Host ""

# ============================================
# PHASE 8 : Debugging
# ============================================

Write-Host "🔧 PHASE 8: Commandes de debugging" -ForegroundColor Yellow
Write-Host ""

Write-Host "Voir logs Lambda stripe-checkout:" -ForegroundColor Green
Write-Host "-----" -ForegroundColor Gray
Write-Host 'aws logs tail /aws/lambda/stripe-checkout --follow' -ForegroundColor White
Write-Host ""

Write-Host "Voir logs Lambda stripe-webhooks:" -ForegroundColor Green
Write-Host "-----" -ForegroundColor Gray
Write-Host 'aws logs tail /aws/lambda/stripe-webhooks --follow' -ForegroundColor White
Write-Host ""

Write-Host "Vérifier variables d'environnement:" -ForegroundColor Green
Write-Host "-----" -ForegroundColor Gray
Write-Host 'Get-Content "amplify\.env.local" | Select-String "STRIPE"' -ForegroundColor White
Write-Host ""

# ============================================
# PHASE 9 : Production (Later)
# ============================================

Write-Host "📍 PHASE 9: Passage en production (PLUS TARD)" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Remplacer clés API par clés LIVE:" -ForegroundColor White
Write-Host "   pk_live_XXXXX" -ForegroundColor Cyan
Write-Host "   sk_live_XXXXX" -ForegroundColor Cyan
Write-Host "   whsec_live_XXXXX" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Redéployer:" -ForegroundColor White
Write-Host "   amplify deploy" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Tester avec vraie petite transaction" -ForegroundColor White
Write-Host ""

# ============================================
# RÉSUMÉ
# ============================================

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "📋 RÉSUMÉ RAPIDE" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "👉 AVANT TOUT:" -ForegroundColor Yellow
Write-Host "  1. Créer compte Stripe (gratuit): https://dashboard.stripe.com" -ForegroundColor White
Write-Host "  2. Copier clés API test (pk_test + sk_test)" -ForegroundColor White
Write-Host ""

Write-Host "👉 ÉTAPE 1 - Installer dépendances:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  npm install -w amplify/functions/stripe-checkout" -ForegroundColor Cyan
Write-Host "  npm install -w amplify/functions/stripe-webhooks" -ForegroundColor Cyan
Write-Host ""

Write-Host "👉 ÉTAPE 2 - Créer amplify\.env.local:" -ForegroundColor Yellow
Write-Host ""
Write-Host '@"
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_SECRET
"@ | Out-File -FilePath "amplify\.env.local" -Encoding UTF8' -ForegroundColor Cyan
Write-Host ""

Write-Host "👉 ÉTAPE 3 - Déployer:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  amplify deploy" -ForegroundColor Cyan
Write-Host ""

Write-Host "👉 ÉTAPE 4 - Configurer webhook (Dashboard Stripe):" -ForegroundColor Yellow
Write-Host ""
Write-Host "  - Developers → Webhooks → Add endpoint" -ForegroundColor White
Write-Host "  - URL: <copier de l'output amplify deploy>" -ForegroundColor Cyan
Write-Host "  - Sélectionner les 5 événements" -ForegroundColor White
Write-Host "  - Copier Webhook Secret" -ForegroundColor White
Write-Host ""

Write-Host "👉 ÉTAPE 5 - Ajouter webhook secret et redéployer:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  # Éditer amplify\.env.local et ajouter:" -ForegroundColor Gray
Write-Host "  STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_SECRET" -ForegroundColor Cyan
Write-Host ""
Write-Host "  amplify deploy" -ForegroundColor Cyan
Write-Host ""

Write-Host "👉 TESTS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  npm start" -ForegroundColor Cyan
Write-Host "  http://localhost:4200/front/shop" -ForegroundColor Cyan
Write-Host "  Ajouter produit → Checkout → 4242 4242 4242 4242" -ForegroundColor Cyan
Write-Host ""

Write-Host "✅ DONE!" -ForegroundColor Green
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Besoin d'aide ? Voir:" -ForegroundColor Cyan
Write-Host "  - QUICKSTART-SHOP.md" -ForegroundColor White
Write-Host "  - DEPLOYMENT.md" -ForegroundColor White
Write-Host "  - STRIPE_SECURITY.md" -ForegroundColor White
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
