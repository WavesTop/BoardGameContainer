param(
    [Parameter(Mandatory = $true)][string]$EnvId,
    [string]$ServiceName = 'boardgame-runtime'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$config = @{ envId = $EnvId } | ConvertTo-Json
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
$configPath = Join-Path $repo 'cloudbaserc.json'
[System.IO.File]::WriteAllText(
    $configPath,
    $config + [Environment]::NewLine,
    $utf8WithoutBom
)

$envFile = Join-Path $repo '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
    Copy-Item -LiteralPath (Join-Path $repo '.env.example') -Destination $envFile
}

$envContent = Get-Content -LiteralPath $envFile -Raw -Encoding UTF8
foreach ($entry in @{
    TCB_ENV_ID = $EnvId
    TCB_SERVICE_NAME = $ServiceName
}.GetEnumerator()) {
    $name = [regex]::Escape($entry.Key)
    $line = "$($entry.Key)=$($entry.Value)"
    if ($envContent -match "(?m)^$name=.*$") {
        $envContent = [regex]::Replace($envContent, "(?m)^$name=.*$", $line)
    } else {
        $envContent = $envContent.TrimEnd("`r", "`n") + [Environment]::NewLine + $line + [Environment]::NewLine
    }
}
[System.IO.File]::WriteAllText($envFile, $envContent, $utf8WithoutBom)

Write-Host "Configured project environment: $EnvId"
Write-Host "CloudBase service name: $ServiceName"
Write-Host 'No cloud resources were created. Run pnpm.cmd cloudbase:login, then pnpm.cmd cloudbase:envs.'
