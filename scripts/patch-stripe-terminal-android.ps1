# Patch @capacitor-community/stripe-terminal Android plugin
# Bug: BluetoothDiscoveryConfiguration uses isTest!! as isSimulated flag
# Fix: use explicit isSimulated based on type ("simulated" vs "bluetooth")
# See: node_modules/@capacitor-community/stripe-terminal/android/.../StripeTerminal.kt line ~199

$file = "node_modules/@capacitor-community/stripe-terminal/android/src/main/java/com/getcapacitor/community/stripe/terminal/StripeTerminal.kt"

if (-not (Test-Path $file)) {
    Write-Host "ERREUR: fichier plugin introuvable — npm install effectué ?" -ForegroundColor Red
    exit 1
}

$content = Get-Content $file -Raw

$buggy = 'config = DiscoveryConfiguration.BluetoothDiscoveryConfiguration(0, this.isTest!!)'
$fixed = @'
val isSimulated = call.getString("type") == TerminalConnectTypes.Simulated.webEventName
            config = DiscoveryConfiguration.BluetoothDiscoveryConfiguration(0, isSimulated)
'@

if ($content -match [regex]::Escape($buggy)) {
    $content = $content -replace [regex]::Escape($buggy), $fixed
    Set-Content $file $content -NoNewline
    Write-Host "OK Patch 1 applique : BluetoothDiscoveryConfiguration(isSimulated)" -ForegroundColor Green
} elseif ($content -match 'val isSimulated = call.getString') {
    Write-Host "OK Patch 1 deja applique" -ForegroundColor Yellow
} else {
    Write-Host "WARN Patch 1 : Pattern non trouve - verifier manuellement la version du plugin" -ForegroundColor Yellow
}

# Patch 2 SUPPRIME: updatePaymentIntent(false) casse confirmPaymentIntent avec lecteur physique
# (erreur "card_present[emv_data] required") — NE PAS APPLIQUER avec WP3 physique
