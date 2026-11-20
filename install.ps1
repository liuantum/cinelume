# Install the vox-video skill on Windows for Claude Code and/or Google Antigravity.
#   powershell -ExecutionPolicy Bypass -File install.ps1                 # both, user-level
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Target claude
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Target antigravity
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Project C:\code\myrepo
param([ValidateSet('all','claude','antigravity')][string]$Target = 'all', [string]$Project = '')
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot 'skills\vox-video'
$dests = @()
if ($Project) {
  $Project = (Resolve-Path $Project).Path
  if ($Target -in 'all','claude') { $dests += Join-Path $Project '.claude\skills\vox-video' }
  if ($Target -in 'all','antigravity') { $dests += Join-Path $Project '.agents\skills\vox-video' }
} else {
  if ($Target -in 'all','claude') { $dests += Join-Path $HOME '.claude\skills\vox-video' }
  if ($Target -in 'all','antigravity') {
    $dests += Join-Path $HOME '.gemini\config\skills\vox-video'
    if (Test-Path (Join-Path $HOME '.gemini\antigravity')) { $dests += Join-Path $HOME '.gemini\antigravity\skills\vox-video' }
  }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host '[vox] Node.js 18+ is required: https://nodejs.org'; exit 1 }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { Write-Host '[vox] WARNING: ffmpeg not found. Install with: winget install ffmpeg' }
foreach ($d in $dests) {
  Write-Host "[vox] installing -> $d"
  if (Test-Path $d) { Remove-Item $d -Recurse -Force }
  New-Item -ItemType Directory -Force -Path (Split-Path $d) | Out-Null
  Copy-Item $src $d -Recurse
  Push-Location (Join-Path $d 'engine'); npm install --silent --no-audit --no-fund; Pop-Location
}
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ }
if (-not $chrome) { Push-Location (Join-Path $dests[0] 'engine'); npx --yes playwright install chromium; Pop-Location }
Write-Host '[vox] done. Ask your agent: "Make a 45-second Vox-style reel about <topic>"'
