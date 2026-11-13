# 服务器侧搭建说明

这台服务器是干什么的：只当中转，不存业务数据，不跑 Reach 本身。

- 笔记本主动向服务器打一条反向 SSH 隧道，把本机 SSH 挂到服务器的回环端口上；
- 云端先 SSH 到服务器，再从服务器跳进笔记本；
- 笔记本不需要公网 IP、不开入站端口，断线 10 秒重连。

这套东西是通用的：任何一台能装 OpenSSH 的 Linux 服务器都能当这个中转，
不绑定哪家云厂商。下面以 Ubuntu + OpenSSH 为例。

## 占位清单

模板里出现的所有占位，搭建时按你的环境替换：

| 占位 | 含义 |
| --- | --- |
| `YOUR_SERVER_IP` | 中转服务器的公网地址 |
| `YOUR_SERVER_USER` | 中转服务器上的用户名（建议专用用户，不要用 root） |
| `YOUR_WINDOWS_USER` | 笔记本上的 Windows 用户名 |
| `YOUR_PUBLIC_KEY_HERE` | 笔记本上生成的 SSH 公钥内容 |
| `2203` | 反向隧道在服务器回环上监听的端口（可改，改完三处要一致） |

## 准备

- 一台 24 小时在线的 Linux 服务器，一个公网 IP
- 服务器上装好 OpenSSH server，22 端口对笔记本开放
- 笔记本上装好 OpenSSH server，只听 `127.0.0.1`、只认钥匙登录

## 步骤

### 1. 服务器上建专用用户

```bash
adduser YOUR_SERVER_USER
```

### 2. 登记限制式钥匙

笔记本上生成钥匙对：

```powershell
ssh-keygen -t ed25519
```

把生成的公钥（`id_ed25519.pub` 里 `ssh-ed25519` 开头的一整行）按
`authorized_keys.example` 的格式，追加到服务器上该用户的
`~/.ssh/authorized_keys`，并把 `YOUR_PUBLIC_KEY_HERE` 换成公钥内容。

权限必须对，否则钥匙会被拒：

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

登记条目是限制式的：只允许反向隧道端口转发，不给 shell、不给
agent/X11 转发。`permitlisten` 只放行 `127.0.0.1:2203`，隧道只能挂
在回环上，外网扫不到。

### 3. 笔记本上装反向隧道

把 `reverse-tunnel.ps1` 放到笔记本固定位置，填好文件头的占位，
再建计划任务 `muse-reach-tunnel`（开机启动、SYSTEM 身份）：

```powershell
schtasks /Create /TN muse-reach-tunnel `
  /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Tools\muse-reach-tunnel\reverse-tunnel.ps1" `
  /SC ONLOGON /RU SYSTEM /F
```

任务只负责拉起一次，重连由脚本自带的 10 秒循环负责。

### 4. 云端验证两跳调用

把 `ssh-call.sh` 放到云端，填好占位，跑一条命令验证：

```bash
./ssh-call.sh 'whoami'
```

应返回笔记本上的用户名。连不上时按下面排障顺序查。

### 5. （可选）轮询消息收件箱

把 `link-poll.sh` 挂到你自己的轮询机制上（比如每 5 秒跑一次），
它每轮到笔记本的收件箱取新消息、写回执、把消息打印出来交给 Agent。

## 排障

- **隧道端口在服务器上能看到监听，但连不上**：先看笔记本是不是
  关机或断网，再看计划任务在不在跑。端口在不代表隧道是活的——
  假死时端口也在监听，两侧 SSH 却卡在握手。恢复办法：杀掉服务器上
  持有该监听端口的 sshd 会话进程，笔记本的计划任务 10 秒内会自己
  重新注册。
- **钥匙被拒**：先查 `~/.ssh` 700、`authorized_keys` 600、文件属主
  对不对，再查限制选项拼写（`permitlisten` 的引号和端口）。
- **云端报 host key 验证失败**：先确认是钥匙没带上还是主机钥匙真变了，
  不要直接删 known_hosts；核对服务器主机钥匙指纹再决定。

## 安全

- 中转服务器不存业务数据；登记的钥匙只有隧道权限，没有 shell。
- 随时断开，三种任选：停笔记本上的计划任务、停服务器上的 sshd、
  或删 `authorized_keys` 里的那一行。
