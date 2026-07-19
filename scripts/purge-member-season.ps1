param(
    [switch]$Apply,
    [string]$ProfileName = "amplify-dev",
    [string]$Region = "eu-west-3",
    [string]$TableName = "",
    [string]$ReportPath = ""
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
    $ReportPath = Join-Path (Get-Location) ("member-season-purge-report-{0}.json" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
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
$toChange = New-Object System.Collections.Generic.List[object]

foreach ($item in $items) {
    $id = Get-DynamoStringValue $item.id
    if ([string]::IsNullOrWhiteSpace($id)) {
        continue
    }

    $seasonAttr = if ($item.PSObject.Properties['season']) { $item.season } else { $null }
    $currentSeason = Get-DynamoStringValue $seasonAttr
    $hasSeasonAttribute = $null -ne $seasonAttr

    $entry = [ordered]@{
        id = $id
        currentSeason = $currentSeason
        hasSeason = $hasSeasonAttribute
        willRemove = $hasSeasonAttribute
    }
    $report.Add([pscustomobject]$entry)

    if ($hasSeasonAttribute) {
        $toChange.Add([pscustomobject]@{
            id = $id
            season = $currentSeason
        })
    }
}

$report | ConvertTo-Json -Depth 5 | Out-File -FilePath $ReportPath -Encoding utf8

Write-Host ""
Write-Host ("Rows with season to remove: {0}" -f $toChange.Count) -ForegroundColor Yellow

if ($toChange.Count -gt 0) {
    Write-Host "Sample rows:" -ForegroundColor Cyan
    $toChange | Select-Object -First 20 | ForEach-Object {
        Write-Host ("  {0}: '{1}'" -f $_.id, $_.season)
    }
}

if (-not $Apply) {
    Write-Host ""
    Write-Host "Dry-run complete. Re-run with -Apply to remove season attributes." -ForegroundColor Yellow
    exit 0
}

$ok = 0
$err = 0

foreach ($row in $toChange) {
    $key = @{ id = @{ S = $row.id } } | ConvertTo-Json -Compress
    $attr = @{ ':u' = @{ S = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ') } } | ConvertTo-Json -Compress

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
            --update-expression "REMOVE season SET updatedAt = :u" `
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
Write-Host ("Purge complete: {0} updated, {1} errors." -f $ok, $err) -ForegroundColor Cyan
Write-Host ("Detailed report: {0}" -f $ReportPath)