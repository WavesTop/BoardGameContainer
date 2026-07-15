param(
    [Parameter(Mandatory = $true)][string]$EnvId,
    [string]$ServiceName = 'boardgame-runtime'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$config = @{ envId = $EnvId } | ConvertTo-Json
Set-Content -LiteralPath (Join-Path $repo 'cloudbaserc.json') -Value $config -Encoding utf8

$envFile = Join-Path $repo '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
    Copy-Item -LiteralPath (Join-Path $repo '.env.example') -Destination $envFile
}

Write-Host "Configured project environment: $EnvId"
Write-Host "CloudBase service name: $ServiceName"
Write-Host 'No cloud resources were created. Run pnpm.cmd cloudbase:login, then pnpm.cmd cloudbase:envs.'
