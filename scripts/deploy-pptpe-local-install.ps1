param(
    [string]$DeviceId,
    [string]$ApkPath = "android/app/build/outputs/apk/debug/app-debug.apk",
    [string]$RemoteNamePrefix = "wisepad-refresh",
    [switch]$BuildApk,
    [switch]$Release,
    [switch]$Prod
)

$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name"
    }
}

function Invoke-Checked {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )
    Push-Location $WorkingDirectory
    try {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed with exit code ${LASTEXITCODE}: $Command $($Arguments -join ' ')"
        }
    }
    finally {
        Pop-Location
    }
}

function Resolve-DeviceId {
    param([string]$RequestedDeviceId)
    if ($RequestedDeviceId) { return $RequestedDeviceId }
    $devices = @(
        adb devices |
            Select-String "^\S+\s+device$" |
            ForEach-Object { (($_.Line -split "\s+")[0]).Trim() }
    )
    if (-not $devices -or $devices.Count -eq 0) {
        throw "No Android device detected (adb devices)."
    }
    if ($devices.Count -gt 1) {
        throw "Multiple Android devices detected. Re-run with -DeviceId <serial>."
    }
    return [string]$devices[0]
}

Require-Command "adb"

# Stable paths shared between self-heal and BuildApk block
$_rootDir          = (Resolve-Path "$PSScriptRoot\..").Path
$_outputsFile      = Join-Path $_rootDir "amplify_outputs.json"
$_outputsBackup    = Join-Path $_rootDir "amplify_outputs.backup.json"
# Dedicated ppTPE outputs dir -- never confused with the dev/sandbox file
$_pptpeOutputsDir  = Join-Path $PSScriptRoot ".pptpe-outputs"
$_pptpeProdOutputs = Join-Path $_pptpeOutputsDir "amplify_outputs.json"

# Self-heal: if a previous run was interrupted (Ctrl+C) the backup is still here
if (Test-Path $_outputsBackup) {
    Write-Warning "Found leftover amplify_outputs.backup.json -- restoring (previous run was interrupted)."
    Copy-Item $_outputsBackup $_outputsFile -Force
    Remove-Item $_outputsBackup -Force
    Write-Host "amplify_outputs.json restored from leftover backup."
}

if ($BuildApk) {
    Require-Command "npm"
    Require-Command "npx"

    New-Item -ItemType Directory -Force -Path $_pptpeOutputsDir | Out-Null

    if ($Prod) {
        # Fetch prod outputs from AWS into .pptpe-outputs/ -- does not touch amplify_outputs.json yet
        Write-Host "Fetching production amplify_outputs.json into .pptpe-outputs/..."
        Push-Location $_rootDir
        npx ampx generate outputs --branch master --app-id d129hzsf6g08ma --profile amplify-dev --out-dir $_pptpeOutputsDir
        if ($LASTEXITCODE -ne 0) { Write-Warning "Could not refresh prod outputs (credentials?). Using cached .pptpe-outputs/amplify_outputs.json." }
        Pop-Location
        if (-not (Test-Path $_pptpeProdOutputs)) {
            throw "No prod amplify_outputs available in .pptpe-outputs/. Run with credentials or provide the file manually."
        }
    } else {
        # Sandbox/dev mode: use current amplify_outputs.json as-is (tpe_simulated=true, tpe_isTest=true)
        if (-not (Test-Path $_outputsFile)) {
            throw "amplify_outputs.json not found. Run 'npx ampx sandbox' to generate a sandbox environment."
        }
        Write-Host "Using current amplify_outputs.json (sandbox/dev -- tpe_isTest=true, reader=simulated)"
        Copy-Item $_outputsFile $_pptpeProdOutputs -Force
    }

    # Minimal swap: backup current file, replace with target outputs for the duration of the build
    $didBackup = $false
    if (Test-Path $_outputsFile) {
        Copy-Item $_outputsFile $_outputsBackup -Force
        $didBackup = $true
        Write-Host "amplify_outputs.json backed up."
    }
    try {
        Copy-Item $_pptpeProdOutputs $_outputsFile -Force

        $ngConfig = if ($Prod) { 'production' } else { 'development' }
        Write-Host "Angular config: $ngConfig"

        # Stamp build date (YYMMDD) into environment before Angular build
        $buildDate = (Get-Date).ToString("yyMMdd")
        $envFile = Join-Path $PSScriptRoot "..\projects\pptpe\src\environments\environment.ts"
        $envContent = Get-Content $envFile -Raw
        $envContent = $envContent -replace "buildDate: '[^']*'", "buildDate: '$buildDate'"
        [System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.Encoding]::UTF8)
        Write-Host "Build date set to $buildDate"

        Write-Host "Building ppTPE web assets..."
        Invoke-Checked -Command "npm" -Arguments @("run", "ng", "--", "build", "pptpe", "--configuration", $ngConfig) -WorkingDirectory $PSScriptRoot\..

        Write-Host "Syncing Capacitor Android project..."
        Invoke-Checked -Command "npx" -Arguments @("cap", "sync", "android") -WorkingDirectory $PSScriptRoot\..
    } finally {
        if ($didBackup -and (Test-Path $_outputsBackup)) {
            Copy-Item $_outputsBackup $_outputsFile -Force
            Remove-Item $_outputsBackup -Force
            Write-Host "amplify_outputs.json restored."
        }
    }

    $gradleTask = if ($Release) { "assembleRelease" } else { "assembleDebug" }
    $buildKind  = if ($Release) { "release" } else { "debug" }
    Write-Host "Assembling Android $buildKind APK..."
    Invoke-Checked -Command ".\gradlew.bat" -Arguments @($gradleTask) -WorkingDirectory $PSScriptRoot\..\android

    if ($Release -and $ApkPath -eq "android/app/build/outputs/apk/debug/app-debug.apk") {
        $releaseDir = "android/app/build/outputs/apk/release"
        $candidates = @(
            "$releaseDir/app-arm64-v8a-release.apk",
            "$releaseDir/app-release.apk",
            "$releaseDir/app-release-unsigned.apk",
            "$releaseDir/app-armeabi-v7a-release.apk"
        )
        $ApkPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
        if (-not $ApkPath) { $ApkPath = "$releaseDir/app-arm64-v8a-release.apk" }
    } elseif (-not $Release) {
        $debugDir = "android/app/build/outputs/apk/debug"
        $candidates = @(
            "$debugDir/app-arm64-v8a-debug.apk",
            "$debugDir/app-debug.apk",
            "$debugDir/app-armeabi-v7a-debug.apk"
        )
        $ApkPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
        if (-not $ApkPath) { $ApkPath = "$debugDir/app-debug.apk" }
    }
}

# Resolve APK path even when not rebuilding
if ($Release -and $ApkPath -eq "android/app/build/outputs/apk/debug/app-debug.apk") {
    $releaseDir = "android/app/build/outputs/apk/release"
    $candidates = @(
        "$releaseDir/app-arm64-v8a-release.apk",
        "$releaseDir/app-release.apk",
        "$releaseDir/app-armeabi-v7a-release.apk"
    )
    $ApkPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $ApkPath) { $ApkPath = "$releaseDir/app-arm64-v8a-release.apk" }
} elseif (-not $Release -and $ApkPath -eq "android/app/build/outputs/apk/debug/app-debug.apk") {
    $debugDir = "android/app/build/outputs/apk/debug"
    $candidates = @(
        "$debugDir/app-arm64-v8a-debug.apk",
        "$debugDir/app-debug.apk",
        "$debugDir/app-armeabi-v7a-debug.apk"
    )
    $ApkPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $ApkPath) { $ApkPath = "$debugDir/app-debug.apk" }
}

if (-not (Test-Path $ApkPath)) {
    throw "APK not found: $ApkPath"
}

$resolvedDeviceId = Resolve-DeviceId -RequestedDeviceId $DeviceId
Write-Host "Using device: $resolvedDeviceId"
Write-Host "Installing APK: $ApkPath"

adb -s "$resolvedDeviceId" install -r $ApkPath | Out-Host

Write-Host ""
Write-Host "Installation complete."