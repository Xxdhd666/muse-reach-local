# Muse Reach

Windows 上的 Muse 本地控制台：网页里对话，SSH 通道操作电脑，执行器留下记录。

当前版本：**v48 / 0.48.0**。C#、.NET 8 WinForms、WebView2；Windows 10 2004 及以上、Windows 11，64 位。

## 能做什么

- 内嵌 `muse.ai` 网页，保存常用主对话；对话和 Agent 能力由 Muse 网站提供。
- 查看本机操作记录及其声明的文件，定位文件、打开、复制路径；文件不在时保留历史。
- 检查配置的隧道进程、服务器 TCP、本机 SSH 服务及最近到达记录；区分未知、异常和已核实证据。
- 请求停止或重新建立已配置的隧道；操作前核对任务动作、脚本路径及当前用户，拒绝控制无关任务。
- 设置服务器检查地址、SSH 端口、任务名、脚本路径和文件监听目录，无需修改源码。
- 提供托盘、热键、窗口位置记忆、9 套主题、侧栏收起／换边、网页与控制台独立缩放、系统减少动画设置联动。

## 真实边界

Reach 桌面程序不是命令网关，也不是沙箱。云端经 SSH 登录 Windows，拥有该登录账户的实际权限。关闭 Reach 不会停止独立运行的隧道任务。

v48 增加了 `server/Invoke-ReachCommand.ps1`：经它运行的命令先记开始，再记结束和退出码；默认超时 300 秒，允许 1–900 秒；相同请求 ID 不重复执行。初始记账失败时不会启动命令。原始命令默认不写日志，输出仍经 SSH 返回。

**直接 SSH 可以绕过执行器；文件路径与摘要由调用者声明；本机记录可被同账户修改，不能当成防篡改审计证据。** 没有结束记录时只显示等待／未确认，不推断成功。到达记录超过 90 秒仅表示过期，空闲时不会据此宣告假死。界面最多显示最近 5000 个操作，原始账本留在磁盘上；监听变化不代表由 Muse 引起。

## 开始使用

运行环境：.NET 8 Desktop Runtime、WebView2 Runtime。开发构建还需 .NET 8 或更新 SDK、Node.js 20+、Python 3、Windows PowerShell 5.1。

```powershell
dotnet publish source/app/Reach.csproj -c Release -r win-x64 --self-contained false -o out
.\out\MuseReach.exe
```

WebView2 SDK 从微软官方 NuGet 包恢复，固定 `1.0.2903.40`，其依赖锁在 `source/app/packages.lock.json`；不再手工维护仓库 DLL 副本。目标电脑仍需 WebView2 Runtime。

首次打开可以使用网页和控制台；连接页会提示尚未配置。服务器与 Windows SSH 部署见 [server/README.md](server/README.md)。部署脚本需由你明确执行；应用不会自行安装 SSH、修改密钥或防火墙。

在设置页保存的信息用于检查、任务控制及文件监听。服务器或端口变更后，也要更新已部署的 `relay-tunnel.json` 和云端 SSH 配置；保存设置不会悄悄改变正在运行的连接。

运行时数据位于 `%LocalAppData%\MuseReach\`：`settings.json`、`connection.json`、`ops.jsonl`、`reach.log`、`heartbeat.json`、`watch.json`。执行器另用 `requests/` 保存去重标记；部署后增加 `tools/` 和 `tunnel/`。这些文件不进仓库；不要把登录资料、私钥或真实日志上传到公开 issues。

## 检查与构建

```powershell
npm ci
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1 -Publish

# 浏览器检查；首次需安装无界面浏览器
npx playwright install chromium
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1 -Browser
```

`check.ps1` 遇到任意失败立即返回失败。覆盖三组 C# 逻辑测试、实际 DOM 交互、编码传输、真实本地子进程退出／超时／重复请求／日志失败及 Windows 构建。测试使用临时目录，不连接真实服务器，不改计划任务。`source/tests/ui-v*-checks.cjs` 是保留的历史检查，包含旧版字面量断言，不再作为当前版本验收入口。

GitHub Actions 在 Windows 上构建和测试并提供下载工件；Ubuntu 作 Bash 语法、编码和 OpenSSH 有效配置检查。CI 配置检查不等于你的实际服务器链路已验证。

## 界面示例

以下截图来自当前 HTML 界面在浏览器中的渲染，使用明确标注的测试数据；不代表真实云端连接或原生窗口已验收。

![执行记录示例](docs/screenshots/records.png)
![连接检查示例](docs/screenshots/connection.png)
![设置示例](docs/screenshots/settings.png)
![连接与监听配置](docs/screenshots/settings-connection.png)

## 目录

```text
source/app/                WinForms、WebView2、本地界面及状态逻辑
source/tests/              设置／几何逻辑、当前 DOM 与浏览器检查、执行器测试
source/baseline-tests/     记录层、探活展示与系统设置逻辑
source/reliability-tests/  配置校验、身份识别、心跳与记账回归
server/                   SSH 身份分离模板、部署与执行器脚本
scripts/check.ps1          当前版本统一验收入口
.github/workflows/         Windows 构建与 Linux 配置检查
```

MIT；图标与运行组件的许可见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。安全边界与反馈方式见 [SECURITY.md](SECURITY.md)。
