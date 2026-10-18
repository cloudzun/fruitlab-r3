#!/usr/bin/env bash
# 一次性 VM 初始化（Ubuntu 24.04）：Docker + Caddy + 目录。
# 在 Azure VM 上以有 sudo 的用户执行：bash setup-vm.sh
set -euo pipefail

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg debian-keyring debian-archive-keyring apt-transport-https

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y caddy
fi

sudo mkdir -p /opt/fruitlab /var/backups/fruitlab
sudo chown -R "$USER":"$USER" /opt/fruitlab /var/backups/fruitlab
echo "setup done. Re-login (or 'newgrp docker') before using docker without sudo."
