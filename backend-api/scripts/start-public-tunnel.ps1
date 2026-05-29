param(
  [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ToolsDir = Join-Path $Root "tools"
$Cloudflared = Join-Path $ToolsDir "cloudflared.exe"
$HealthUrl = "http://localhost:3000/api/health"
$PublicUrlUpdateEndpoint = "http://localhost:3000/api/public-url"
$PublicUrlFile = Join-Path $Root "public-url.txt"
$TunnelToken = $env:CLOUDFLARE_TUNNEL_TOKEN
$PublicAppUrl = $env:PUBLIC_APP_URL
$CloudflareAccountId = $env:CLOUDFLARE_ACCOUNT_ID
$CloudflareApiToken = $env:CLOUDFLARE_API_TOKEN
$CloudflareKvNamespaceId = $env:CLOUDFLARE_KV_NAMESPACE_ID
$CloudflareKvTargetKey = $env:CLOUDFLARE_KV_TARGET_KEY
$PublicUrlUpdateToken = $env:PUBLIC_URL_UPDATE_TOKEN

function Test-BackendHealth {
  try {
    $response = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 5
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Import-EnvFile {
  $envPath = Join-Path $Root ".env"
  if (!(Test-Path $envPath)) {
    return
  }

  foreach ($rawLine in Get-Content $envPath) {
    $line = $rawLine.Trim()
    if (!$line -or $line.StartsWith("#") -or !$line.Contains("=")) {
      continue
    }

    $name, $value = $line.Split("=", 2)
    $name = $name.Trim()
    $value = $value.Trim().Trim('"').Trim("'")
    if ($name -and !(Test-Path "env:$name")) {
      Set-Item -Path "env:$name" -Value $value
    }
  }
}

function Update-WorkerTarget {
  param(
    [string]$TargetUrl
  )

  if (!$CloudflareAccountId -or !$CloudflareApiToken -or !$CloudflareKvNamespaceId) {
    return
  }

  $key = if ($CloudflareKvTargetKey) { $CloudflareKvTargetKey } else { "current-url" }
  $escapedKey = [System.Uri]::EscapeDataString($key)
  $endpoint = "https://api.cloudflare.com/client/v4/accounts/$CloudflareAccountId/storage/kv/namespaces/$CloudflareKvNamespaceId/values/$escapedKey"

  try {
    Invoke-RestMethod `
      -Uri $endpoint `
      -Method Put `
      -Headers @{ Authorization = "Bearer $CloudflareApiToken" } `
      -ContentType "text/plain" `
      -Body $TargetUrl `
      -TimeoutSec 20 | Out-Null

    if ($PublicAppUrl) {
      Set-Content -Path $PublicUrlFile -Value $PublicAppUrl
      Write-Host "Worker tetap aktif: $PublicAppUrl -> $TargetUrl" -ForegroundColor Green
    } else {
      Write-Host "Target Worker Cloudflare KV diperbarui: $TargetUrl" -ForegroundColor Green
    }
  } catch {
    Write-Host "Gagal update target Worker Cloudflare KV: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

function Update-PublicUrlDatabase {
  param(
    [string]$PublicUrl
  )

  $token = if ($PublicUrlUpdateToken) { $PublicUrlUpdateToken } else { $env:BETTER_AUTH_SECRET }
  if (!$token) {
    Write-Host "PUBLIC_URL_UPDATE_TOKEN/BETTER_AUTH_SECRET belum ada. URL publik belum bisa disimpan ke database." -ForegroundColor Yellow
    return
  }

  try {
    Invoke-RestMethod `
      -Uri $PublicUrlUpdateEndpoint `
      -Method Post `
      -Headers @{ "x-public-url-update-token" = $token } `
      -ContentType "application/json" `
      -Body (@{ publicApiUrl = $PublicUrl } | ConvertTo-Json) `
      -TimeoutSec 20 | Out-Null

    Write-Host "URL publik tersimpan di database: $PublicUrl" -ForegroundColor Green
  } catch {
    Write-Host "Gagal menyimpan URL publik ke database: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Set-Location $Root
Import-EnvFile
$TunnelToken = $env:CLOUDFLARE_TUNNEL_TOKEN
$PublicAppUrl = $env:PUBLIC_APP_URL
$CloudflareAccountId = $env:CLOUDFLARE_ACCOUNT_ID
$CloudflareApiToken = $env:CLOUDFLARE_API_TOKEN
$CloudflareKvNamespaceId = $env:CLOUDFLARE_KV_NAMESPACE_ID
$CloudflareKvTargetKey = $env:CLOUDFLARE_KV_TARGET_KEY
$PublicUrlUpdateToken = $env:PUBLIC_URL_UPDATE_TOKEN

if (!(Test-Path $ToolsDir)) {
  New-Item -ItemType Directory -Path $ToolsDir | Out-Null
}

if (!(Test-Path $Cloudflared)) {
  Write-Host "Mengunduh cloudflared lokal..." -ForegroundColor Cyan
  $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
  if (Get-Command "curl.exe" -ErrorAction SilentlyContinue) {
    & curl.exe -L --fail --retry 3 --output $Cloudflared $url
  } else {
    Invoke-WebRequest -Uri $url -OutFile $Cloudflared
  }
}

if (!$SkipBackend) {
  Write-Host "Menyalakan PostgreSQL Docker..." -ForegroundColor Cyan
  docker compose up -d

  if (!(Test-BackendHealth)) {
    Write-Host "Menjalankan backend di http://localhost:3000 ..." -ForegroundColor Cyan
    $stdout = Join-Path $Root "backend-dev.log"
    $stderr = Join-Path $Root "backend-dev.err.log"
    Start-Process -FilePath "npm.cmd" `
      -ArgumentList "run", "dev" `
      -WorkingDirectory $Root `
      -WindowStyle Hidden `
      -RedirectStandardOutput $stdout `
      -RedirectStandardError $stderr

    for ($i = 0; $i -lt 30; $i++) {
      Start-Sleep -Seconds 1
      if (Test-BackendHealth) {
        break
      }
    }
  }

  if (!(Test-BackendHealth)) {
    throw "Backend belum merespons di $HealthUrl. Cek backend-dev.log dan backend-dev.err.log."
  }
}

Write-Host ""
Write-Host "Backend lokal siap: http://localhost:3000" -ForegroundColor Green
Write-Host "Biarkan terminal ini tetap terbuka selama akses dari luar jaringan dibutuhkan." -ForegroundColor Yellow
Write-Host ""

if ($TunnelToken) {
  if ($PublicAppUrl) {
    Set-Content -Path $PublicUrlFile -Value $PublicAppUrl
    Update-PublicUrlDatabase -PublicUrl $PublicAppUrl
    Write-Host "Membuka Cloudflare Named Tunnel tetap: $PublicAppUrl" -ForegroundColor Green
    Write-Host "URL juga disimpan di: $PublicUrlFile" -ForegroundColor Green
  } else {
    Write-Host "Membuka Cloudflare Named Tunnel tetap dari CLOUDFLARE_TUNNEL_TOKEN." -ForegroundColor Green
    Write-Host "Isi PUBLIC_APP_URL di .env agar URL tetap ikut tersimpan di public-url.txt." -ForegroundColor Yellow
  }

  $ErrorActionPreference = "Continue"
  & $Cloudflared tunnel --no-autoupdate run --token $TunnelToken
  exit $LASTEXITCODE
}

Write-Host "Membuka Cloudflare Quick Tunnel. URL https://*.trycloudflare.com akan berubah setiap restart." -ForegroundColor Green
Write-Host "URL aktif akan otomatis disimpan di: $PublicUrlFile" -ForegroundColor Green
if ($PublicAppUrl -and $CloudflareAccountId -and $CloudflareApiToken -and $CloudflareKvNamespaceId) {
  Write-Host "Wrapper tetap aktif. Script akan update target Worker: $PublicAppUrl" -ForegroundColor Green
} elseif ($PublicAppUrl) {
  Write-Host "PUBLIC_APP_URL ada, tapi kredensial KV belum lengkap. Worker belum bisa auto-update." -ForegroundColor Yellow
}
Write-Host ""

$ErrorActionPreference = "Continue"
& $Cloudflared tunnel --url "http://localhost:3000" 2>&1 | ForEach-Object {
  $line = $_.ToString()
  Write-Host $line
  if ($line -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
    $quickTunnelUrl = $Matches[0]
    if (!$PublicAppUrl -or !$CloudflareAccountId -or !$CloudflareApiToken -or !$CloudflareKvNamespaceId) {
      Set-Content -Path $PublicUrlFile -Value $quickTunnelUrl
      Update-PublicUrlDatabase -PublicUrl $quickTunnelUrl
    } else {
      Update-PublicUrlDatabase -PublicUrl $PublicAppUrl
    }
    Update-WorkerTarget -TargetUrl $quickTunnelUrl
  }
}

exit $LASTEXITCODE
