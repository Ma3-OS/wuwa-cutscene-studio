# ===============================================================================
# WuWa Cutscene Studio - PowerShell Automation Engine
# Architecture: Clean, Non-Blocking, Cross-Version PowerShell Compatibility
# ===============================================================================
param(
    [string]$Action = ""
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

function Sync-MediaTools {
    $toolsDir = Join-Path $ProjectRoot 'tools'
    if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null }

    Write-Host "`n[1/3] Checking FFmpeg binary..." -ForegroundColor Cyan
    $ffmpeg = Join-Path $toolsDir 'ffmpeg.exe'
    if (Test-Path $ffmpeg) {
        Write-Host "   [OK] FFmpeg already installed in tools\ffmpeg.exe" -ForegroundColor Green
    } else {
        Write-Host "   Downloading FFmpeg standalone release..." -ForegroundColor Yellow
        $zip = Join-Path $toolsDir 'ffmpeg.zip'
        Invoke-WebRequest -Uri 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' -OutFile $zip
        Expand-Archive -Path $zip -DestinationPath $toolsDir -Force
        Get-ChildItem -Path $toolsDir -Recurse -Filter 'ffmpeg.exe' | ForEach-Object {
            Move-Item -Path $_.FullName -Destination $ffmpeg -Force
        }
        Remove-Item -Path $zip -Force -ErrorAction SilentlyContinue
        Write-Host "   [OK] FFmpeg successfully installed." -ForegroundColor Green
    }

    Write-Host "`n[2/3] Checking vgmstream binary..." -ForegroundColor Cyan
    $vgm = Join-Path $toolsDir 'vgmstream-cli.exe'
    if (Test-Path $vgm) {
        Write-Host "   [OK] vgmstream-cli already installed in tools\vgmstream-cli.exe" -ForegroundColor Green
    } else {
        Write-Host "   Downloading vgmstream win64..." -ForegroundColor Yellow
        $zip = Join-Path $toolsDir 'vgmstream.zip'
        Invoke-WebRequest -Uri 'https://github.com/vgmstream/vgmstream/releases/download/r2117/vgmstream-win64.zip' -OutFile $zip
        Expand-Archive -Path $zip -DestinationPath $toolsDir -Force
        Remove-Item -Path $zip -Force -ErrorAction SilentlyContinue
        Write-Host "   [OK] vgmstream successfully installed." -ForegroundColor Green
    }

    Write-Host "`n[3/3] Checking Wwiser parser..." -ForegroundColor Cyan
    $wwiserPy = Join-Path $toolsDir 'wwiser-master\wwiser.py'
    if (Test-Path $wwiserPy) {
        Write-Host "   [OK] Wwiser repository already present in tools\wwiser-master" -ForegroundColor Green
    } else {
        Write-Host "   Downloading Wwiser master..." -ForegroundColor Yellow
        $zip = Join-Path $toolsDir 'wwiser.zip'
        Invoke-WebRequest -Uri 'https://github.com/bnnm/wwiser/archive/refs/heads/master.zip' -OutFile $zip
        Expand-Archive -Path $zip -DestinationPath $toolsDir -Force
        Remove-Item -Path $zip -Force -ErrorAction SilentlyContinue
        Write-Host "   [OK] Wwiser successfully installed." -ForegroundColor Green
    }
}

function Sync-GameData {
    $dataDir = Join-Path $ProjectRoot 'data'
    if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }

    $files = @(
        @{ Name = 'videodata.json'; Url = 'https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/master/BinData/cgVedio/videodata.json' },
        @{ Name = 'videosound.json'; Url = 'https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/master/BinData/cgVedio/videosound.json' },
        @{ Name = 'videocaption.json'; Url = 'https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/master/BinData/cgVedio/videocaption.json' },
        @{ Name = 'keys.json'; Url = 'https://raw.githubusercontent.com/yarik0chka/wuwa-keys/main/keys.json' },
        @{ Name = 'MultiText.json'; Url = 'https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/master/Textmaps/th/multi_text/MultiText.json' }
    )

    foreach ($f in $files) {
        $dest = Join-Path $dataDir $f.Name
        Write-Host ("[*] Syncing " + $f.Name + "...") -ForegroundColor Cyan
        try {
            Invoke-WebRequest -Uri $f.Url -OutFile $dest -TimeoutSec 15
            Write-Host ("   [OK] " + $f.Name + " updated successfully.") -ForegroundColor Green
        } catch {
            Write-Host ("   [FAILED] " + $f.Name + ": " + $_.Exception.Message) -ForegroundColor Yellow
        }
    }
}

function Sync-Fonts {
    $fontsDir = Join-Path $ProjectRoot 'fonts'
    if (-not (Test-Path $fontsDir)) { New-Item -ItemType Directory -Path $fontsDir -Force | Out-Null }

    $weights = @('Kanit-Regular.ttf', 'Kanit-Medium.ttf', 'Kanit-Bold.ttf', 'Kanit-SemiBold.ttf')
    $existing = 0

    foreach ($w in $weights) {
        $fontPath = Join-Path $fontsDir $w
        if (Test-Path $fontPath) {
            Write-Host ("   [OK] Found fonts\" + $w) -ForegroundColor Green
            $existing++
        } else {
            Write-Host ("   [MISSING] fonts\" + $w) -ForegroundColor Yellow
        }
    }

    if ($existing -eq 0) {
        Write-Host "`n[*] Downloading Google Kanit font package..." -ForegroundColor Cyan
        $uri = 'https://github.com/google/fonts/raw/main/ofl/kanit/Kanit-Regular.ttf'
        Invoke-WebRequest -Uri $uri -OutFile (Join-Path $fontsDir 'Kanit-Regular.ttf')
        Write-Host "   [OK] Kanit-Regular.ttf downloaded." -ForegroundColor Green
    } else {
        Write-Host "`n[OK] Thai typography assets verified in project fonts directory." -ForegroundColor Green
    }
}

switch ($Action.ToLower()) {
    "tools" { Sync-MediaTools }
    "data"  { Sync-GameData }
    "fonts" { Sync-Fonts }
    default {
        Write-Host "Unknown action specified: $Action" -ForegroundColor Red
    }
}
