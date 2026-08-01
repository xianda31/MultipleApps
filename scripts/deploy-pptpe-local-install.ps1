param(
    [string]$DeviceId,
    [string]$ApkPath = "android/app/build/outputs/apk/debug/app-debug.apk",
    [string]$RemoteNamePrefix = "wisepad-refresh",
    [switch]$BuildApk,
    [switch]$Release
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

    if ($RequestedDeviceId) {
        return $RequestedDeviceId
    }

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

if ($BuildApk) {
    Require-Command "npm"
    Require-Command "npx"

    # Regenerate amplify_outputs.json from production (non-blocking if credentials expired)
    Write-Host "Fetching production amplify_outputs.json..."
    Push-Location $PSScriptRoot\..
    npx ampx generate outputs --branch master --app-id d129hzsf6g08ma --profile amplify-dev --out-dir .
    if ($LASTEXITCODE -ne 0) { Write-Warning "Could not refresh amplify_outputs.json (credentials?). Using existing file." }
    Pop-Location

    # Stamp build date (YYMMDD) into environment before Angular build
    $buildDate = (Get-Date).ToString("yyMMdd")
    $envFile = Join-Path $PSScriptRoot "..\projects\pptpe\src\environments\environment.ts"
    $envContent = Get-Content $envFile -Raw
    $envContent = $envContent -replace "buildDate: '[^']*'", "buildDate: '$buildDate'"
    [System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.Encoding]::UTF8)
    Write-Host "Build date set to $buildDate"

    Write-Host "Building ppTPE web assets..."
    Invoke-Checked -Command "npm" -Arguments @("run", "ng", "--", "build", "pptpe", "--configuration", "production") -WorkingDirectory $PSScriptRoot\..

    Write-Host "Syncing Capacitor Android project..."
    Invoke-Checked -Command "npx" -Arguments @("cap", "sync", "android") -WorkingDirectory $PSScriptRoot\..

    $gradleTask = if ($Release) { "assembleRelease" } else { "assembleDebug" }
    $buildKind = if ($Release) { "release" } else { "debug" }
    Write-Host "Assembling Android $buildKind APK..."
    Invoke-Checked -Command ".\gradlew.bat" -Arguments @($gradleTask) -WorkingDirectory $PSScriptRoot\..\android

    if ($Release -and $ApkPath -eq "android/app/build/outputs/apk/debug/app-debug.apk") {
        $releaseDir = "android/app/build/outputs/apk/release"
        # Prefer arm64 split APK, then universal, then unsigned
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
