# Cocos Creator 客户端

本目录是 Cocos Creator 3.8.8 项目根目录。第一次使用时：

1. 安装 Cocos Dashboard，并在 Dashboard 中安装 Creator 3.8.8。
2. 用 Dashboard 导入本目录，不要新建同名空项目覆盖它。
3. 首次打开后，Creator 会生成 `library/`、`local/`、`temp/`、`profiles/` 等本地目录。
4. 在编辑器中新建 `Boot.scene`，把 `AppRoot` 挂到 Canvas 节点，然后按 `docs/development/COCOS_FIRST_OPEN.md` 完成首场景设置。

`temp/tsconfig.cocos.json` 由编辑器生成，因此未打开编辑器前不要单独对本目录执行 `tsc`。共享协议、状态同步和规则工具在仓库其他 workspace 包中独立检查。

## 目录边界

- `assets/scripts/app`：客户端组合根与运行时连接。
- `assets/scripts/catalog`：品类与具体玩法目录。
- `assets/scripts/features`：大厅、房间与牌桌等功能视图。
- `assets/scripts/core`：平台抽象、网络、状态和设计令牌。
- `assets/scripts/ui`：代码化 Cocos UI 基础组件。
- `assets/lobby`：后续由编辑器创建大厅场景和 Prefab。
- `assets/games/<game-id>`：每款游戏独立 Asset Bundle。
- 不把完整服务端 `GameState`、洗牌种子或其他玩家隐藏信息放进客户端。
