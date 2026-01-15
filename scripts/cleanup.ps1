
Write-Host "--- DETECTING AND KILLING GHOST PROCESSES ---" -ForegroundColor Yellow

$targets = @("electron", "ffmpeg", "python")

# 1. Kill Specific Node Processes (Server/Vite) to avoid killing the npm runner itself
$nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"
foreach ($p in $nodeProcs) {
    if ($p.CommandLine -match "server-proxy.js" -or $p.CommandLine -match "vite") {
         Write-Host "Killing Node Process likely related to App: $($p.ProcessId)" -ForegroundColor Red
         Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

# 2. Kill other binary targets
foreach ($procName in $targets) {
    $procs = Get-Process -Name $procName -ErrorAction SilentlyContinue
    if ($procs) {
        Write-Host "Found $($procs.Count) instance(s) of '$procName'. Killing..." -ForegroundColor Red
        Stop-Process -Name $procName -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "No instances of '$procName' found." -ForegroundColor Gray
    }
}

# Optional: Check port 3001
$port = 3001
$tcp = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($tcp) {
    Write-Host "Port $port is still in use by PID $($tcp.OwningProcess). Killing..." -ForegroundColor Red
    Stop-Process -Id $tcp.OwningProcess -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "Port $port is free." -ForegroundColor Green
}

Write-Host "--- CLEANUP COMPLETE ---" -ForegroundColor Green
Write-Host "You can now safely start the server." -ForegroundColor Yellow
