$port = if ($env:PORT) { [int]$env:PORT } else { 3000 }
$listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1

if ($listener) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
    $processLabel = if ($process) {
        "$($process.Name), PID $($process.ProcessId)"
    } else {
        "PID $($listener.OwningProcess)"
    }
    Write-Error "Port $port is already in use by $processLabel. Stop that process or set a different PORT before running pnpm.cmd dev."
    exit 1
}

& pnpm.cmd --filter '@bgc/cloudrun-server' dev
exit $LASTEXITCODE
