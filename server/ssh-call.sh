#!/bin/bash
# ssh-call.sh — 云端经中转服务器跳进笔记本，执行一条 PowerShell 命令（模板）
#
# 用法：./ssh-call.sh 'Get-Date'
# 链路：本机 --(ssh -A，钥匙转发)--> 中转服务器 --(ssh -p 2203)--> 笔记本 127.0.0.1
#
# 注意：命令里不要带单引号和双引号（路径用 Join-Path 和变量拼），
# 这是两跳 SSH 传命令的固有限制。
#
# 全部占位可用环境变量覆盖，也可以直接改下面的默认值。
set -euo pipefail

RELAY_HOST="${RELAY_HOST:-YOUR_SERVER_IP}"
RELAY_USER="${RELAY_USER:-YOUR_SERVER_USER}"
RELAY_PORT="${RELAY_PORT:-2203}"
LAPTOP_USER="${LAPTOP_USER:-YOUR_WINDOWS_USER}"
KEY_FILE="${KEY_FILE:-$HOME/.ssh/id_ed25519}"

CMD="${1:-whoami}"

ssh -A -i "$KEY_FILE" -o UserKnownHostsFile="$HOME/.ssh/known_hosts" "$RELAY_USER@$RELAY_HOST" \
  "ssh -p $RELAY_PORT -o UserKnownHostsFile=/tmp/kh_lap $LAPTOP_USER@127.0.0.1 '$CMD'"
