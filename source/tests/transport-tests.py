"""Exercise the actual encoder embedded in ssh-call.sh, without contacting a server."""
import base64,json,os,re,subprocess,sys
from pathlib import Path
script=(Path(__file__).resolve().parents[2]/'server/ssh-call.sh').read_text(encoding='utf-8')
encoder=script.split("<<'PY'\n",1)[1].split('\nPY\n',1)[0]
for command in ["Write-Output 'single'", 'Write-Output "double"', 'Write-Output "中文 😀"', "Write-Output '$() ; ` \\ newline\nend'"]:
 result=subprocess.run([sys.executable,'-c',encoder,command],capture_output=True,text=True,check=True)
 wrapper=base64.b64decode(result.stdout).decode('utf-16le')
 payload=re.search(r"-RequestBase64 '([A-Za-z0-9+/=]+)'",wrapper).group(1)
 request=json.loads(base64.b64decode(payload));assert request['command']==command
 assert command not in wrapper
print('Transport: 4 quote/Unicode round trips passed')
result=subprocess.run([sys.executable,'-c',encoder,'x'*9000],capture_output=True,text=True)
assert result.returncode!=0 and 'exceeds SSH' in result.stderr
print('Transport: oversized request rejected')
result=subprocess.run([sys.executable,'-c',encoder,'x'*2500],capture_output=True,text=True)
assert result.returncode!=0 and 'encoded command' in result.stderr
print('Transport: Windows command-line encoded size enforced')
