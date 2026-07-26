param(
    [switch]$RuntimeOnly
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Write-Ok($message) {
    Write-Host "[OK] $message" -ForegroundColor Green
}

function Write-Warn($message) {
    Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Test-Command($command) {
    return [bool](Get-Command $command -ErrorAction SilentlyContinue)
}

function Install-WingetPackage($id, $name, $extraArgs = @()) {
    Write-Step "Checking $name"

    $installed = winget list --id $id --exact --accept-source-agreements 2>$null
    if ($LASTEXITCODE -eq 0 -and ($installed -match [regex]::Escape($id))) {
        Write-Ok "$name is already installed"
        return
    }

    Write-Step "Installing $name"
    $args = @(
        "install",
        "--id", $id,
        "--exact",
        "--silent",
        "--accept-package-agreements",
        "--accept-source-agreements"
    ) + $extraArgs

    & winget @args
    if ($LASTEXITCODE -ne 0) {
        throw "$name installation failed"
    }
}

function Test-VisualStudioBuildTools {
    $candidates = @(
        "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe",
        "C:\Program Files\Microsoft Visual Studio\2022\BuildTools",
        "C:\Program Files\Microsoft Visual Studio\2022\Community",
        "C:\Program Files\Microsoft Visual Studio\2022\Professional",
        "C:\Program Files\Microsoft Visual Studio\2022\Enterprise"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $true
        }
    }

    return $false
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-SymlinkSupport {
    $tempDir = Join-Path ([IO.Path]::GetTempPath()) ("merlin-symlink-check-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    $targetPath = Join-Path $tempDir "target.txt"
    $linkPath = Join-Path $tempDir "link.txt"

    try {
        Set-Content -Path $targetPath -Value "merlin"
        New-Item -ItemType SymbolicLink -Path $linkPath -Target $targetPath -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    } finally {
        Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Enable-DeveloperMode {
    if (-not (Test-IsAdministrator)) {
        Write-Warn "Windows symlink creation is blocked. Run this setup from an Administrator PowerShell, or enable Windows Developer Mode manually."
        return
    }

    Write-Step "Enabling Windows Developer Mode for symlink support"
    $key = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock"
    New-Item -Path $key -Force | Out-Null
    New-ItemProperty -Path $key -Name "AllowDevelopmentWithoutDevLicense" -PropertyType DWord -Value 1 -Force | Out-Null
    New-ItemProperty -Path $key -Name "AllowAllTrustedApps" -PropertyType DWord -Value 1 -Force | Out-Null

    if (Test-SymlinkSupport) {
        Write-Ok "Windows symlink creation is available"
    } else {
        Write-Warn "Developer Mode was enabled, but this terminal still cannot create symlinks. Open a new PowerShell window or run the build as Administrator."
    }
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

Write-Step "Preparing Merlin on Windows"
Write-Host "Project: $projectRoot"

if (-not (Test-Command winget)) {
    throw "winget was not found. Install App Installer from Microsoft Store, then run this script again."
}

Install-WingetPackage "OpenJS.NodeJS.LTS" "Node.js LTS"
Install-WingetPackage "Git.Git" "Git for Windows"

if (-not $RuntimeOnly) {
    Install-WingetPackage "Kitware.CMake" "CMake"

    if (Test-VisualStudioBuildTools) {
        Write-Ok "Visual Studio Build Tools 2022 is already installed"
    } else {
        Write-Step "Installing Visual Studio Build Tools 2022"
        $vsOverride = "--wait --quiet --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
        Install-WingetPackage "Microsoft.VisualStudio.2022.BuildTools" "Visual Studio Build Tools 2022" @("--override", $vsOverride)
    }

    Write-Step "Checking Windows symlink support"
    if (Test-SymlinkSupport) {
        Write-Ok "Windows symlink creation is available"
    } else {
        Enable-DeveloperMode
    }
} else {
    Write-Warn "RuntimeOnly enabled: CMake and Visual Studio Build Tools will be skipped"
}

Write-Step "Refreshing PATH for this terminal"
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machinePath;$userPath"

Write-Step "Installing project dependencies"
& npm install
if ($LASTEXITCODE -ne 0) {
    throw "npm install failed"
}

Write-Step "Checking Merlin setup"
if ($RuntimeOnly) {
    & npm run doctor
} else {
    & npm run doctor -- --build
}

if ($LASTEXITCODE -ne 0) {
    throw "Merlin setup check failed"
}

Write-Host ""
Write-Ok "Merlin is ready."
if ($RuntimeOnly) {
    Write-Host "Run npm start to open the app."
} else {
    Write-Host "Run npm run release:local to build the installer."
}
