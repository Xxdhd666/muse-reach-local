# reverse-tunnel.ps1 — 笔记本上的反向隧道脚本（模板）
#
# 用途：开机后把本机 SSH（22 端口）通过反向隧道挂到中转服务器上，
# 云端经服务器跳进来。断线后 10 秒重连（脚本自带循环）。
#
# 安装：见 server/README.md —— 放到固定位置，建计划任务
# muse-reach-tunnel（开机启动、SYSTEM 身份），任务只负责拉起一次，
# 重连由下面这个循环负责。
#
# 全部占位在文件头改。

$RelayHost    = "YOUR_SERVER_IP"     # 中转服务器地址
$RelayPort    = 2203                 # 中转服务器上监听的端口
$RelayUser    = "YOUR_SERVER_USER"   # 中转服务器上的用户名（建议专用用户，不要用 root）
$KeyFile      = "C:\Users\YOUR_WINDOWS_USER\.ssh\id_ed25519"  # 本机私钥
$LocalSshPort = 22                   # 本机 OpenSSH 监听端口（只听 127.0.0.1）

while ($true) {
    & ssh.exe -N -R "${RelayPort}:localhost:${LocalSshPort}" `
        -i $KeyFile `
        -o StrictHostKeyChecking=accept-new `
        -o ServerAliveInterval=30 -o ServerAliveCountMax=3 `
        "$RelayUser@$RelayHost"
    Start-Sleep -Seconds 10
}
