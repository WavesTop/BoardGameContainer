# Windows 环境搭建

## 固定版本

| 工具 | 版本 | 用途 |
| --- | --- | --- |
| Node.js | 24.x | 服务端、脚本与测试 |
| pnpm | 11.7.0 | Monorepo 包管理 |
| Git | 2.x | 版本管理 |
| Cocos Creator | 3.8.8 | 小游戏客户端编辑与构建 |
| 微信开发者工具 | 当前稳定版 | 预览、真机调试、上传 |
| CloudBase CLI | 项目锁定 3.6.2 | 登录、环境查看、CloudRun 部署 |

Node、pnpm、Git 和 CloudBase CLI 都由仓库脚本检测；CloudBase CLI 是项目依赖，不要求全局安装。

## 1. 初始化仓库

```powershell
cd C:\code\boardGameContainer
.\tools\bootstrap.ps1
pnpm.cmd env:check
```

脚本会复制 `.env.example`、安装依赖并运行 TypeScript 与单元测试。缺少 Cocos 或微信开发者工具只会显示为 optional pending，不阻止服务端开发。

## 2. 安装 Cocos Creator

1. 安装 Cocos Dashboard。
2. 在 Dashboard 中安装 Creator `3.8.8`。
3. 使用 Creator 打开 `apps/game-client`。
4. 等待编辑器生成 `library`、`temp` 与资源 `.meta` 文件。
5. 创建 `assets/scenes/Boot.scene`，把 `BootController` 挂到根节点并设为启动场景。

可以用 `.\tools\open-cocos.ps1` 自动定位并打开项目；如果安装在自定义目录，直接从 Dashboard 打开即可。

如果 PowerShell 提示“禁止运行脚本”，不要修改全局执行策略，改用：

```powershell
pnpm.cmd cocos:open
# 或
.\tools\open-cocos.cmd
```

这两个入口只为当前进程传入 `-ExecutionPolicy Bypass`。

## 3. 安装微信开发者工具

从微信官方开发者站点安装稳定版。首次构建在 Cocos 中选择“微信小游戏”，输出目录建议使用 `build/wechatgame`，然后用微信开发者工具导入该目录。

开发阶段可先使用测试号。真机与上传需要你自己的小游戏 AppID；AppID 不等于 AppSecret，后者绝不能进入客户端或仓库。

## 4. Cocos 首次构建设置

- 平台：微信小游戏。
- 初始场景：`Boot.scene`。
- 远程服务地址：本机模拟器使用 `ws://127.0.0.1:3000/ws`；真机必须使用已备案且支持 WSS 的公网域名。
- 主包只放大厅和公共资源；具体游戏资源拆成 Asset Bundle。
- 首版关闭物理引擎、3D 等未使用模块，控制小游戏包体。

## 5. 自检结果判定

`pnpm env:check` 中 Required 必须全部为 `True`。Optional 可按当前任务逐步补齐：纯服务端开发不要求 Cocos；真机联调才要求微信工具和 CloudBase 配置。
