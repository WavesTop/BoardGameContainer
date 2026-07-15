# Cocos Creator 首次打开清单

本步骤使用 Cocos Creator 3.8.8。仓库脚本不会代替你接受 Cocos 协议或登录账号。

推荐从仓库根目录执行 `pnpm.cmd cocos:open`。直接执行 `.ps1` 被系统策略拦截时，可使用 `tools\open-cocos.cmd`；无需修改全局 PowerShell 策略。

## 1. 打开工程

1. 在仓库根目录执行 `pnpm.cmd cocos:open`，脚本会直接打开 `apps/game-client`。
2. 也可以在 Cocos Dashboard 选择“导入”，手动选择 `C:\code\boardGameContainer\apps\game-client`。
3. 编辑器版本选择 3.8.8，等待 `library` 与 `temp` 初始化完成。
4. 如果编辑器询问升级项目，先取消并确认当前确实使用 3.8.8，不要自动迁移到更高版本。

## 2. 检查 Boot 场景

1. 打开仓库内置的 `assets/scenes/Boot.scene`。
2. 场景包含 `Canvas`、`Main Camera`，`AppRoot` 已挂载在 Canvas 上。
3. `AppRoot.websocketUrl` 本机保持 `ws://127.0.0.1:3000/ws`，昵称可暂时填写测试名。
4. 设计分辨率为 `1600 × 900`；`AppRoot` 会按高度优先适配并用代码生成首版大厅。
5. Boot 已加入构建场景并设置为第一个启动场景。

`AppRoot` 当前会创建大厅、连接本地 WebSocket 服务，并打通创建/加入房间请求。后续再把远端配置、最低版本检查、平台初始化和 Asset Bundle 预加载拆入专用启动阶段。

## 3. 验证大厅

1. 首轮不需要单独保存 `Lobby.scene`；`LobbyView` 会在 Boot 的 Canvas 下生成大厅。
2. 启动 `pnpm.cmd dev` 后预览，验证纸牌类、麻将类、聚会推理三个分类可切换。
3. 验证斗地主可打开创建房间弹窗，输入 6 位房间码可发起加入请求。
4. UI 使用 `docs/design/DESIGN_SYSTEM.md` 的 Token，不要在组件中散落颜色常量。
5. 暂不导入第三方桌游商标、角色、卡面或音频，美术全部使用原创占位资产。

## 4. Web 构建与预览

关闭 Creator 后执行：

```powershell
pnpm.cmd cocos:build:web
pnpm.cmd cocos:preview
```

浏览器访问 `http://127.0.0.1:4173`。预览服务仅监听本机地址，不会暴露到局域网或公网。

## 5. 微信小游戏构建

1. 打开“项目 → 构建发布”。
2. 平台选择“微信小游戏”，启动场景选择 Boot。
3. 开发阶段填写测试 AppID；有正式 AppID 后由项目所有者替换。
4. 输出目录使用 `build/wechatgame`。
5. 完成构建后，在微信开发者工具中导入输出目录。

模拟器连接本机服务可用 `ws://127.0.0.1:3000/ws`。真机的 `127.0.0.1` 指向手机自己，不能连接电脑；跨网络或正式测试需部署 CloudBase Run，并在小游戏后台配置合法的 HTTPS/WSS 域名。

## 6. 验收

- Creator 控制台无脚本编译错误。
- Boot 是第一个构建场景，可正常显示并进入大厅。
- 微信开发者工具能打开构建结果，没有主包超限或未授权域名错误。
- 前后台切换 10 次不黑屏，音频与 WebSocket 生命周期日志符合预期。
- `library`、`temp`、`local`、`profiles`、`build` 仍处于 Git ignored 状态。
