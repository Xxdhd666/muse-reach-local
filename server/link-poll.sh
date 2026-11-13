#!/usr/bin/env bash
# link-poll.sh — 轮询笔记本消息收件箱的钩子脚本（模板）
#
# 背景：Reach 在笔记本上有个消息收件箱（%LocalAppData%\MuseReach\link\outbox），
# 外部消息先以 msg-<id>.json 写进这里；云端定期过来取，取走后在同一目录
# 写回一张 status-<id>.json 回执（state=received），笔记本就知道消息已被接手。
#
# 本脚本只做一轮：取 + 写回执 + 把新消息打印到标准输出（由调用方交给 Agent）。
# 把它挂在你自己的轮询机制上（比如每 5 秒跑一次，或 while 循环常驻）。
# 依赖：同一目录下的 ssh-call.sh、base64、python3（可选，用于校验 JSON）。
set -euo pipefail

SSH_CALL="$(cd "$(dirname "$0")" && pwd)/ssh-call.sh"
STATE_DIR="${LINK_POLL_STATE:-$HOME/.muse-reach/link-poll}"
mkdir -p "$STATE_DIR"

# 1) 到笔记本上取一轮：先写心跳，再列出 outbox 里的 msg-*.json（base64 发回），
#    再列出已有的 status-*.json 回执，避免重复取。
PS_CMD='Write-Output POLL_OK; $lk=Join-Path $env:LOCALAPPDATA MuseReach\link; $rt=Split-Path $lk; $hb=[pscustomobject]@{v=1;ts=(Get-Date -Format o)}; [IO.File]::WriteAllText((Join-Path $rt heartbeat.json), ($hb | ConvertTo-Json -Compress)); $ob=Join-Path $lk outbox; if(Test-Path $ob){ Get-ChildItem $ob -Filter msg-*.json -ErrorAction SilentlyContinue | ForEach-Object { $b=[Convert]::ToBase64String([IO.File]::ReadAllBytes($_.FullName)); Write-Output ("MSG " + $_.BaseName + " " + $b) } }; Get-ChildItem $lk -Filter status-*.json -ErrorAction SilentlyContinue | ForEach-Object { Write-Output ("STATUS " + $_.BaseName) }'

OUT="$("$SSH_CALL" "$PS_CMD" 2>/dev/null | tr -d '\r' || true)"
case "$OUT" in
  *POLL_OK*) : ;;
  *) echo "link-poll: laptop unreachable" >&2; exit 0 ;;
esac

declare -A HAS_STATUS=()
while IFS= read -r line; do
  case "$line" in
    STATUS\ *) HAS_STATUS["${line#STATUS status-}"]=1 ;;
  esac
done <<< "$OUT"

NOW=$(date +%s)
while IFS= read -r line; do
  case "$line" in
    MSG\ *)
      rest="${line#MSG msg-}"
      id="${rest%% *}"
      b64="${rest#* }"
      [ -n "${HAS_STATUS[$id]:-}" ] && continue
      ann="$STATE_DIR/$id"
      if [ -f "$ann" ]; then
        age=$(( NOW - $(stat -c %Y "$ann") ))
        [ "$age" -lt 120 ] && continue
      fi
      text="$(printf '%s' "$b64" | base64 -d 2>/dev/null || true)"
      # 2) 写回执：先把回执 JSON 发过去（base64），再落盘为 status-<id>.json。
      ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      json="{\"v\":1,\"id\":\"$id\",\"state\":\"received\",\"note\":\"\",\"ts\":\"$ts\"}"
      rb64="$(printf '%s' "$json" | base64 -w0)"
      "$SSH_CALL" "\$lk=Join-Path \$env:LOCALAPPDATA MuseReach\\link; \$bf=Join-Path \$lk w-$id.b64; \$tmp=Join-Path \$lk w-$id.tmp; \$dst=Join-Path \$lk status-$id.json; Set-Content \$bf $rb64 -NoNewline; [IO.File]::WriteAllBytes(\$tmp,[Convert]::FromBase64String([IO.File]::ReadAllText(\$bf))); Move-Item \$tmp \$dst -Force; Remove-Item \$bf" >/dev/null 2>&1 || true
      touch "$ann"
      # 3) 把消息交给调用方（打印一行 JSON，调用方按需处理）。
      printf '%s\n' "$text"
      ;;
  esac
done <<< "$OUT"
