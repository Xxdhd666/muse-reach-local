#!/usr/bin/env bash
# Cloud: uses ~/.ssh/config aliases with ProxyJump, never agent forwarding.
# stdin/command are encoded as data; quotes and Unicode survive both hops.
set -euo pipefail
target="${REACH_SSH_ALIAS:-reach-laptop}"
[[ "$target" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "Invalid SSH alias" >&2; exit 2; }
[[ $# -eq 1 ]] || { echo "Usage: ssh-call.sh 'PowerShell command'" >&2; exit 2; }
encoded=$(python3 - "$1" <<'PY'
import base64,json,os,sys,uuid
request={"id":os.environ.get("REACH_ID",str(uuid.uuid4())),"command":sys.argv[1],
 "summary":os.environ.get("REACH_SUMMARY","Local command"),"kind":os.environ.get("REACH_KIND","exec"),
 "files":json.loads(os.environ.get("REACH_FILES_JSON","[]")),"timeoutSeconds":int(os.environ.get("REACH_TIMEOUT","300"))}
raw=json.dumps(request,ensure_ascii=False).encode("utf-8")
if len(raw)>6000: raise SystemExit("Request exceeds SSH command size; upload a script and invoke it instead")
b64=base64.b64encode(raw).decode()
ps="$ErrorActionPreference='Stop'; & (Join-Path $env:LOCALAPPDATA 'MuseReach\\tools\\Invoke-ReachCommand.ps1') -RequestBase64 '"+b64+"'; exit $LASTEXITCODE"
encoded=base64.b64encode(ps.encode("utf-16le")).decode()
if len(encoded)+80>7500: raise SystemExit("Final encoded command exceeds Windows command-line limit; upload a script instead")
print(encoded)
PY
)
exec ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 \
 -o ServerAliveInterval=15 -o ServerAliveCountMax=2 "$target" \
 "powershell.exe -NoProfile -NonInteractive -EncodedCommand $encoded"
