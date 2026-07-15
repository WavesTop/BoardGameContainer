# 实时协议约定

## 消息信封

```json
{
  "protocolVersion": 1,
  "type": "room.ready",
  "requestId": "01JREQUEST0001",
  "payload": { "ready": true }
}
```

- `protocolVersion`：整数主版本；不兼容变更才递增。
- `type`：`domain.action`，例如 `room.join`、`game.command`。
- `requestId`：客户端生成，全局唯一，所有有副作用命令必填。
- `roomId/gameId/revision`：需要时放在 payload 或状态消息中，不信任客户端提供的 userId。

## 首批消息

| 方向 | 类型 | 用途 |
| --- | --- | --- |
| C→S | `system.ping` | 心跳与时钟采样 |
| C→S | `room.create` | 创建好友房 |
| C→S | `room.join` | 通过 6 位码入房 |
| C→S | `room.ready` | 更新准备状态 |
| S→C | `system.pong` | 心跳响应 |
| S→C | `room.created/joined` | 单请求确认 |
| S→C | `room.state` | 房间权威投影 |
| S→C | `error` | 稳定错误码与可重试标识 |

代码中的当前 schema 位于 `packages/protocol/src/index.ts`。

## 幂等与顺序

- 服务端对 `(userId, requestId)` 保存处理结果；重发返回原结果，不重复出牌或扣资源。
- 游戏命令携带客户端已见 `revision`。落后时返回 `REVISION_CONFLICT` 和最新快照。
- 每个房间由一个串行执行器处理命令，禁止并发修改同一状态。
- 随机过程由服务端种子驱动，种子和事件进入审计记录，客户端只看允许公开的结果。

## 重连

客户端使用指数退避加抖动，建议 1s、2s、4s、8s，封顶 15s。连接恢复后发送 `session.resume`（待实现），包含最后确认 revision；服务端返回缺失事件或最新私密投影。若 token 失效，先刷新微信/CloudBase 身份再重连。

## 兼容性

- 新增可选字段：向后兼容。
- 改字段语义、删除字段或改变类型：升级 protocolVersion。
- 服务端至少在一次灰度周期内同时接受当前与上一版本。
- 客户端遇到未知服务端事件应记录并忽略；遇到明确 `CLIENT_UPGRADE_REQUIRED` 时阻止入局并提示更新。

## 安全

- 生产只接受 WSS。
- 身份来自 CloudBase/微信可信链路注入，不接受客户端自报 openId。
- 每类命令按用户、连接与房间限流。
- 所有 payload 在进入领域层前做运行时 schema 校验。
- 日志可记录 userId 的稳定哈希，不记录 openId、token、手牌全文或 AppSecret。
