# BoardGameContainer

面向好友开黑的线上桌游容器。首发平台是微信小游戏，技术路线为 Cocos Creator 3.8.8 + TypeScript + 腾讯云开发 CloudBase；服务端保持权威判定，为斗地主、麻将、UNO、狼人杀、三国杀等复杂游戏预留统一的规则引擎接口。

## 当前包含

- `apps/game-client`：Cocos Creator 微信小游戏客户端骨架。
- `apps/cloudrun-server`：HTTP + WebSocket 权威房间服务，可在本机直接启动。
- `packages/protocol`：客户端与服务端共享协议和运行时校验。
- `packages/game-sdk`：游戏模块契约，隔离平台能力与具体规则。
- `games/demo`：确定性示例规则，用于验证命令、事件、状态、视图链路。
- `docs`：产品、技术、开发、交互和视觉设计文档。

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

## 文档入口

- [需求稳定稿与技术方案](docs/product-requirements-and-technical-design.zh-CN.md)
- [开发文档总览](docs/README.md)
- [系统架构](docs/architecture/OVERVIEW.md)
- [设计系统](docs/design/DESIGN_SYSTEM.md)
- [页面与交互规格](docs/design/SCREEN_SPECS.md)
- [斗地主首版规则草案](docs/game-rules/doudizhu-v1-draft.md)

## 安全约定

`.env`、`cloudbaserc.json`、Cocos 构建产物和本地工具配置不会提交。微信 `AppSecret` 只允许进入 CloudBase 的密钥或环境变量管理，禁止放入小游戏包和 Git。
