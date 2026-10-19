#requires -Version 5.1
<#
.SYNOPSIS
  一键复现 FruitLab R3.5 的 Azure VM 演示场景（独立资源组，不动现有生产 VM）。

.DESCRIPTION
  默认在 rg-fruitlab-demo / vm-fruitlab-demo 上：
  - 创建/复用资源组、VM、NSG、公网 IP DNS label
  - 安装 Docker + Caddy
  - 上传 deploy/vps 资产，生成生产 .env.production（随机口令）
  - 配置 Caddy（Let's Encrypt TLS）
  - 拉取 Docker Hub 镜像并部署 3.5.0.0
  - 跑 smoke.sh（health / admin 登录 / userA 401 / 下单）
  口令保存在 deploy/azure/.secrets/，不进入 Git。

.PARAMETER Action
  up（默认）| plan | status | deploy | stop | destroy

.EXAMPLE
  .\deploy\azure\az-vm-demo.ps1 -Action plan
  .\deploy\azure\az-vm-demo.ps1 -Action up
  .\deploy\azure\az-vm-demo.ps1 -Action status
  .\deploy\azure\az-vm-demo.ps1 -Action deploy -ImageTag 3.5.0.0
  .\deploy\azure\az-vm-demo.ps1 -Action stop
  .\deploy\azure\az-vm-demo.ps1 -Action destroy -Force

.NOTES
  前置：az login（MCT Benefit 订阅）、OpenSSH client、tar、Docker Hub 镜像可拉。
  NSG 会开放 22/80/443；仅用于课堂/演示，演示完请 stop 或 destroy。
#>
[CmdletBinding()]
param(
  [ValidateSet("up", "plan", "status", "deploy", "stop", "destroy")]
  [string]$Action = "up",
  [string]$ResourceGroup = "rg-fruitlab-demo",
  [string]$VmName = "vm-fruitlab-demo",
  [string]$Location = "eastasia",
  [string]$VmSize = "Standard_B2s",
  [string]$DnsLabel = "",
  [string]$ImageTag = "3.5.0.0",
  [string]$SshKeyPath = (Join-Path $HOME ".ssh\fruitlab_demo_ed25519"),
  [switch]$Force
)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$DeployDir = Join-Path $RepoRoot "deploy\vps"
$SecretsDir = Join-Path $PSScriptRoot ".secrets"
$KnownHosts = Join-Path $env:TEMP "fruitlab-demo-known_hosts"
$SshOpts = @(
  "-o", "StrictHostKeyChecking=accept-new",
  "-o", "UserKnownHostsFile=$KnownHosts",
  "-o", "ConnectTimeout=10"
)

if ([string]::IsNullOrWhiteSpace($DnsLabel)) {
  $DnsLabel = "fruitlab-demo-" + ([guid]::NewGuid().ToString("N").Substring(0, 6))
}
$Fqdn = "$DnsLabel.$Location.cloudapp.azure.com"
$SecretFile = Join-Path $SecretsDir "$ResourceGroup-$VmName.env"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Tool([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "缺少命令：$Name（请先安装 OpenSSH/tar/Azure CLI）"
  }
}

function Invoke-Az {
  param([string[]]$AzArgs, [switch]$AllowFail)
  $output = & az @AzArgs 2>$null
  $code = $LASTEXITCODE
  if ($code -ne 0 -and -not $AllowFail) {
    throw "az $($AzArgs -join ' ') 失败（exit $code）：`n$($output -join "`n")"
  }
  return @{ Code = $code; Output = $output }
}

function Get-AzJson {
  param([string[]]$AzArgs)
  $raw = & az @AzArgs -o json 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  $text = (($raw | Out-String).Trim())
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  return ($text | ConvertFrom-Json)
}

function Test-Az {
  param([string[]]$AzArgs)
  & az @AzArgs -o none 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Invoke-Ssh {
  param([string]$Target, [string]$Command, [switch]$AllowFail)
  $sshArgs = $SshOpts + @("-i", $SshKeyPath, $Target, $Command)
  $output = & ssh @sshArgs 2>$null
  $code = $LASTEXITCODE
  if ($code -ne 0 -and -not $AllowFail) {
    throw "ssh $Target 失败（exit $code）：`n$($output -join "`n")"
  }
  return @{ Code = $code; Output = $output }
}

function Copy-ToVm {
  param([string]$LocalPath, [string]$RemotePath)
  $scpArgs = $SshOpts + @("-i", $SshKeyPath, $LocalPath, "azureuser@${script:VmIp}:$RemotePath")
  $output = & scp @scpArgs 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "scp $LocalPath -> $RemotePath 失败：`n$($output -join "`n")"
  }
}

function Get-VmIp {
  $ip = & az vm show -d -n $VmName -g $ResourceGroup --query publicIps -o tsv 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($ip | Out-String).Trim())) {
    throw "无法获取 VM 公网 IP；检查 az login / 资源组 / VM 名"
  }
  return ($ip | Out-String).Trim()
}

function Wait-Ssh {
  param([string]$Ip, [int]$Attempts = 36)
  for ($i = 1; $i -le $Attempts; $i++) {
    $result = Invoke-Ssh -Target "azureuser@$Ip" -Command "echo ok" -AllowFail
    if ($result.Code -eq 0 -and (($result.Output | Out-String) -match "ok")) { return }
    Start-Sleep -Seconds 5
  }
  throw "SSH 等待超时：azureuser@$Ip"
}

function Get-PublicIpName {
  $name = & az network public-ip list -g $ResourceGroup --query "[?contains(ipConfiguration.id, '$VmName')].name" -o tsv 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($name | Out-String).Trim())) {
    throw "找不到 $VmName 的公网 IP 资源"
  }
  return (($name | Out-String).Trim().Split("`n")[0])
}

function Write-Utf8NoBom { param([string]$Path,[string]$Text) [IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false))) }

function New-Password {
  return (([guid]::NewGuid().ToString("N")) + ([guid]::NewGuid().ToString("N"))).Substring(0, 28)
}

function Write-Plan {
  Write-Host "资源组 : $ResourceGroup"
  Write-Host "VM     : $VmName ($Location, $VmSize)"
  Write-Host "DNS    : $DnsLabel -> $Fqdn"
  Write-Host "镜像   : chengzh/fruitlab-r3:$ImageTag / -web"
  Write-Host "密钥   : $SshKeyPath"
  Write-Host "口令   : $SecretFile（本地，gitignored）"
  Write-Host ""
  Write-Host "将执行："
  Write-Host "  az group create / az vm create（不存在时）"
  Write-Host "  az vm open-port 80/443；public-ip update --dns-name"
  Write-Host "  scp deploy/vps -> /opt/fruitlab；setup-vm.sh（Docker + Caddy）"
  Write-Host "  ./deploy.sh $ImageTag；./smoke.sh"
  Write-Host "  https://$Fqdn"
}

function Ensure-AzureLogin {
  $account = & az account show -o json 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($account | Out-String))) {
    throw "Azure CLI 未登录：先执行 az login"
  }
  $obj = ($account | Out-String) | ConvertFrom-Json
  Write-Host "Azure 订阅：$($obj.name)"
}

function Ensure-Key {
  if (Test-Path $SshKeyPath) { return }
  Require-Tool ssh-keygen
  New-Item -ItemType Directory -Force (Split-Path -Parent $SshKeyPath) | Out-Null
  Write-Step "生成 SSH key：$SshKeyPath"
  & ssh-keygen -t ed25519 -f $SshKeyPath -N '""' -C "fruitlab-demo" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "ssh-keygen 失败" }
}

function Ensure-Vm {
  if (-not (Test-Az @("group", "show", "-n", $ResourceGroup))) {
    Write-Step "创建资源组 $ResourceGroup"
    Invoke-Az @("group", "create", "-n", $ResourceGroup, "-l", $Location) | Out-Null
  } else {
    Write-Step "复用资源组 $ResourceGroup"
  }

  if (-not (Test-Az @("vm", "show", "-n", $VmName, "-g", $ResourceGroup))) {
    Write-Step "创建 VM $VmName（首次约 2–4 分钟）"
    $pub = (Get-Content "$SshKeyPath.pub" -Raw).Trim()
    Invoke-Az @(
      "vm", "create", "-n", $VmName, "-g", $ResourceGroup, "-l", $Location,
      "--image", "Canonical:ubuntu-24_04-lts:server:latest",
      "--size", $VmSize, "--admin-username", "azureuser",
      "--ssh-key-values", $pub, "--public-ip-sku", "Standard", "--nsg-rule", "SSH"
    ) | Out-Null
  } else {
    $power = & az vm get-instance-view -n $VmName -g $ResourceGroup --query "instanceView.statuses[?starts_with(code,'PowerState/')].code" -o tsv 2>$null
    $power = ($power | Out-String).Trim()
    if ($power -notmatch "PowerState/running") {
      Write-Step "启动已存在的 VM $VmName"
      Invoke-Az @("vm", "start", "-n", $VmName, "-g", $ResourceGroup) | Out-Null
    } else {
      Write-Step "复用运行中的 VM $VmName"
    }
  }

  foreach ($port in @(80, 443)) {
    & az vm open-port -n $VmName -g $ResourceGroup --port $port --priority (1000 + $port) -o none 2>$null | Out-Null
  }

  $pipName = Get-PublicIpName
  Write-Step "设置 DNS label：$DnsLabel"
  Invoke-Az @("network", "public-ip", "update", "-g", $ResourceGroup, "-n", $pipName, "--dns-name", $DnsLabel) | Out-Null

  $script:VmIp = Get-VmIp
  Write-Step "等待 SSH（$script:VmIp）"
  Wait-Ssh -Ip $script:VmIp
}

function Copy-Assets {
  param([string]$Ip)
  $stage = Join-Path $env:TEMP ("fruitlab-demo-stage-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
  New-Item -ItemType Directory -Force $stage | Out-Null
  Get-ChildItem $DeployDir -Force | Copy-Item -Destination $stage -Recurse -Force

  $caddy = @"
$Fqdn {
    encode zstd gzip
    reverse_proxy 127.0.0.1:4175
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }
}
"@
  Write-Utf8NoBom -Path (Join-Path $stage "Caddyfile") -Text $caddy

  $remoteEnv = Invoke-Ssh -Target "azureuser@$Ip" -Command "test -s /opt/fruitlab/.env.production && echo yes || echo no"
  $hasRemoteEnv = (($remoteEnv.Output | Out-String).Trim() -eq "yes")

  $adminForPrint = $null
  if (-not $hasRemoteEnv) {
    if (Test-Path $SecretFile) {
      $envText = Get-Content $SecretFile -Raw
    } else {
      New-Item -ItemType Directory -Force $SecretsDir | Out-Null
      $pg = New-Password
      $admin = "Adm!" + (New-Password).Substring(0, 24)
      $envText = "PUBLIC_URL=https://$Fqdn`nPOSTGRES_PASSWORD=$pg`nADMIN_PASSWORD=$admin`nIMAGE_TAG=$ImageTag`nSESSION_TTL_SECONDS=86400`n"
      Write-Utf8NoBom -Path $SecretFile -Text $envText
      Write-Step "生成生产口令：$SecretFile"
    }
    Write-Utf8NoBom -Path (Join-Path $stage ".env.production") -Text $envText
    $adminForPrint = (($envText -split "`n") | Where-Object { $_ -like "ADMIN_PASSWORD=*" } | Select-Object -First 1) -replace "^ADMIN_PASSWORD=", ""
  } else {
    Write-Step "VM 已有 .env.production，保留（不覆盖）"
    if (Test-Path $SecretFile) {
      $existing = Get-Content $SecretFile -Raw
      $adminForPrint = (($existing -split "`n") | Where-Object { $_ -like "ADMIN_PASSWORD=*" } | Select-Object -First 1) -replace "^ADMIN_PASSWORD=", ""
    }
  }

  $tar = Join-Path $env:TEMP ("fruitlab-demo-" + [guid]::NewGuid().ToString("N").Substring(0, 6) + ".tgz")
  & tar -czf $tar -C $stage . 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "tar 打包失败" }

  Write-Step "上传部署资产"
  Copy-ToVm -LocalPath $tar -RemotePath "/home/azureuser/fruitlab-demo.tgz"
  Invoke-Ssh -Target "azureuser@$Ip" -Command "sudo mkdir -p /opt/fruitlab && sudo chown `$USER:`$USER /opt/fruitlab && tar -xzf /home/azureuser/fruitlab-demo.tgz -C /opt/fruitlab && chmod +x /opt/fruitlab/*.sh && echo extracted" | Out-Null
  if (-not $hasRemoteEnv) {
    Copy-ToVm -LocalPath (Join-Path $stage ".env.production") -RemotePath "/opt/fruitlab/.env.production"
    Invoke-Ssh -Target "azureuser@$Ip" -Command "chmod 600 /opt/fruitlab/.env.production && echo env_ok" | Out-Null
  }
  Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $tar -Force -ErrorAction SilentlyContinue
  return $adminForPrint
}

function Setup-Vm {
  param([string]$Ip)
  Write-Step "安装/确认 Docker + Caddy"
  Copy-ToVm -LocalPath (Join-Path $DeployDir "setup-vm.sh") -RemotePath "/home/azureuser/setup-vm.sh"
  $result = Invoke-Ssh -Target "azureuser@$Ip" -Command "bash /home/azureuser/setup-vm.sh > /tmp/setup-vm.log 2>&1; echo setup_exit=`$?; tail -n 5 /tmp/setup-vm.log"
  Write-Host (($result.Output | Out-String).Trim())
  if (($result.Output | Out-String) -notmatch "setup_exit=0") { throw "setup-vm.sh 失败，见 /tmp/setup-vm.log" }
}

function Configure-Caddy {
  param([string]$Ip)
  Write-Step "配置宿主机 Caddy + TLS"
  Invoke-Ssh -Target "azureuser@$Ip" -Command "sudo cp /opt/fruitlab/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy && echo caddy_ok" | Out-Null
}

function Invoke-Deploy {
  param([string]$Ip)
  Write-Step "部署 $ImageTag"
  $result = Invoke-Ssh -Target "azureuser@$Ip" -Command "cd /opt/fruitlab && ./deploy.sh $ImageTag"
  Write-Host (($result.Output | Out-String).Trim())
  if (($result.Output | Out-String) -notmatch "deploy\] success") { throw "deploy.sh 未成功" }
}

function Wait-Https {
  param([string]$Ip, [int]$Attempts = 40)
  Write-Step "等待 HTTPS 证书与健康检查"
  for ($i = 1; $i -le $Attempts; $i++) {
    $r = Invoke-Ssh -Target "azureuser@$Ip" -Command "curl -fsS --max-time 5 https://$Fqdn/api/health" -AllowFail
    if ($r.Code -eq 0 -and (($r.Output | Out-String) -match '"db":"up"')) {
      Write-Host (($r.Output | Out-String).Trim())
      return
    }
    Start-Sleep -Seconds 3
  }
  $logs = Invoke-Ssh -Target "azureuser@$Ip" -Command "sudo journalctl -u caddy -n 20 --no-pager" -AllowFail
  Write-Host (($logs.Output | Out-String).Trim())
  throw "HTTPS 等待超时：https://$Fqdn/api/health"
}

function Invoke-Smoke {
  param([string]$Ip)
  Write-Step "生产冒烟（admin 登录 / userA 401 / 下单）"
  $r = Invoke-Ssh -Target "azureuser@$Ip" -Command "cd /opt/fruitlab && ./smoke.sh"
  Write-Host (($r.Output | Out-String).Trim())
}

function Show-Summary {
  param([string]$Admin)
  Write-Host ""
  Write-Host "================ R3.5 Azure VM demo ================" -ForegroundColor Green
  Write-Host "URL     : https://$Fqdn"
  Write-Host "健康    : https://$Fqdn/api/health"
  Write-Host "VM      : $VmName / $ResourceGroup / $Location"
  Write-Host "镜像    : chengzh/fruitlab-r3:$ImageTag"
  if ($Admin) {
    Write-Host "管理员  : admin / $Admin" -ForegroundColor Yellow
  } else {
    Write-Host "管理员  : 见 VM /opt/fruitlab/.env.production（已有环境时未回显）"
  }
  Write-Host "口令文件: $SecretFile（本地；不要提交）"
  Write-Host ""
  Write-Host "停止    : .\deploy\azure\az-vm-demo.ps1 -Action stop -ResourceGroup $ResourceGroup -VmName $VmName"
  Write-Host "销毁    : .\deploy\azure\az-vm-demo.ps1 -Action destroy -ResourceGroup $ResourceGroup -VmName $VmName -Force"
  Write-Host "====================================================" -ForegroundColor Green
}

# ---------------- main ----------------
Require-Tool az
Require-Tool ssh
Require-Tool scp
if (-not (Test-Path $DeployDir)) { throw "找不到部署资产：$DeployDir" }

switch ($Action) {
  "plan" {
    Ensure-AzureLogin
    Write-Plan
    break
  }
  "status" {
    Ensure-AzureLogin
    $vm = Get-AzJson @("vm", "show", "-d", "-n", $VmName, "-g", $ResourceGroup)
    if (-not $vm) { Write-Host "VM 不存在：$ResourceGroup/$VmName"; break }
    Write-Host "VM     : $($vm.name) / $($vm.location) / $($vm.hardwareProfile.vmSize)"
    Write-Host "Power  : $($vm.powerState)"
    Write-Host "IP     : $($vm.publicIps)"
    Write-Host "FQDN   : https://$Fqdn"
    if (Test-Path $SshKeyPath) {
      $r = Invoke-Ssh -Target "azureuser@$($vm.publicIps)" -Command "curl -fsS -H 'Host: $Fqdn' http://127.0.0.1:4175/api/health" -AllowFail
      Write-Host "Health : $((($r.Output | Out-String).Trim()))"
    } else {
      Write-Host "SSH key 不存在：$SshKeyPath"
    }
    break
  }
  "stop" {
    Ensure-AzureLogin
    Write-Step "停止（deallocate）$VmName"
    Invoke-Az @("vm", "deallocate", "-n", $VmName, "-g", $ResourceGroup) | Out-Null
    Write-Host "已停止；再启动：az vm start -n $VmName -g $ResourceGroup"
    break
  }
  "destroy" {
    Ensure-AzureLogin
    if (-not $Force) {
      $answer = Read-Host "确认删除整个资源组 $ResourceGroup（含 VM/磁盘/IP）？输入 DELETE"
      if ($answer -ne "DELETE") { Write-Host "已取消"; break }
    }
    Write-Step "删除资源组 $ResourceGroup"
    Invoke-Az @("group", "delete", "-n", $ResourceGroup, "--yes", "--no-wait") | Out-Null
    Write-Host "已提交删除（--no-wait）"
    break
  }
  "deploy" {
    Ensure-AzureLogin
    if (-not (Test-Path $SshKeyPath)) { throw "SSH key 不存在：$SshKeyPath" }
    $script:VmIp = Get-VmIp
    $null = Copy-Assets -Ip $script:VmIp
    Configure-Caddy -Ip $script:VmIp
    Invoke-Deploy -Ip $script:VmIp
    Wait-Https -Ip $script:VmIp
    Invoke-Smoke -Ip $script:VmIp
    Show-Summary
    break
  }
  "up" {
    Ensure-AzureLogin
    Ensure-Key
    Ensure-Vm
    Setup-Vm -Ip $script:VmIp
    $admin = Copy-Assets -Ip $script:VmIp
    Configure-Caddy -Ip $script:VmIp
    Invoke-Deploy -Ip $script:VmIp
    Wait-Https -Ip $script:VmIp
    Invoke-Smoke -Ip $script:VmIp
    Show-Summary -Admin $admin
    break
  }
}
