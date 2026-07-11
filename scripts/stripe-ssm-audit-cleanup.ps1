param(
    [string]$Profile = "amplify-dev",
    [string]$Region = "eu-west-3",
    [string]$AppId = "d129hzsf6g08ma",
    [string]$BranchId = "master-branch-d5c7f4aebb",
    [switch]$DeleteCandidates,
    [switch]$IncludeSharedPaths
)

$ErrorActionPreference = "Stop"

function Get-Json {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
    return $Text | ConvertFrom-Json
}

function Get-StripeLambdaNames {
    param(
        [string]$Profile,
        [string]$Region,
        [string]$AppId
    )

    $raw = aws lambda list-functions --region $Region --profile $Profile --output json | Out-String
    $json = Get-Json -Text $raw
    if (-not $json -or -not $json.Functions) { return @() }

    return @(
        $json.Functions |
            Where-Object {
                $_.FunctionName -match [Regex]::Escape($AppId) -and
                $_.FunctionName -match "stripe"
            } |
            ForEach-Object { $_.FunctionName }
    )
}

function Get-ReferencedStripePaths {
    param(
        [string]$Profile,
        [string]$Region,
        [string[]]$LambdaNames,
        [switch]$IncludeSharedPaths
    )

    $paths = New-Object System.Collections.Generic.HashSet[string]

    foreach ($fn in $LambdaNames) {
        try {
            $raw = aws lambda get-function-configuration --function-name $fn --region $Region --profile $Profile --output json | Out-String
            $cfg = Get-Json -Text $raw
            $envConfigRaw = $cfg.Environment.Variables.AMPLIFY_SSM_ENV_CONFIG
            if ([string]::IsNullOrWhiteSpace($envConfigRaw)) { continue }

            $envConfig = Get-Json -Text $envConfigRaw
            if (-not $envConfig) { continue }

            foreach ($prop in $envConfig.PSObject.Properties) {
                $val = $prop.Value
                if ($val.path) {
                    [void]$paths.Add([string]$val.path)
                }
                if ($IncludeSharedPaths -and $val.sharedPath) {
                    [void]$paths.Add([string]$val.sharedPath)
                }
            }
        }
        catch {
            Write-Warning "Unable to inspect lambda '$fn': $($_.Exception.Message)"
        }
    }

    return @($paths)
}

function Get-StripeSsmParameters {
    param(
        [string]$Profile,
        [string]$Region
    )

    $raw = aws ssm describe-parameters --region $Region --profile $Profile --max-results 50 --output json | Out-String
    $json = Get-Json -Text $raw
    if (-not $json -or -not $json.Parameters) { return @() }

    $all = @($json.Parameters)
    $nextToken = $json.NextToken

    while ($nextToken) {
        $rawPage = aws ssm describe-parameters --region $Region --profile $Profile --max-results 50 --next-token $nextToken --output json | Out-String
        $page = Get-Json -Text $rawPage
        if ($page -and $page.Parameters) {
            $all += @($page.Parameters)
        }
        $nextToken = $page.NextToken
    }

    return @(
        $all |
            Where-Object {
                $_.Name -match "/STRIPE_(SECRET_KEY|PUBLISHABLE_KEY|WEBHOOK_SECRET)$"
            }
    )
}

function Get-SecretPrefix {
    param(
        [string]$Name,
        [string]$Profile,
        [string]$Region
    )

    try {
        $value = aws ssm get-parameter --name $Name --with-decryption --region $Region --profile $Profile --query "Parameter.Value" --output text 2>$null
        if (-not $value -or $value -eq "None") {
            return "(missing-value)"
        }

        $text = [string]$value
        if ($text.Length -ge 10) {
            return $text.Substring(0, 10)
        }
        return $text
    }
    catch {
        return "(unreadable)"
    }
}

function Get-ModeFromPrefix {
    param([string]$Prefix)

    if ($Prefix.StartsWith("sk_live_") -or $Prefix.StartsWith("pk_live_") -or $Prefix.StartsWith("whsec_live")) {
        return "live"
    }
    if ($Prefix.StartsWith("sk_test_") -or $Prefix.StartsWith("pk_test_") -or $Prefix.StartsWith("whsec_")) {
        return "test-or-unknown"
    }
    return "unknown"
}

$expectedBranchBase = "/amplify/$AppId/$BranchId"
$expectedKeys = @(
    "$expectedBranchBase/STRIPE_SECRET_KEY",
    "$expectedBranchBase/STRIPE_PUBLISHABLE_KEY",
    "$expectedBranchBase/STRIPE_WEBHOOK_SECRET"
)

Write-Host "Stripe SSM audit"
Write-Host "- Profile: $Profile"
Write-Host "- Region:  $Region"
Write-Host "- AppId:   $AppId"
Write-Host "- Branch:  $BranchId"
Write-Host ""

$lambdas = Get-StripeLambdaNames -Profile $Profile -Region $Region -AppId $AppId
if ($lambdas.Count -eq 0) {
    Write-Warning "No Stripe lambdas found for app id '$AppId'."
}

$referencedPaths = Get-ReferencedStripePaths -Profile $Profile -Region $Region -LambdaNames $lambdas -IncludeSharedPaths:$IncludeSharedPaths
$referencedSet = New-Object System.Collections.Generic.HashSet[string]
$referencedPaths | ForEach-Object { [void]$referencedSet.Add($_) }

$params = Get-StripeSsmParameters -Profile $Profile -Region $Region

$rows = foreach ($p in $params) {
    $prefix = Get-SecretPrefix -Name $p.Name -Profile $Profile -Region $Region
    $inUse = $referencedSet.Contains($p.Name)
    $isExpected = $expectedKeys -contains $p.Name
    $isAppNamePath = $p.Name.StartsWith("/amplify/multipleapps/")
    $mode = Get-ModeFromPrefix -Prefix $prefix

    $reason = @()
    if ($isExpected) { $reason += "expected-branch" }
    if ($inUse) { $reason += "referenced-by-lambda" }
    if ($isAppNamePath) { $reason += "legacy-app-name-path" }
    if ($p.Type -ne "SecureString") { $reason += "wrong-type" }

    $candidate = $false
    if (-not $isExpected -and -not $inUse) { $candidate = $true }
    if ($p.Type -ne "SecureString") { $candidate = $true }

    [PSCustomObject]@{
        Name             = $p.Name
        Type             = $p.Type
        Prefix           = $prefix
        ModeGuess        = $mode
        InUseByLambda    = $inUse
        ExpectedBranch   = $isExpected
        DeleteCandidate  = $candidate
        Reason           = ($reason -join ",")
        LastModifiedDate = $p.LastModifiedDate
    }
}

$rows | Sort-Object Name | Format-Table -AutoSize

$criticalMissing = @(
    $expectedKeys | Where-Object { -not ($rows.Name -contains $_) }
)
if ($criticalMissing.Count -gt 0) {
    Write-Host ""
    Write-Warning "Missing expected branch keys:"
    $criticalMissing | ForEach-Object { Write-Host "  - $_" }
}

$unsafeTypes = @($rows | Where-Object { $_.Type -ne "SecureString" })
if ($unsafeTypes.Count -gt 0) {
    Write-Host ""
    Write-Warning "Found Stripe parameters not using SecureString:"
    $unsafeTypes | ForEach-Object { Write-Host "  - $($_.Name) [$($_.Type)]" }
}

if ($DeleteCandidates) {
    $candidates = @($rows | Where-Object { $_.DeleteCandidate })
    if ($candidates.Count -eq 0) {
        Write-Host ""
        Write-Host "No delete candidates found."
        exit 0
    }

    Write-Host ""
    Write-Warning "Deleting candidate parameters (use with caution):"
    $candidates | ForEach-Object { Write-Host "  - $($_.Name)" }

    foreach ($c in $candidates) {
        aws ssm delete-parameter --name $c.Name --region $Region --profile $Profile | Out-Null
    }

    Write-Host "Cleanup completed."
}
else {
    Write-Host ""
    Write-Host "Dry-run only. To delete candidates, rerun with -DeleteCandidates."
}
