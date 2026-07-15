$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
try {
    if (-not (Test-Path -LiteralPath '.env')) {
        Copy-Item -LiteralPath '.env.example' -Destination '.env'
        Write-Host 'Created .env from .env.example'
    }
    pnpm.cmd install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    pnpm.cmd typecheck
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    pnpm.cmd test
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & (Join-Path $PSScriptRoot 'check-env.ps1')
}
finally {
    Pop-Location
}
