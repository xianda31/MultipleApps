param()
$keytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
$keystoreFile = "$PSScriptRoot\release-key.jks"

if (Test-Path $keystoreFile) {
    Write-Host "Keystore already exists: $keystoreFile"
    exit 0
}

Write-Host ""
Write-Host "=== Génération du keystore de signature ppTPE ==="
Write-Host "Choisissez un mot de passe (mémorisez-le ou notez-le)."
Write-Host ""

$pwd1 = Read-Host "Mot de passe keystore" -AsSecureString
$pwd2 = Read-Host "Confirmer" -AsSecureString

$p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pwd1))
$p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pwd2))

if ($p1 -ne $p2) {
    Write-Error "Les mots de passe ne correspondent pas."
    exit 1
}
if ($p1.Length -lt 6) {
    Write-Error "Mot de passe trop court (6 caractères minimum)."
    exit 1
}

& $keytool -genkeypair -v `
    -keystore $keystoreFile `
    -alias release `
    -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $p1 -keypass $p1 `
    -dname "CN=BCSto, O=BCSto, C=FR"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Erreur keytool."
    exit 1
}

# Créer keystore.properties
$propsContent = @"
storeFile=../release-key.jks
storePassword=$p1
keyAlias=release
keyPassword=$p1
"@
[System.IO.File]::WriteAllText("$PSScriptRoot\keystore.properties", $propsContent, [System.Text.Encoding]::ASCII)

Write-Host ""
Write-Host "Keystore créé : $keystoreFile"
Write-Host "keystore.properties créé."
Write-Host ""
Write-Host "IMPORTANT : sauvegardez release-key.jks en dehors du projet (OneDrive, etc.)"
