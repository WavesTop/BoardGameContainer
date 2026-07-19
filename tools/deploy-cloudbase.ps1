param(
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $repo 'cloudbaserc.json'
$envPath = Join-Path $repo '.env'
$cli = Join-Path $repo 'node_modules\.bin\tcb.CMD'

if (-not (Test-Path -LiteralPath $configPath)) {
    throw 'cloudbaserc.json is missing. Run tools/configure-cloudbase.ps1 first.'
}
if (-not (Test-Path -LiteralPath $envPath)) {
    throw '.env is missing. Run tools/configure-cloudbase.ps1 first.'
}
if (-not (Test-Path -LiteralPath $cli)) {
    throw 'CloudBase CLI is missing. Run pnpm.cmd install first.'
}

$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $config.envId) {
    throw 'cloudbaserc.json does not contain envId.'
}

$envContent = Get-Content -LiteralPath $envPath -Raw -Encoding UTF8
$serviceMatch = [regex]::Match($envContent, '(?m)^TCB_SERVICE_NAME=(.+)$')
if (-not $serviceMatch.Success -or -not $serviceMatch.Groups[1].Value.Trim()) {
    throw '.env does not contain TCB_SERVICE_NAME.'
}
$serviceName = $serviceMatch.Groups[1].Value.Trim()

if ($ValidateOnly) {
    Write-Host "Checking CloudBase environment: $($config.envId)"
    & $cli cloudrun list
    if ($LASTEXITCODE -ne 0) {
        throw "CloudBase validation failed with exit code $LASTEXITCODE."
    }
    Write-Host "CloudBase deployment configuration is valid for service: $serviceName"
    Write-Host 'CloudBase CLI 3.6.2 has no remote dry-run option; no service was changed.'
    exit 0
}

$stagingRoot = [System.IO.Path]::GetFullPath((Join-Path $repo 'tmp\cloudbase-deploy'))
$expectedPrefix = [System.IO.Path]::GetFullPath($repo).TrimEnd('\') + '\'
if (-not $stagingRoot.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to prepare a deployment directory outside the repository: $stagingRoot"
}

if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $stagingRoot | Out-Null

foreach ($file in @(
    'Dockerfile',
    '.dockerignore',
    'cloudbaserc.json',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.base.json'
)) {
    Copy-Item -LiteralPath (Join-Path $repo $file) -Destination (Join-Path $stagingRoot $file)
}
foreach ($directory in @(
    'apps\cloudrun-server',
    'packages\protocol',
    'packages\game-sdk',
    'games\demo'
)) {
    $destination = Join-Path $stagingRoot $directory
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    foreach ($file in @('package.json', 'tsconfig.json', 'tsup.config.ts')) {
        $sourceFile = Join-Path (Join-Path $repo $directory) $file
        if (Test-Path -LiteralPath $sourceFile) {
            Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $destination $file)
        }
    }
    Copy-Item -LiteralPath (Join-Path (Join-Path $repo $directory) 'src') -Destination (Join-Path $destination 'src') -Recurse
}

Write-Host "Deploying CloudBase service: $serviceName"
Write-Host "Prepared minimal deployment source: $stagingRoot"
try {
    & $cli cloudrun deploy --serviceName $serviceName --source $stagingRoot --port 3000 --force
    if ($LASTEXITCODE -ne 0) {
        throw "CloudBase deployment failed with exit code $LASTEXITCODE."
    }
} finally {
    if (Test-Path -LiteralPath $stagingRoot) {
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    }
}
