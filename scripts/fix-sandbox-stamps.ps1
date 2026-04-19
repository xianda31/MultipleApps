# ============================================================
# fix-sandbox-stamps.ps1
# Retire le tampon "2026-04-17" (faux tampon dû au bug) des
# 17 cartes PlayBook du sandbox.
#
# AVANT d'exécuter :
#   1. Vérifier le nom exact de la table :
#      aws dynamodb list-tables --region eu-west-3 | Select-String PlayBook
#   2. Ajuster $TABLE_NAME ci-dessous
#   3. S'assurer que le BookEntry debug (29€) a été supprimé du sandbox
#
# AMIARD (c1d52e42-...) non fourni dans les donnees - a corriger manuellement
# ============================================================

$REGION    = "eu-west-3"
$TABLE_NAME = "PlayBook-efrr2pns5vha5evtg7bifwxv2i-NONE"
$env:AWS_PROFILE = "amplify-dev"

function Set-PlayBookStamps {
    param(
        [string]   $Id,
        [string[]] $Stamps,
        [string]   $Label
    )
    $key = '{"id":{"S":"' + $Id + '"}}'
    $stampsList = ($Stamps | ForEach-Object { '{"S":"' + $_ + '"}' }) -join ','
    $attrVal = '{":s":{"L":[' + $stampsList + ']}}'

    $keyFile   = [System.IO.Path]::GetTempFileName()
    $attrFile  = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($keyFile,  $key)
    [System.IO.File]::WriteAllText($attrFile, $attrVal)

    & aws dynamodb update-item `
        --region $REGION `
        --table-name $TABLE_NAME `
        --key "file://$keyFile" `
        --update-expression "SET stamps = :s" `
        --expression-attribute-values "file://$attrFile"

    Remove-Item $keyFile, $attrFile -ErrorAction SilentlyContinue

    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK  $Label - $($Stamps.Count) tampon(s) restant(s)" -ForegroundColor Green
    } else {
        Write-Host "ERR $Label ($Id)" -ForegroundColor Red
    }
}

# -----------------------------------------------------------
# 1. ANTOINE (01297060)
Set-PlayBookStamps "7e4f877d-b3be-4772-ad48-27c5aa1746fa" @(
    "2026-04-03"
) "ANTOINE"

# -----------------------------------------------------------
# 2. AYRAL (04604030)
Set-PlayBookStamps "494f50d9-d917-45c4-9d73-3bc8b7275c61" @(
    "2026-04-03", "2026-04-08", "2026-04-10"
) "AYRAL"

# -----------------------------------------------------------
# 3. BEAUCAMP (09632086 + 00589129) - carte partagee, 2 tampons retires
Set-PlayBookStamps "5b44a5c3-afb6-411c-9ef4-9bf2fc71a440" @(
    "2026-03-20", "2026-03-27", "2026-03-27",
    "2026-04-03", "2026-04-03",
    "2026-04-10", "2026-04-10"
) "BEAUCAMP (x2)"

# -----------------------------------------------------------
# 4. CALMON (04604121)
Set-PlayBookStamps "dcbd9c6d-149c-457c-ba16-2f4b8c54a531" @(
    "2026-03-11"
) "CALMON"

# -----------------------------------------------------------
# 5. CARRAL-ROY (02595249)
Set-PlayBookStamps "e48ad245-c1ec-43d4-a61c-03958617f827" @(
    "2026-03-25", "2026-03-25", "2026-03-27",
    "2026-04-01", "2026-04-03", "2026-04-08"
) "CARRAL-ROY"

# -----------------------------------------------------------
# 6. CASSAGNE (01753434)
Set-PlayBookStamps "cb587d9c-952a-48b8-a8d4-18773a0f4539" @(
    "2025-09-05", "2025-10-03", "2025-10-17",
    "2025-11-21", "2025-12-19",
    "2026-01-23", "2026-02-20", "2026-03-20"
) "CASSAGNE"

# -----------------------------------------------------------
# 7. CAUSSE (01214808)
Set-PlayBookStamps "18f8b032-bee7-49a8-a842-f30a2ed5bc54" @(
    "2026-03-25", "2026-03-27", "2026-04-01", "2026-04-15"
) "CAUSSE"

# -----------------------------------------------------------
# 8. CAZORLA (28368886)
Set-PlayBookStamps "82a024c8-2218-4853-ae48-6897964940c9" @(
    "2026-04-10", "2026-04-15"
) "CAZORLA"

# -----------------------------------------------------------
# 9. CHAUVET (00470568)
Set-PlayBookStamps "9c26ed2f-abc9-4ed6-9f86-cd3ccf366de2" @(
    "2026-04-03", "2026-04-08", "2026-04-10", "2026-04-15"
) "CHAUVET"

# -----------------------------------------------------------
# 10. COURTOIS (61643774)
Set-PlayBookStamps "23288155-59e5-43ef-97f2-f2ae5133c3c9" @(
    "2026-03-27", "2026-04-08", "2026-04-15"
) "COURTOIS"

# -----------------------------------------------------------
# 11. DAVOINE (00589632 + 04761046) - carte partagee
Set-PlayBookStamps "e5a5a503-5d01-44c5-8d0f-a4ed5674324b" @(
    "2026-02-06", "2026-02-13",
    "2026-02-20", "2026-02-20",
    "2026-02-27",
    "2026-03-13", "2026-03-13",
    "2026-03-20", "2026-03-20",
    "2026-03-27", "2026-04-03"
) "DAVOINE"

# -----------------------------------------------------------
# 12. DE LATUDE (01508417)
Set-PlayBookStamps "ed766498-325b-4f3b-83bd-3a27d5432453" @(
    "2026-02-25", "2026-03-04", "18/03/2026",
    "2026-03-25", "2026-03-25", "2026-04-01"
) "DE LATUDE"

# -----------------------------------------------------------
# 13. DELATTE (01182972)
Set-PlayBookStamps "e13dde57-5782-4cdf-b74c-85b6b7bde02a" @(
    "2026-01-09", "2026-01-23", "2026-01-30",
    "2026-02-20", "2026-02-27",
    "2026-03-06", "2026-03-13", "2026-03-20", "2026-03-27"
) "DELATTE"

# -----------------------------------------------------------
# 14. DEMYK (04865278)
Set-PlayBookStamps "8ec9357f-93a1-48a8-bc74-00aacfa47423" @(
    "2026-04-15"
) "DEMYK"

# -----------------------------------------------------------
# 15. DEVAUD (01492363)
Set-PlayBookStamps "862af52c-76ac-44d1-b5a1-4a6d139fcd35" @(
    "2026-02-25", "2026-03-25", "2026-03-25",
    "01/04/2026", "2026-04-15"
) "DEVAUD"

# -----------------------------------------------------------
# 16. DONZEAU (02266717)
Set-PlayBookStamps "2b209368-83c1-4942-ba72-642309ed59e4" @(
    "2026-03-04", "2026-03-06", "2026-03-13",
    "2026-03-20", "2026-03-25", "2026-03-25",
    "2026-03-27", "2026-04-01", "2026-04-10", "2026-04-15"
) "DONZEAU"

# -----------------------------------------------------------
# !! AMIARD (04816388) — ID c1d52e42-... non fourni, à faire manuellement !!
# Set-PlayBookStamps "c1d52e42-XXXX-XXXX-XXXX-XXXXXXXXXXXX" @(...) "AMIARD"

Write-Host ""
Write-Host "Termine. Verifier les 16 cartes ci-dessus avant de lancer save_fees()." -ForegroundColor Cyan
