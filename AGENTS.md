# Repository Agent Guidelines

## Commit message

- 使用 Conventional Commits：`<type>(<scope>): <summary>`。
- `type` 仅使用 `feat`、`fix`、`docs`、`refactor`、`test`、`build`、`ci`、`chore`。
- `scope` 使用稳定的模块名，例如 `client`、`server`、`protocol`、`docs`、`tooling`、`repo`。
- `summary` 使用简洁的中文动宾短语，不加句号，不使用“更新一下”“修改代码”等模糊表述。
- 正文说明改了什么以及为什么；有多项内容时使用短列表。
- 不兼容变更必须在正文或 footer 中写明 `BREAKING CHANGE:`。

示例：

```text
feat(server): 增加房间创建与加入流程

- 增加服务端权威房间状态
- 校验房间号和玩家会话
- 覆盖创建、加入和断线场景
```

## Commit scope

- 每个提交只处理一个可描述、可审查、可回退的逻辑单元。
- 无特殊情况，单次提交的新增与删除合计控制在约 300 行以内。
- 超过约 300 行时，优先按协议、领域、界面、测试、文档或工具拆分。
- 不为追求行数而制造无法编译、无法测试或语义不完整的中间提交。
- 允许超过约 300 行的例外仅包括：生成的锁文件、Cocos 场景与 `.meta`、二进制资产、机械格式化，以及必须原子提交的完整功能；提交正文应说明原因。

## Before committing

- 使用 `git diff --cached --check` 检查空白符和冲突标记。
- 运行与改动范围匹配的类型检查、测试或构建；无法运行时在交付说明中明确原因。
- 不提交 `.env`、密钥、AppSecret、构建产物、编辑器缓存或其他已忽略文件。
- 提交前检查暂存列表，避免混入无关改动。
