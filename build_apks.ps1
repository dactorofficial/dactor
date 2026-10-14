# PowerShell script to build Dactor APKs with automatic version incrementing & naming
# Usage:
#   .\build_apks.ps1                  (Builds both apps, auto-incrementing versionCode and patch versionName)
#   .\build_apks.ps1 -App Clinic      (Builds only Clinic App)
#   .\build_apks.ps1 -App Patient     (Builds only Patient App)
#   .\build_apks.ps1 -Version "1.1.0" (Sets explicit version name, auto-increments versionCode)

param(
    [ValidateSet("All", "Clinic", "Patient")]
    [string]$App = "All",
    [string]$Version = "",
    [ValidateSet("Release", "Debug")]
    [string]$BuildType = "Release"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$apksDir = Join-Path $root "APKs"
if (-not (Test-Path $apksDir)) {
    New-Item -ItemType Directory -Path $apksDir | Out-Null
}

function Bump-App {
    param(
        [string]$AppName,
        [string]$AppDir,
        [string]$OutputPrefix
    )

    $gradlePath = Join-Path $AppDir "app\build.gradle.kts"
    if (-not (Test-Path $gradlePath)) {
        Write-Error "Cannot find build.gradle.kts at $gradlePath"
        return
    }

    $content = Get-Content $gradlePath -Raw

    # Parse current versionCode
    if ($content -match 'versionCode\s*=\s*(\d+)') {
        $oldCode = [int]$matches[1]
        $newCode = $oldCode + 1
    } else {
        $oldCode = 1
        $newCode = 2
    }

    # Parse current versionName
    if ($content -match 'versionName\s*=\s*"([^"]+)"') {
        $oldName = $matches[1]
    } else {
        $oldName = "1.0"
    }

    # Determine new versionName
    if ($Version -ne "") {
        $newName = $Version
    } else {
        # Auto-increment patch: e.g. "1.0" -> "1.0.1", "1.0.1" -> "1.0.2"
        $parts = $oldName.Split('.')
        if ($parts.Count -eq 2) {
            $newName = "$($parts[0]).$($parts[1]).1"
        } elseif ($parts.Count -ge 3) {
            $lastIndex = $parts.Count - 1
            $patch = 0
            [int]::TryParse($parts[$lastIndex], [ref]$patch) | Out-Null
            $parts[$lastIndex] = ($patch + 1).ToString()
            $newName = $parts -join '.'
        } else {
            $newName = "$oldName.1"
        }
    }

    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "Building ${AppName}: v${newName} (versionCode: ${newCode}, previous: v${oldName} / ${oldCode})" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Cyan

    # Replace versionCode and versionName in build.gradle.kts
    $updatedContent = $content -replace 'versionCode\s*=\s*\d+', "versionCode = $newCode"
    $updatedContent = $updatedContent -replace 'versionName\s*=\s*"[^"]+"', "versionName = `"$newName`""
    $written = $false
    for ($retry = 0; $retry -lt 10; $retry++) {
        try {
            Set-Content -Path $gradlePath -Value $updatedContent -NoNewline -ErrorAction Stop
            $written = $true
            break
        } catch {
            Start-Sleep -Milliseconds 1500
        }
    }
    if (-not $written) {
        Set-Content -Path $gradlePath -Value $updatedContent -NoNewline
    }

    # Run Gradle build directly in AppDir
    Push-Location $AppDir
    try {
        Write-Host "Running Gradle assemble${BuildType} in $AppDir..." -ForegroundColor Yellow
        if (Test-Path "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot") {
            $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
            $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
        } elseif (Test-Path "D:\jdk17") {
            $env:JAVA_HOME = "D:\jdk17"
            $env:PATH = "D:\jdk17\bin;$env:PATH"
        }
        & .\gradlew.bat "assemble$BuildType" --console=plain
        if ($LASTEXITCODE -ne 0) {
            throw "Gradle build failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }

    $btLower = $BuildType.ToLower()
    $searchLocations = @(
        (Join-Path $AppDir "app\build5\outputs\apk\$btLower"),
        (Join-Path $AppDir "app\build4\outputs\apk\$btLower"),
        (Join-Path $AppDir "app\build2\outputs\apk\$btLower"),
        (Join-Path $AppDir "app\build\outputs\apk\$btLower"),
        (Join-Path $AppDir "app\build3\outputs\apk\$btLower"),
        (Join-Path $AppDir "app\build5\outputs\apk\debug"),
        (Join-Path $AppDir "app\build4\outputs\apk\debug"),
        (Join-Path $AppDir "app\build2\outputs\apk\debug"),
        (Join-Path $AppDir "app\build\outputs\apk\debug")
    ) | Where-Object { Test-Path $_ }

    $found = Get-ChildItem -Path $searchLocations -Filter "*.apk" -Recurse -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1

    if (-not $found) {
        throw "Could not find built APK in $($searchLocations -join ', ')"
    }
    $builtApk = $found.FullName

    # Destination versioned APK
    $destVersionedName = "$OutputPrefix-v$newName.apk"
    $destVersionedPath = Join-Path $apksDir $destVersionedName
    Copy-Item $builtApk $destVersionedPath -Force

    # Also keep standard alias for backward compatibility
    $destAliasPath = Join-Path $apksDir "$OutputPrefix-$btLower.apk"
    Copy-Item $builtApk $destAliasPath -Force

    $fileSizeMB = [math]::Round(((Get-Item $destVersionedPath).Length / 1MB), 2)
    Write-Host "✅ Successfully generated: $destVersionedPath ($fileSizeMB MB)" -ForegroundColor Green
    return [PSCustomObject]@{
        AppName     = $AppName
        VersionName = $newName
        VersionCode = $newCode
        Path        = $destVersionedPath
        SizeMB      = $fileSizeMB
    }
}

$results = @()

if ($App -eq "All" -or $App -eq "Clinic") {
    $results += Bump-App -AppName "Clinic & Doctor App" -AppDir (Join-Path $root "clinic-app") -OutputPrefix "Dactor-ClinicApp"
}

if ($App -eq "All" -or $App -eq "Patient") {
    $results += Bump-App -AppName "Patient App" -AppDir (Join-Path $root "patient-app") -OutputPrefix "Dactor-PatientApp"
}

Write-Host "`n🎉 Build completed successfully!" -ForegroundColor Magenta
Write-Host "Artifacts stored in: $apksDir" -ForegroundColor Cyan
foreach ($res in $results) {
    Write-Host "  - $($res.AppName): v$($res.VersionName) (code $($res.VersionCode)) -> $($res.Path)" -ForegroundColor White
}
