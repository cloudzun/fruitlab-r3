# 备份包装（Windows PowerShell）：调用 WSL 内的 scripts/backup.sh
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  wsl -e bash scripts/backup.sh
  if ($LASTEXITCODE -ne 0) { throw "backup failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}
