# 恢复包装（Windows PowerShell）：把 Windows 路径转成 WSL 路径后调用 restore.sh
param([Parameter(Mandatory = $true)][string]$File)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$wslFile = (wsl -e wslpath -a $File).Trim()
if (-not $wslFile) { throw "cannot resolve WSL path for $File" }
Push-Location $root
try {
  wsl -e bash scripts/restore.sh $wslFile
  if ($LASTEXITCODE -ne 0) { throw "restore failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}
