param(
    [switch]$Apply,
    [string]$ProfileName = "amplify-dev",
    [string]$Region = "eu-west-3",
    [string]$TableName = "",
    [string]$ReportPath = "",
    [switch]$SkipUnknown
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-TableByPrefix([string]$prefix) {
    $tables = (aws dynamodb list-tables --profile $ProfileName --region $Region --output json | ConvertFrom-Json).TableNames
    $match = @($tables | Where-Object { $_ -like "${prefix}-*" })

    if ($match.Count -eq 0) {
        throw "No table '${prefix}-*' found. Pass -TableName explicitly."
    }

    if ($match.Count -gt 1) {
        throw "Multiple '${prefix}-*' tables found: $($match -join ', '). Pass -TableName explicitly."
    }

    return $match[0]
}

function Get-DynamoStringValue($attr) {
    if ($null -eq $attr) { return $null }
    if ($attr.PSObject.Properties['S']) { return [string]$attr.S }
    if ($attr.PSObject.Properties['N']) { return [string]$attr.N }
    return $null
}

function ConvertTo-NormalizedGender([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) { return 'U' }

    $v = $value.Trim().ToUpperInvariant()

    if ($v -in @('M', 'M.', 'MONSIEUR', 'H', 'HOMME', '1')) { return 'M' }
    if ($v -in @('F', 'MME', 'MADAME', 'FEMME', '0', '2')) { return 'F' }

    return 'U'
}

function New-Utf8NoBomFile([string]$content) {
    $path = [System.IO.Path]::GetTempFileName()
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
    return $path
}

if (-not $TableName) {
    $TableName = Get-TableByPrefix 'Member'
}

if (-not $ReportPath) {
    $ReportPath = Join-Path (Get-Location) ("member-gender-migration-report-{0}.json" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
}

Write-Host ""
Write-Host "Table    : $TableName"
Write-Host "Region   : $Region"
Write-Host "Profile  : $ProfileName"
Write-Host "Report   : $ReportPath"
if ($Apply) {
    Write-Host "Mode     : APPLY" -ForegroundColor Green
} else {
    Write-Host "Mode     : DRY-RUN (no writes)" -ForegroundColor Yellow
}
if ($SkipUnknown) {
    Write-Host "Unknowns : SKIPPED (no write when normalized value is U)" -ForegroundColor Yellow
}
Write-Host ""

$items = @()
$exclusiveStartKey = $null
$page = 0

while ($true) {
    $page++
    $scanCmd = @(
        'dynamodb', 'scan',
        '--profile', $ProfileName,
        '--region', $Region,
        '--table-name', $TableName,
        '--output', 'json'
    )

    $eskFile = $null
    try {
        if ($null -ne $exclusiveStartKey) {
            $eskJson = $exclusiveStartKey | ConvertTo-Json -Depth 20 -Compress
            $eskFile = New-Utf8NoBomFile $eskJson
            $scanCmd += @('--exclusive-start-key', "file://$eskFile")
        }

        $scanResultRaw = & aws @scanCmd
        if ($LASTEXITCODE -ne 0) {
            throw "aws dynamodb scan failed on page $page"
        }
        $scanResult = $scanResultRaw | ConvertFrom-Json
        $items += @($scanResult.Items)

        Write-Host ("Scanned page {0} - cumulative items: {1}" -f $page, $items.Count)

        if ($scanResult.PSObject.Properties['LastEvaluatedKey'] -and $null -ne $scanResult.LastEvaluatedKey) {
            $exclusiveStartKey = $scanResult.LastEvaluatedKey
        } else {
            break
        }
    }
    finally {
        if ($eskFile) {
            Remove-Item $eskFile -ErrorAction SilentlyContinue
        }
    }
}

if ($items.Count -eq 0) {
    Write-Host "No items found." -ForegroundColor Yellow
    exit 0
}

$report = New-Object System.Collections.Generic.List[object]
$summaryCurrent = @{}
$summaryTarget = @{}
$toChange = New-Object System.Collections.Generic.List[object]

foreach ($item in $items) {
    $id = Get-DynamoStringValue $item.id
    if ([string]::IsNullOrWhiteSpace($id)) {
        continue
    }

    $rawGender = Get-DynamoStringValue $item.gender
    if (-not $summaryCurrent.ContainsKey("$rawGender")) { $summaryCurrent["$rawGender"] = 0 }
    $summaryCurrent["$rawGender"]++

    $normalized = ConvertTo-NormalizedGender $rawGender
    if (-not $summaryTarget.ContainsKey($normalized)) { $summaryTarget[$normalized] = 0 }
    $summaryTarget[$normalized]++

    $currentCanonical = if ($rawGender) { $rawGender.Trim().ToUpperInvariant() } else { '' }
    $needsUpdate = ($currentCanonical -ne $normalized)

    $entry = [ordered]@{
        id = $id
        currentGender = $rawGender
        targetGender = $normalized
        willUpdate = $needsUpdate
    }
    $report.Add([pscustomobject]$entry)

    if ($needsUpdate) {
        if ($SkipUnknown -and $normalized -eq 'U') {
            continue
        }
        $toChange.Add([pscustomobject]@{
            id = $id
            from = $rawGender
            to = $normalized
        })
    }
}

$report | ConvertTo-Json -Depth 5 | Out-File -FilePath $ReportPath -Encoding utf8

Write-Host ""
Write-Host "Current gender distribution:" -ForegroundColor Cyan
$summaryCurrent.GetEnumerator() | Sort-Object Name | ForEach-Object {
    Write-Host ("  '{0}' : {1}" -f $_.Name, $_.Value)
}

Write-Host ""
Write-Host "Target distribution after normalization:" -ForegroundColor Cyan
$summaryTarget.GetEnumerator() | Sort-Object Name | ForEach-Object {
    Write-Host ("  {0} : {1}" -f $_.Name, $_.Value)
}

Write-Host ""
Write-Host ("Rows needing update: {0}" -f $toChange.Count) -ForegroundColor Yellow

if ($toChange.Count -gt 0) {
    Write-Host "Sample changes:" -ForegroundColor Cyan
    $toChange | Select-Object -First 20 | ForEach-Object {
        Write-Host ("  {0}: '{1}' -> '{2}'" -f $_.id, $_.from, $_.to)
    }
}

if (-not $Apply) {
    Write-Host ""
    Write-Host "Dry-run complete. Re-run with -Apply to write changes." -ForegroundColor Yellow
    exit 0
}

$ok = 0
$err = 0

foreach ($row in $toChange) {
    $key = @{ id = @{ S = $row.id } } | ConvertTo-Json -Compress
    $attr = @{
        ':g' = @{ S = $row.to }
        ':u' = @{ S = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ') }
    } | ConvertTo-Json -Compress

    $keyFile = $null
    $attrFile = $null
    try {
        $keyFile = New-Utf8NoBomFile $key
        $attrFile = New-Utf8NoBomFile $attr

        $ErrorActionPreference = 'Continue'
        $output = aws dynamodb update-item `
            --profile $ProfileName `
            --region $Region `
            --table-name $TableName `
            --key "file://$keyFile" `
            --update-expression "SET gender = :g, updatedAt = :u" `
            --expression-attribute-values "file://$attrFile" 2>&1
        $exitCode = $LASTEXITCODE
        $ErrorActionPreference = 'Stop'

        if ($exitCode -eq 0) {
            $ok++
        } else {
            $err++
            $outputText = ($output | Out-String).Trim()
            if ([string]::IsNullOrWhiteSpace($outputText)) {
                $outputText = "Unknown error (empty AWS CLI output)."
            }

            Write-Host ("ERR {0}: {1}" -f $row.id, $outputText) -ForegroundColor Red

            if ($outputText -match 'AccessDeniedException|not authorized to perform: dynamodb:UpdateItem') {
                Write-Host "" -ForegroundColor Yellow
                Write-Host "Stopping early: missing IAM permission dynamodb:UpdateItem for current AWS principal." -ForegroundColor Yellow
                Write-Host "Grant permission on table '$TableName' then re-run with -Apply." -ForegroundColor Yellow
                break
            }
        }
    }
    finally {
        if ($keyFile) { Remove-Item $keyFile -ErrorAction SilentlyContinue }
        if ($attrFile) { Remove-Item $attrFile -ErrorAction SilentlyContinue }
    }
}

Write-Host ""
Write-Host ("Migration complete: {0} updated, {1} errors." -f $ok, $err) -ForegroundColor Cyan
Write-Host ("Detailed report: {0}" -f $ReportPath)
