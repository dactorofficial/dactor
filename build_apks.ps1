# PowerShell script to build Dactor APKs with automatic version incrementing & naming
# Usage:
#   .\build_apks.ps1                  (Builds both apps, auto-incrementing versionCode and patch versionName)
#   .\build_apks.ps1 -App Clinic      (Builds only Clinic App)
#   .\build_apks.ps1 -App Patient     (Builds only Patient App)
#   .\build_apks.ps1 -Version "1.1.0" (Sets explicit version name, auto-increments versionCode)

param(
    [ValidateSet("All", "Clinic", "Patient")]
    [string]$App = "All",
    [string]$Version = ""
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
    Set-Content -Path $gradlePath -Value $updatedContent -NoNewline

    # Run Gradle build
    Push-Location $AppDir
    try {
        Write-Host "Running Gradle assembleDebug in $AppDir..." -ForegroundColor Yellow
        $initScript = "C:\Users\Harsh Darak\.gemini\antigravity\brain\704233db-21ec-4cc5-a8c5-42ae9e0f941c\scratch\local-build.init.gradle"
        $cacheDir = "C:\Users\Harsh Darak\AppData\Local\Temp\dactor_gradle_cache_$($AppName -replace '\s','_')"
        if (Test-Path $initScript) {
            & .\gradlew.bat assembleDebug --console=plain --init-script $initScript --project-cache-dir $cacheDir
        } else {
            & .\gradlew.bat assembleDebug --console=plain
        }
        if ($LASTEXITCODE -ne 0) {
            throw "Gradle build failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }

    # Locate generated APK
    $possibleApks = @(
        (Join-Path $AppDir "app\build_gen_apk\outputs\apk\debug\app-debug.apk"),
        (Join-Path $AppDir "app\build_verify_fresh\outputs\apk\debug\app-debug.apk"),
        (Join-Path $AppDir "app\build2\outputs\apk\debug\app-debug.apk"),
        (Join-Path $AppDir "app\build\outputs\apk\debug\app-debug.apk"),
        (Join-Path $AppDir "app\build_gen_apk\outputs\apk\debug\*-debug.apk"),
        (Join-Path $AppDir "app\build_verify_fresh\outputs\apk\debug\*-debug.apk"),
        (Join-Path $AppDir "app\build2\outputs\apk\debug\*-debug.apk"),
        (Join-Path $AppDir "app\build\outputs\apk\debug\*-debug.apk")
    )
    $builtApk = $null
    foreach ($candidate in $possibleApks) {
        $resolved = Get-Item $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolved) {
            $builtApk = $resolved.FullName
            break
        }
    }

    if (-not $builtApk) {
        $found = Get-ChildItem -Path (Join-Path $AppDir "app") -Filter "*.apk" -Recurse -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($found) { $builtApk = $found.FullName }
    }

    if (-not $builtApk) {
        throw "Could not find built APK in $AppDir"
    }

    # Destination versioned APK
    $destVersionedName = "$OutputPrefix-v$newName.apk"
    $destVersionedPath = Join-Path $apksDir $destVersionedName
    Copy-Item $builtApk $destVersionedPath -Force

    # Also keep standard alias for backward compatibility
    $destAliasPath = Join-Path $apksDir "$OutputPrefix-debug.apk"
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
