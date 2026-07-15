# CloudBase 配置与部署

CloudBase 负责好友跨网络游玩所需的公网入口、可信微信身份、持久化数据库、对象存储和运维。日常规则开发可完全在本机进行；跨设备联调时才需要云环境。

## 资源规划

建议先创建一个按量计费的开发环境：

- CloudBase Run 服务：`boardgame-runtime-dev`，端口 `3000`，承载 HTTP + WebSocket。
- 文档数据库：房间快照、对局索引、玩家资料和幂等记录。
- 云存储：头像缓存、游戏资源与回放归档；不要存实时房间热状态。
- 日志：按 `traceId`、`roomId`、`gameId` 检索。

正式对外测试前再创建独立生产环境，禁止开发/生产共库。

## 首次账号配置

```powershell
pnpm.cmd cloudbase:login
pnpm.cmd cloudbase:envs
.\tools\configure-cloudbase.ps1 -EnvId "你的环境ID" -ServiceName "boardgame-runtime-dev"
```

登录会打开腾讯云授权页面，需要仓库所有者本人完成。脚本只生成本机 `cloudbaserc.json` 和 `.env`，两者都已加入 `.gitignore`。

## 本地切换持久化实现

首版仓库默认 `BGC_REPOSITORY=memory`。数据库仓储完成后改为：

```dotenv
BGC_REPOSITORY=cloudbase
TCB_ENV_ID=your-env-id
TCB_SERVICE_NAME=boardgame-runtime-dev
```

本地直接访问云数据库时还需按 CloudBase 规则配置凭证；不要把 SecretId/SecretKey 写进 Git。部署到 CloudBase Run 后优先使用运行环境自带身份。

## 部署前检查

```powershell
pnpm.cmd check
pnpm.cmd cloudbase:deploy:dry
pnpm.cmd cloudbase:deploy
```

部署后检查：

1. `/healthz` 返回 200。
2. `/readyz` 返回 repository=`cloudbase` 且 ready。
3. WSS 能保持 10 分钟以上并通过心跳。
4. 小游戏后台配置合法 request/socket 域名。
5. `ALLOW_DEV_IDENTITY=false`。
6. 使用两个不同微信身份完成建房、入房、断线重连。

## 成本控制

- 开发期保持最小实例与合理自动缩容。
- 房间内热状态放进服务进程/专用状态层，按回合或关键事件做数据库快照，避免每个动作写一次数据库。
- 日志设置保留期和采样；回放按生命周期转低频或删除。
- 为数据库读写、CloudRun 请求和存储分别设置预算告警。
