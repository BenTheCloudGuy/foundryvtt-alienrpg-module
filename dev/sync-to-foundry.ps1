<#
.SYNOPSIS
  Dev-loop file replication for the Weyland-Yutani Ship Terminal (Windows host).

.DESCRIPTION
  Mirrors the module's runtime assets from this repo into the locally installed
  FoundryVTT module directory using robocopy. Requires NO Node.js — everything
  here is built into Windows PowerShell. Reload the Foundry client (F5) after a
  sync to pick up the changes.

.PARAMETER Watch
  Keep running and re-sync whenever a runtime file changes (poll-based, ~1s).

.PARAMETER TargetDir
  Override the module install directory. Defaults to the WYT_FOUNDRY_MODULE_DIR
  environment variable, or the standard local install path.

.EXAMPLE
  pwsh -File dev/sync-to-foundry.ps1
  pwsh -File dev/sync-to-foundry.ps1 -Watch
#>
[CmdletBinding()]
param(
    [switch]$Watch,
    [string]$TargetDir = $(if ($env:WYT_FOUNDRY_MODULE_DIR) { $env:WYT_FOUNDRY_MODULE_DIR } else { 'C:\Users\bemitchell\OneDrive\FoundryVTT\data\modules\wy-terminal' })
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot

# Runtime assets Foundry loads (referenced by module.json). Dev-only folders
# (.git, node_modules, compendium-src, extracted-world-data, docs, etc.) are
# never synced.
$Dirs  = @('scripts', 'styles', 'templates', 'lang', 'images', 'muthur', 'media', 'packs', 'status')
$Files = @('module.json')

function Write-Log { param([string]$Msg) Write-Host "WY-Sync | $Msg" }

function Sync-All {
    param([switch]$Quiet)
    if (-not (Test-Path -LiteralPath $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }
    $changed = $false
    foreach ($d in $Dirs) {
        $src = Join-Path $RepoRoot $d
        if (-not (Test-Path -LiteralPath $src)) { continue }
        $dest = Join-Path $TargetDir $d
        # /MIR mirrors (incl. deletions); quiet flags keep the log clean.
        robocopy $src $dest /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
        # robocopy exit codes: 0 = no change, 1-7 = copies/extras handled, >=8 = error.
        if ($LASTEXITCODE -ge 8) { Write-Log "ERROR robocopy '$d' (exit $LASTEXITCODE)" }
        elseif ($LASTEXITCODE -ge 1) { $changed = $true }
    }
    foreach ($f in $Files) {
        $src = Join-Path $RepoRoot $f
        if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination (Join-Path $TargetDir $f) -Force }
    }
    if (-not $Quiet -or $changed) {
        Write-Log "Synced $($Dirs.Count) dirs + $($Files.Count) files -> $TargetDir"
    }
}

Sync-All

if ($Watch) {
    Write-Log 'Watching for changes - press Ctrl+C to stop.'
    # Poll the SOURCE tree's newest modification time and only mirror when it
    # advances. This avoids a constant re-copy loop when the target lives in a
    # OneDrive folder (OneDrive rewrites destination timestamps, which would
    # otherwise make robocopy /MIR think files changed on every cycle).
    function Get-SourceStamp {
        $latest = [datetime]::MinValue
        foreach ($d in $Dirs) {
            $src = Join-Path $RepoRoot $d
            if (-not (Test-Path -LiteralPath $src)) { continue }
            $newest = Get-ChildItem -LiteralPath $src -Recurse -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
            if ($newest -and $newest.LastWriteTimeUtc -gt $latest) { $latest = $newest.LastWriteTimeUtc }
        }
        foreach ($f in $Files) {
            $src = Join-Path $RepoRoot $f
            if (Test-Path -LiteralPath $src) {
                $t = (Get-Item -LiteralPath $src).LastWriteTimeUtc
                if ($t -gt $latest) { $latest = $t }
            }
        }
        return $latest
    }

    $lastStamp = Get-SourceStamp
    while ($true) {
        Start-Sleep -Seconds 1
        $stamp = Get-SourceStamp
        if ($stamp -gt $lastStamp) {
            $lastStamp = $stamp
            Sync-All -Quiet
        }
    }
}
