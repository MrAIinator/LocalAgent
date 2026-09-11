$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "LocalAgent 0.1_beta"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not in PATH. Install the Windows .msi from https://nodejs.org/dist/v24.21.0/node-v24.21.0-x64.msi"
  Read-Host "Press Enter to exit"
  exit 1
}

if (-not (Test-Path ".\node_modules\vite\bin\vite.js")) {
  Write-Host "Installing packages..."
  npm install --include=dev --no-fund --no-audit
}

$electronExe = ".\node_modules\electron\dist\electron.exe"
if (-not (Test-Path $electronExe)) {
  Write-Host "Downloading Electron..."
  if (Get-Command npm -ErrorAction SilentlyContinue) {
    try { npm install-scripts approve electron } catch {}
  }
  if (Test-Path ".\node_modules\electron\install.js") {
    node ".\node_modules\electron\install.js"
  }
}

$env:ELECTRON_START_URL = "http://127.0.0.1:8080"
Write-Host "Starting UI..."
$vite = Start-Process -FilePath "node" -ArgumentList ".\node_modules\vite\bin\vite.js","--host","127.0.0.1","--port","8080" -WorkingDirectory $PSScriptRoot -PassThru -WindowStyle Hidden

$ok = $false
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/" -UseBasicParsing -TimeoutSec 1
    if ($r.StatusCode -ge 200) { $ok = $true; break }
  } catch {}
}
if (-not $ok) {
  Write-Host "UI server did not start."
  try { Stop-Process -Id $vite.Id -Force } catch {}
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host "Opening window..."
node ".\node_modules\electron\cli.js" ".\electron\main.cjs"
try { Stop-Process -Id $vite.Id -Force } catch {}
