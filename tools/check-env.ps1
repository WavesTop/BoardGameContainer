param([switch]$Strict)

. (Join-Path $PSScriptRoot 'common.ps1')

$repo = Split-Path -Parent $PSScriptRoot
$cocosDashboard = Find-CocosDashboard
$cocosCreator = Find-CocosCreator
$wechatDevTools = Find-WeChatDevToolsCli
$cocosDetail = if ($cocosCreator) { $cocosCreator } else { 'install through Cocos Dashboard' }
$dashboardDetail = if ($cocosDashboard) { $cocosDashboard } else { 'install Cocos Dashboard' }
$wechatDetail = if ($wechatDevTools) { $wechatDevTools } else { 'install from the official WeChat developer site' }
$checks = @(
    [pscustomobject]@{ Name = 'Node 24'; Required = $true; Found = [bool](Get-Command node.exe -ErrorAction SilentlyContinue); Detail = if (Get-Command node.exe -ErrorAction SilentlyContinue) { node.exe --version } else { 'not found' } },
    [pscustomobject]@{ Name = 'pnpm 11'; Required = $true; Found = [bool](Get-Command pnpm.cmd -ErrorAction SilentlyContinue); Detail = if (Get-Command pnpm.cmd -ErrorAction SilentlyContinue) { pnpm.cmd --version } else { 'not found' } },
    [pscustomobject]@{ Name = 'Git'; Required = $true; Found = [bool](Get-Command git.exe -ErrorAction SilentlyContinue); Detail = if (Get-Command git.exe -ErrorAction SilentlyContinue) { git.exe --version } else { 'not found' } },
    [pscustomobject]@{ Name = 'Workspace dependencies'; Required = $true; Found = Test-Path -LiteralPath (Join-Path $repo 'node_modules'); Detail = 'run pnpm.cmd install' },
    [pscustomobject]@{ Name = 'Cocos Dashboard'; Required = $false; Found = [bool]$cocosDashboard; Detail = $dashboardDetail },
    [pscustomobject]@{ Name = 'Cocos Creator 3.8.8'; Required = $false; Found = [bool]$cocosCreator; Detail = $cocosDetail },
    [pscustomobject]@{ Name = 'WeChat DevTools'; Required = $false; Found = [bool]$wechatDevTools; Detail = $wechatDetail },
    [pscustomobject]@{ Name = 'CloudBase project config'; Required = $false; Found = Test-Path -LiteralPath (Join-Path $repo 'cloudbaserc.json'); Detail = 'run tools/configure-cloudbase.ps1 after login' },
    [pscustomobject]@{ Name = 'Local .env'; Required = $false; Found = Test-Path -LiteralPath (Join-Path $repo '.env'); Detail = 'created from .env.example by bootstrap' }
)

$checks | Format-Table Name, Required, Found, Detail -AutoSize

$missingRequired = @($checks | Where-Object { $_.Required -and -not $_.Found })
$missingOptional = @($checks | Where-Object { -not $_.Required -and -not $_.Found })
Write-Host "Required missing: $($missingRequired.Count); optional pending: $($missingOptional.Count)"
if ($Strict -and ($missingRequired.Count -gt 0 -or $missingOptional.Count -gt 0)) { exit 1 }
if ($missingRequired.Count -gt 0) { exit 1 }
