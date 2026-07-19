# 本地开发

## 服务端

```powershell
Copy-Item .env.example .env
pnpm.cmd dev
```

默认监听 `127.0.0.1:3000`，使用内存房间仓储，不连接云资源。开发身份仅在 `.env` 的 `ALLOW_DEV_IDENTITY=true` 时启用：

```text
ws://127.0.0.1:3000/ws?userId=alice&displayName=Alice
```

端点：

- `GET /healthz`：进程存活。
- `GET /readyz`：依赖是否就绪。
- `GET /api/runtime-config`：协议版本和 WebSocket 路径。
- `GET /ws`：实时房间协议升级入口。

## 校验命令

```powershell
pnpm.cmd typecheck
pnpm.cmd cocos:typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd smoke
pnpm.cmd check
```

`smoke` 会启动一个临时服务，检查 HTTP 健康端点，并用两个 WebSocket 客户端完成建房、入房、准备状态广播。它不会访问腾讯云。

`cocos:typecheck` 使用 Creator 3.8.8 生成的真实引擎声明检查客户端；尚未打开过 Cocos 工程时会给出提示并跳过，打开一次后会自动纳入 `pnpm.cmd check`。

## 推荐开发顺序

1. 在 `packages/protocol` 先定义命令与事件并补解析测试。
2. 在具体 `games/<game-id>` 实现纯规则状态机并补确定性测试。
3. 在 `apps/cloudrun-server` 接入房间会话、权限和持久化。
4. 在 Cocos 客户端接入网络端口和只读投影视图。
5. 最后做动效、音效与弱网体验。

## 故障排查

- `pnpm` 版本不一致：运行 `corepack enable` 后重新打开终端，或继续使用已固定版本的 `pnpm.cmd`。
- 3000 端口被占用：修改 `.env` 中 `PORT`，同时修改客户端调试 URL。
- 根目录执行 `pnpm.cmd dev` 会在启动前检查端口占用，并显示占用进程的 PID；确认是遗留的本地服务后可执行 `Stop-Process -Id <PID>`，不要直接结束来源不明的进程。
- 小游戏无法连本机：桌面模拟器可连接 `127.0.0.1`；手机不可以把手机自己的回环地址当作电脑。真机联调使用局域网 IP 仅适合临时调试，正式环境必须 WSS 云地址。
- WebSocket 反复 1008：生产模式缺少 CloudBase/微信网关注入的可信身份头；不要把 query 身份开关带到生产。
- Cocos TypeScript 报 `temp/tsconfig.cocos.json` 不存在：先用 Creator 打开项目一次。

## 分支与提交

功能分支使用 `codex/<topic>` 或 `feature/<topic>`；规则变更必须同时提交协议测试与规则测试。禁止提交 `.env`、`cloudbaserc.json`、`build`、`library`、`temp`、小游戏私钥与 AppSecret。
