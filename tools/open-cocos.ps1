. (Join-Path $PSScriptRoot 'common.ps1')
$creator = Find-CocosCreator
if (-not $creator) {
    $dashboard = Find-CocosDashboard
    if ($dashboard) { Start-Process -FilePath $dashboard }
    throw 'Cocos Dashboard is installed, but Creator 3.8.8 is not. Install 3.8.8 from the Dashboard Editors page, then run this script again.'
}
$project = Join-Path (Split-Path -Parent $PSScriptRoot) 'apps\game-client'
Write-Host "Opening Cocos Creator 3.8.8: $creator"
Write-Host "Project: $project"
Start-Process -FilePath $creator -ArgumentList '--project', $project
