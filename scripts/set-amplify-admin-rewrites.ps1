param(
  [Parameter(Mandatory = $true)]
  [string]$AppId,

  [string]$Region = "eu-west-3",

  [switch]$PreviewOnly
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$rulesPath = Join-Path $repoRoot "config/amplify/custom-rules-admin.json"

if (-not (Test-Path $rulesPath)) {
  throw "Rules file not found: $rulesPath"
}

Write-Host "Using rules file: $rulesPath" -ForegroundColor Cyan
Write-Host "AppId: $AppId" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan

if ($PreviewOnly) {
  Write-Host "Preview mode: showing custom rules only." -ForegroundColor Yellow
  Get-Content $rulesPath
  exit 0
}

$absRulesPath = (Resolve-Path $rulesPath).Path -replace "\\", "/"
$fileArg = "file://$absRulesPath"

aws amplify update-app `
  --region $Region `
  --app-id $AppId `
  --custom-rules $fileArg | Out-Null

if ($LASTEXITCODE -ne 0) {
  throw "AWS CLI update-app failed (exit code: $LASTEXITCODE). Check credentials/session and retry."
}

Write-Host "Custom rewrite rules updated." -ForegroundColor Green
Write-Host "Next: trigger a frontend redeploy, then validate URLs:" -ForegroundColor Green
Write-Host "  curl.exe --ssl-no-revoke -I -L https://www.bridgeclubsaintorens.fr/manifest.webmanifest"
Write-Host "  curl.exe --ssl-no-revoke -I -L https://www.bridgeclubsaintorens.fr/ngsw-worker.js"
