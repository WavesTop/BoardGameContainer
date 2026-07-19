# BoardGameContainer

面向好友开黑的线上桌游容器。首发平台是微信小游戏，技术路线为 Cocos Creator 3.8.8 + TypeScript + 腾讯云开发 CloudBase；服务端保持权威判定，为斗地主、麻将、UNO、狼人杀、三国杀等复杂游戏预留统一的规则引擎接口。

## 当前包含

- `apps/game-client`：Cocos Creator 微信小游戏客户端骨架。
- `apps/cloudrun-server`：HTTP + WebSocket 权威房间服务，可在本机直接启动。
- `packages/protocol`：客户端与服务端共享协议和运行时校验。
- `packages/game-sdk`：游戏模块契约，隔离平台能力与具体规则。
- `games/demo`：确定性示例规则，用于验证命令、事件、状态、视图链路。
- `docs`：产品、技术、开发、交互和视觉设计文档。

客户端现提供斗地主、德州扑克和贵州麻将三套可完成整局的本地试玩；好友房可由房主添加策略人机补足空席。德州与贵州麻将的冻结规则分别见 `docs/game-rules/texas-holdem-v1.md` 和 `docs/game-rules/guizhou-mahjong-v1.md`。

## 五分钟启动本地服务

```powershell
cd C:\code\boardGameContainer
pnpm.cmd install
Copy-Item .env.example .env
pnpm.cmd check
pnpm.cmd dev
```

另开一个终端执行：

```powershell
Invoke-RestMethod http://127.0.0.1:3000/healthz
pnpm.cmd smoke
```

本机模式不需要腾讯云账号；联调真机和好友跨网络游玩时再部署到 CloudBase Run。

## 首次工具准备

```powershell
pnpm.cmd env:check
.\tools\bootstrap.ps1
```

然后安装 Cocos Dashboard / Creator 3.8.8 与微信开发者工具，按 [Windows 环境搭建](docs/development/SETUP_WINDOWS.md) 完成首次打开。CloudBase 的账号绑定步骤见 [CloudBase 配置](docs/development/CLOUDBASE_SETUP.md)。

打开 Cocos 工程推荐使用不会修改系统级执行策略的入口：

```powershell
pnpm.cmd cocos:open
```

也可以直接运行 `tools\open-cocos.cmd`。不要为了本项目将 PowerShell 全局策略改成 `Unrestricted`。

Creator 关闭时，可用命令行构建并预览 Web 版本：

```powershell
pnpm.cmd cocos:build:web
pnpm.cmd cocos:preview
```

然后访问 `http://127.0.0.1:4173`。

## 在微信开发者工具中正确运行

微信开发者工具需要打开 **Cocos 构建生成的微信小游戏工程**，不能直接打开仓库根目录、`apps/game-client` 或 Web 构建目录。

### 1. 首次准备

1. 安装 Cocos Dashboard、**Cocos Creator 3.8.8** 和微信开发者工具稳定版。
2. 在仓库根目录安装依赖并检查工具：

```powershell
pnpm.cmd install
pnpm.cmd env:check
```

3. 首次使用时执行 `pnpm.cmd cocos:open`，确认 Creator 以 3.8.8 打开 `apps/game-client`，并等待资源导入完成。
4. 开始命令行构建前关闭 Cocos Creator；构建脚本检测到 Creator 仍在运行时会主动停止，避免两个进程同时写构建目录。

### 2. 构建并打开微信小游戏

在仓库根目录依次执行：

```powershell
pnpm.cmd cocos:build:wechat
pnpm.cmd wechat:open
```

第一条命令会生成：

```text
apps/game-client/build/wechatgame
```

第二条命令会让微信开发者工具直接打开该目录。进入工具后确认：

- 项目类型是“小游戏”，不是“小程序”。
- 项目目录以 `apps/game-client/build/wechatgame` 结尾。
- 模拟器为横屏，页面能显示桌游大厅。
- 点击工具栏的“编译”后，控制台没有脚本异常或资源加载错误。

需要试玩好友房或检查本地网络连接时，另开一个终端保持服务运行：

```powershell
pnpm.cmd dev
```

只试玩斗地主、德州扑克或贵州麻将的单机流程时，可以不启动本地服务；此时顶部可能显示“连接已断开”，但不影响单机牌局。

### 3. 自动打开失败时手动导入

如果 `pnpm.cmd wechat:open` 提示找不到微信开发者工具，可以在微信开发者工具首页选择“导入项目”，并选择：

```text
<仓库目录>\apps\game-client\build\wechatgame
```

导入时选择“小游戏”项目。开发阶段可以使用测试号；需要预览、真机调试或上传时，使用项目所有者提供的微信小游戏 AppID。不要把 AppSecret 写入项目配置、客户端代码或 Git。

以下目录都不是正确的导入目标：

- 仓库根目录 `BoardGameContainer`
- Cocos 源工程 `apps/game-client`
- Web 预览目录 `apps/game-client/build/web-desktop`

### 4. 修改代码或资源后

微信开发者工具中的“编译”只会重新编译当前构建产物，不会把 Cocos 源工程的新改动自动复制进来。每次修改 Cocos 脚本、场景、UI、动画或图片资源后，都需要重新执行：

```powershell
pnpm.cmd cocos:build:wechat
```

然后回到微信开发者工具点击“编译”。如果仍显示旧资源，使用“清缓存 → 全部清除”，再重新编译。

### 5. 模拟器、真机与正式构建的区别

- 微信开发者工具模拟器可以连接 `ws://127.0.0.1:3000/ws`，因为服务与模拟器都运行在电脑上。
- 手机真机里的 `127.0.0.1` 指向手机自身，不能连接电脑上的服务。真机联调需要使用可访问的 CloudBase Run HTTPS/WSS 地址，并在小游戏后台配置合法域名。
- 本地构建默认关闭合法域名校验。准备体验版、上传或正式包时，应启用校验后重新构建：

```powershell
$env:BGC_WECHAT_URL_CHECK = 'true'
pnpm.cmd cocos:build:wechat
```

### 6. 常见问题

| 现象 | 处理方式 |
| --- | --- |
| 提示 Cocos Creator 正在运行 | 保存工程并彻底关闭 Creator，再执行构建命令。 |
| 提示找不到微信开发者工具 | 确认已安装官方稳定版；随后手动导入 `apps/game-client/build/wechatgame`。 |
| 工具打开后是空项目或项目类型错误 | 删除错误导入记录，重新以“小游戏”类型导入 `build/wechatgame`。 |
| 修改牌面或 UI 后没有变化 | 重新执行微信构建，回到工具清缓存并点击“编译”。 |
| 模拟器一直显示连接断开 | 需要联网流程时运行 `pnpm.cmd dev`，并检查本机 `3000` 端口。 |
| 真机无法连接 `127.0.0.1` | 改用 CloudBase Run 的 HTTPS/WSS 地址，不要使用手机回环地址。 |
| 构建失败但终端信息不完整 | 查看 `apps/game-client/temp/logs/project.log` 中的 Cocos 构建日志。 |

## 文档入口

- [需求稳定稿与技术方案](docs/product-requirements-and-technical-design.zh-CN.md)
- [开发文档总览](docs/README.md)
- [系统架构](docs/architecture/OVERVIEW.md)
- [设计系统](docs/design/DESIGN_SYSTEM.md)
- [页面与交互规格](docs/design/SCREEN_SPECS.md)
- [斗地主首版规则草案](docs/game-rules/doudizhu-v1-draft.md)

## 安全约定

`.env`、`cloudbaserc.json`、Cocos 构建产物和本地工具配置不会提交。微信 `AppSecret` 只允许进入 CloudBase 的密钥或环境变量管理，禁止放入小游戏包和 Git。
