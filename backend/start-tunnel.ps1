# start-tunnel.ps1 — Start backend + Cloudflare Tunnel
# Run this on your PC to expose the WhatsApp backend publicly
# No credit card. No account needed for quick tunnels.

Write-Host "`n=== Dhole Sir WhatsApp Backend + Cloudflare Tunnel ===" -ForegroundColor Cyan

# Step 1: Check if cloudflared is installed
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "`nInstalling cloudflared..." -ForegroundColor Yellow
    # Download cloudflared for Windows
    $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    $dest = "$env:LOCALAPPDATA\cloudflared\cloudflared.exe"
    New-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\cloudflared" | Out-Null
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
    $env:PATH += ";$env:LOCALAPPDATA\cloudflared"
    Write-Host "cloudflared installed at: $dest" -ForegroundColor Green
}

# Step 2: Start the backend in background
Write-Host "`nStarting WhatsApp backend on port 3001..." -ForegroundColor Green
$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $backendDir -PassThru -WindowStyle Minimized
Write-Host "Backend PID: $($backend.Id)" -ForegroundColor Green

# Give backend time to start
Start-Sleep -Seconds 3

# Step 3: Start Cloudflare Tunnel
Write-Host "`nStarting Cloudflare Tunnel..." -ForegroundColor Green
Write-Host "A public URL will appear below. Copy it and paste into netlify.toml" -ForegroundColor Yellow
Write-Host "Example: https://random-name.trycloudflare.com" -ForegroundColor Yellow
Write-Host ("-" * 55) -ForegroundColor Gray

cloudflared tunnel --url http://localhost:3001

# Cleanup on exit
Write-Host "`nStopping backend..." -ForegroundColor Yellow
Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
