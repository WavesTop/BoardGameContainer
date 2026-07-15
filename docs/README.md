# BoardGameContainer 开发文档

本文档集是首版开发的单一入口。产品边界以需求稳定稿为准；实现细节如果与稳定稿冲突，先写 ADR 再改代码。

## 新成员阅读顺序

1. [需求稳定稿与技术方案](product-requirements-and-technical-design.zh-CN.md)
2. [Windows 环境搭建](development/SETUP_WINDOWS.md)
3. [本地开发](development/LOCAL_DEVELOPMENT.md)
4. [系统架构](architecture/OVERVIEW.md)
5. [协议约定](architecture/PROTOCOL.md)
6. [设计系统](design/DESIGN_SYSTEM.md) 与 [页面规格](design/SCREEN_SPECS.md)

## 文档地图

| 分类 | 文档 | 解决的问题 |
| --- | --- | --- |
| 产品 | `product-requirements-and-technical-design.zh-CN.md` | 做什么、不做什么、里程碑与验收 |
| 开发 | `development/SETUP_WINDOWS.md` | 安装哪些工具，如何自检 |
| 开发 | `development/COCOS_FIRST_OPEN.md` | 如何创建首场景并构建微信小游戏 |
| 开发 | `development/LOCAL_DEVELOPMENT.md` | 如何启动、测试、排错 |
| 开发 | `development/CLOUDBASE_SETUP.md` | 如何创建云环境和部署服务 |
| 架构 | `architecture/OVERVIEW.md` | 客户端、服务端、存储的责任边界 |
| 架构 | `architecture/PROTOCOL.md` | 消息格式、幂等、重连、兼容策略 |
| 规则 | `game-rules/doudizhu-v1-draft.md` | 第一款正式游戏的规则输入 |
| 设计 | `design/DESIGN_SYSTEM.md` | 颜色、字体、组件与动效规范 |
| 设计 | `design/UX_FLOWS.md` | 从登录到结算的核心流程 |
| 设计 | `design/SCREEN_SPECS.md` | 页面布局、状态和验收标准 |

## 决策纪律

- 已稳定：平台优先级、技术栈、服务端权威、房间模型、插件式游戏模块。
- 可调整：第一款正式游戏的细则、视觉风格细节、CloudBase 资源规格。
- 重大变更：新增 `docs/adr/NNNN-title.md`，写清背景、选项、结论和影响。
