<#
Simple PowerShell script to start a local static server and expose it using cpolar.
Usage:
  cd D:\3dwebgis\landslide-monitor\deploy
  powershell -NoProfile -ExecutionPolicy Bypass -File .\start_tunnel.ps1
Optional environment variables: PORT, CPOLAR_TOKEN
#>

param()

$PORT = if ($env:PORT) { [int]$env:PORT } else { 5000 }
$CPOLAR_TOKEN = $env:CPOLAR_TOKEN

Write-Host "Starting tunnel script. Port=$PORT"

# Build if dist not found
if (-not (Test-Path "..\dist")) {
  Write-Error "dist directory not found! Please run 'npx vite build' in the project root first."
  exit 1
}

# Start local static server (prefer npx serve, fallback to python)
$serverProc = $null
if (Get-Command npx -ErrorAction SilentlyContinue) {
  $cmd = "npx serve ..\dist -l $PORT"
  Write-Host "Starting local static server: $cmd"
  $serverProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npx serve ..\dist -l $PORT" -NoNewWindow -PassThru
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
  $cmd = "python -m http.server $PORT --directory ..\dist"
  Write-Host "Starting local static server: $cmd"
  $serverProc = Start-Process -FilePath python -ArgumentList "-m","http.server",$PORT,"--directory","..\dist" -NoNewWindow -PassThru
} else {
  Write-Error "npx or python not found, cannot start static server."
  exit 1
}

Start-Sleep -Seconds 1
if ($serverProc -and -not $serverProc.HasExited) {
  Write-Host "Local static server started (PID=$($serverProc.Id))"
} else {
  Write-Error "Local static server failed to start"
  exit 1
}

# Start cpolar if available
if (-not (Get-Command cpolar -ErrorAction SilentlyContinue)) {
  Write-Warning "cpolar not found in PATH. Install cpolar and re-run if you want a public tunnel."
  Write-Host "Server is running locally. To stop: Stop-Process -Id $($serverProc.Id)"
  exit 0
}

if ($CPOLAR_TOKEN) {
  Write-Host "Applying cpolar authtoken"
  & cpolar authtoken $CPOLAR_TOKEN
}

Write-Host "Starting cpolar tunnel to port $PORT"
$cpStart = Start-Process -FilePath "cmd.exe" -ArgumentList "/c","cpolar http $PORT" -NoNewWindow -PassThru
Start-Sleep -Seconds 1

if ($cpStart -and -not $cpStart.HasExited) {
  Write-Host "cpolar started (PID=$($cpStart.Id))"
} else {
  Write-Warning "Failed to start cpolar. Check installation and PATH."
}

Write-Host "Done. Local server PID=$($serverProc.Id). cpolar PID=$($cpStart.Id)"
Write-Host "To stop: Stop-Process -Id $($serverProc.Id); Stop-Process -Id $($cpStart.Id)"
