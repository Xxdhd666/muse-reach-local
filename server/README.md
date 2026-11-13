# 部署 SSH 通道和本机执行器

这份文档描述模板部署，程序不会自动执行这些步骤。建议先在测试账户／服务器验证，再迁移现用链路；保留现有 SSH 管理会话和配置备份。

## 身份与链路

```text
笔记本 reach-tunnel 专用私钥 → 中转 reach-tunnel 账户：仅反向转发
云端 reach-jump 专用私钥    → 中转 reach-jump 账户：仅到回环端口的跳转
云端 Windows 专用私钥      → Windows 非管理员账户：执行命令
```

三把密钥、两个中转账户，不共用。云端不持有笔记本隧道私钥；中转不持有 Windows 私钥。两类中转账户均不允许会话／命令，云端使用 ProxyJump，不使用 agent forwarding。

## 1. 中转服务器

准备 Linux/OpenSSH 和两个专用账户 `reach-tunnel`、`reach-jump`。将对应公钥分别写入各账户的 `~/.ssh/authorized_keys`，使用 `authorized_keys.example` 的对应行。目录权限 700、文件 600，属主正确。

将 `sshd-reach.conf` 内容按环境调整后放入支持 Include 的 SSH 配置目录。默认仅允许回环 `127.0.0.1:2203`。`MaxSessions 0` 才是禁止会话的关键；`no-pty` 仅禁止分配终端。不要单独复制钥匙行就认为已经限制执行权限。

应用配置前运行 `sshd -t`；再用 `sshd -T -C user=reach-tunnel,host=localhost,addr=127.0.0.1` 等检查最终有效项。检查通过后由管理员按发行版方式重新加载服务，保持当前管理会话直到重新登录验证通过。

必须验证：隧道账户能开指定反向转发，但不能执行 `id`、开其他反向端口或本地转发；跳转账户能转到 `127.0.0.1:2203`，但不能执行命令、跳到其他端口或开反向转发。模板测试不替代真实负面权限测试。

## 2. Windows SSH

安装并配置 Windows OpenSSH Server，建议仅监听 `127.0.0.1`，禁用密码及交互式密码认证。把云端 Windows 公钥登记给选定的非管理员 Windows 账户。普通账户与管理员的 authorized_keys 路径／ACL 不同，应按微软 OpenSSH 文档设置；本模板不替你改变这些配置。

用可信渠道核对中转和 Windows SSH 主机公钥指纹，再保存到各调用端 known_hosts。不要把未经核对的 ssh-keyscan 输出当作身份验证。脚本使用严格主机检查，缺少或变化的主机密钥会失败。

## 3. 安装当前用户任务与执行器

在仓库的 `server` 目录，以将要登录 Windows SSH 的同一用户执行；不要作为 SYSTEM 安装。该命令只在你主动运行时安装，不由应用自动触发。

```powershell
.\Install-Reach.ps1 -RelayHost '你的服务器IP或域名' `
  -TunnelKey 'C:\Users\你的用户\.ssh\reach_tunnel' `
  -KnownHosts 'C:\Users\你的用户\.ssh\known_hosts' -WhatIf

# 核对预览后，移除 -WhatIf 才实际安装。
```

默认 `RelayUser=reach-tunnel`、`RelayPort=22`、`ListenPort=2203`、`LocalPort=22`；可用同名参数修改。脚本复制执行器、隧道脚本，生成 `relay-tunnel.json`，备份并写入本机 `connection.json`，注册当前用户登录时的有限权限任务。**安装后不立即启动任务**。确认配置后手动启动 `muse-reach-tunnel`。

任务使用当前登录用户的 profile 和密钥，不要求无人登录时运行。隧道绑定显式回环；转发失败即退出，断线等待 10 秒重试。主机不可达／握手阻塞还受 SSH 保活与连接阶段耗时影响，不承诺固定 10 秒恢复。

若从旧版 SYSTEM 任务迁移，先备份旧任务；同名任务可能需管理员权限替换。应用控制只接受当前用户、有限权限、动作确实执行配置脚本的任务；不满足时会拒绝，而不会强行结束其他 SSH。

## 4. 云端调用

复制 `ssh-config.example` 到云端 SSH 配置中，填写中转地址、Windows 用户和各自私钥路径；核对两端主机密钥。中转只承担加密流量跳转，不需要 Windows 私钥，也不需要 agent forwarding。

```bash
chmod +x server/ssh-call.sh
server/ssh-call.sh 'Get-Date'

REACH_SUMMARY='查看桌面文件' REACH_TIMEOUT=30 \
  server/ssh-call.sh 'Get-ChildItem ([Environment]::GetFolderPath("Desktop"))'
```

默认 SSH 别名为 `reach-laptop`，可通过 `REACH_SSH_ALIAS` 修改。`REACH_ID` 指定重试身份；同 ID 不重复执行，重复调用返回 75。`REACH_KIND` 可为 exec/file-create/file-modify/file-delete/file-read，`REACH_FILES_JSON` 是文件完整路径的 JSON 数组；这些是调用者声明，不是自动文件追踪。

命令与请求使用 JSON／Base64／UTF-16 编码，保留单双引号和 Unicode。按最终 Windows 命令行长度拒绝过大请求；复杂任务先传脚本再调用。远端命令默认 300 秒超时，1–900 秒可调，超时返回 124。成功表示命令进程退出 0，不代表业务结果一定正确。

原始命令默认不入日志，stdout/stderr 经 SSH 返回。不要把密钥等秘密写进摘要和文件名。临时命令脚本在正常退出后删除，强制终止或断电可能遗留；同账户可读本机目录，执行器不是秘密存储器。

## 5. 记录、恢复与停止

- 请求先创建一次性 ID 标记，再追加 started 记录，才启动命令；开始记账失败则不执行。
- 完成后同 ID 追加 outcome。断电、杀进程、最终记账失败可能只有开始记录，界面显示等待或未确认；先检查实际结果，不能盲目换 ID 重试破坏性任务。
- 心跳是最近一次执行器到达的时间，不是持续云端在线证明；空闲过期不等于假死。
- `link-poll.sh` 已明确停用：当前没有完整的消息生产者／持久消费协议，不再先写接收回执造成消息丢失。
- 从 Reach 请求断开时先验证任务身份，再停止指定任务、清理已核实的隧道进程；重新连接会先停止再启动。任务操作返回与实际网络恢复分开显示。
- 当前 Windows 账户仍可能直接 SSH 绕过账本；需要不可绕过的授权和审计时，应另设受限网关／专用执行账户，不能只依赖这个界面。
