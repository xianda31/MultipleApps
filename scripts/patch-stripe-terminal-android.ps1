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
    Write-Host "✅ Patch appliqué : BluetoothDiscoveryConfiguration(isSimulated) corrigé" -ForegroundColor Green
} elseif ($content -match 'val isSimulated = call.getString') {
    Write-Host "✅ Patch déjà appliqué" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  Pattern non trouvé — vérifier manuellement la version du plugin" -ForegroundColor Yellow
}
