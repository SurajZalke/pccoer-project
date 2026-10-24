# setup-permanent-tunnel.ps1
# Creates a NAMED permanent tunnel with a fixed subdomain
# Requires free Cloudflare account (no card) + a domain added to Cloudflare
#
# One-time setup. After this, just run: cloudflared service install

param(
    [string]$TunnelName = "dhole-sir-whatsapp",
    [string]$Hostname   = "api.your-domain.com"  # Change to your domain
)

Write-Host "`n=== Permanent Cloudflare Tunnel Setup ===" -ForegroundColor Cyan
Write-Host "Tunnel name: $TunnelName"
Write-Host "Hostname:    $Hostname"

# 1. Login (opens browser)
Write-Host "`nStep 1: Login to Cloudflare..." -ForegroundColor Green
cloudflared login

# 2. Create named tunnel
Write-Host "`nStep 2: Creating tunnel '$TunnelName'..." -ForegroundColor Green
cloudflared tunnel create $TunnelName

# 3. Create config file
$configDir  = "$env:USERPROFILE\.cloudflared"
$configFile = "$configDir\config.yml"
$tunnelId   = (cloudflared tunnel list --output json | ConvertFrom-Json | Where-Object { $_.name -eq $TunnelName }).id

$config = @"
tunnel: $tunnelId
credentials-file: $configDir\$tunnelId.json

ingress:
  - hostname: $Hostname
    service: http://localhost:3001
  - service: http_status:404
"@

Set-Content -Path $configFile -Value $config
Write-Host "Config written to: $configFile" -ForegroundColor Green

# 4. Create DNS record
Write-Host "`nStep 3: Creating DNS CNAME for $Hostname..." -ForegroundColor Green
cloudflared tunnel route dns $TunnelName $Hostname

# 5. Install as Windows service (auto-starts on boot)
Write-Host "`nStep 4: Installing as Windows service (auto-start)..." -ForegroundColor Green
cloudflared service install

Write-Host "`n=== Done! ===" -ForegroundColor Cyan
Write-Host "Your permanent URL: https://$Hostname" -ForegroundColor Green
Write-Host "`nNow update netlify.toml:"
Write-Host "  to = `"https://$Hostname/:splat`"" -ForegroundColor Yellow
