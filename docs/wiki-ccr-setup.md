# 问答与 Drop 接入 CCR

项目通过本机 Claude Code 调用 CCR，CCR 再把请求发给配置的模型。问答和 Drop 共用这条调用路径；知识库规则、原文读取、图规格检查和人工审阅仍由项目管理。

`ccr code` 启动的交互会话和项目后端是不同进程。只在另一个终端打开它，不会把路由配置传给后端。项目不复用那个会话，而是让自己启动的 Claude Code 继承后端的连接环境变量。

## 启动

以下命令针对提供 `ccr start`、`ccr activate`、`ccr code` 的 CCR 2.x。实际验收版本是 CCR 2.0.0、Claude Code 2.1.287。新版 CCR 的启动命令可能不同，按其 `--help` 启动网关，再向项目传入对应连接配置；本次没有验证所有 CCR 版本。

1. 安装 Claude Code 并在 CCR 中配置可用的提供商、模型和客户端认证，启动 CCR 网关。服务地址、客户端密钥以自己的配置为准。
2. 合并以下字段到 `wiki/sync.config.local.json`，不要覆盖其中已有的本机配置。该文件已被 Git 忽略。`myprovider,my-model` 必须替换成 CCR 中实际的提供商和模型名；带命名空间与后缀的模型，例如 `provider,organization/model:variant`，也能作为一个完整参数传递。

   ```json
   {
     "chatProvider": "claude",
     "chatModel": "myprovider,my-model"
   }
   ```

   按上游模型的实际可用窗口配置 `contextWindowTokens` 和 `outputReserveTokens`；它们的默认值分别是 128,000 和 16,384，默认值不代表 CCR 后面的模型一定具有该容量。当前配置要求上下文窗口至少 32,768。Drop 会在开始时固定本次选择与预算。

3. 在**启动网站后端的同一个终端**设置 CCR 连接配置，再启动项目。不要把密钥写进共享配置、提交到仓库或贴进聊天。

   Bash / Zsh（CCR 已运行）：

   ```bash
   eval "$(ccr activate)"
   export CLAUDE_CLI="$(command -v claude)"
   pnpm dev:all
   ```

   PowerShell（服务地址按自己的 CCR 配置修改）：

   ```powershell
   $env:ANTHROPIC_BASE_URL = 'http://127.0.0.1:3456'
   $ccrClientSecret = Read-Host 'CCR 客户端密钥' -AsSecureString
   $env:ANTHROPIC_AUTH_TOKEN = [System.Net.NetworkCredential]::new('', $ccrClientSecret).Password
   $env:ANTHROPIC_API_KEY = ''
   $env:NO_PROXY = (@($env:NO_PROXY, '127.0.0.1', 'localhost') | Where-Object { $_ }) -join ','
   $env:CLAUDE_CLI = "$env:USERPROFILE/.local/bin/claude.exe"
   pnpm dev:all
   ```

   Windows 必须使用存在的原生 `claude.exe`，路径不同时修改 `CLAUDE_CLI`；不要填 `ccr code` 或 `.cmd` 包装器。项目保留禁止 shell 回退的隔离约束。启动后端后才修改环境变量，需要重启后端使其生效。

4. 完成项目本身的预算账本初始化。先用 `pnpm wiki:budget status` 查看；首次初始化使用 `pnpm wiki:budget init`，明确提供 `--limit-usd`、`--prior-charged-usd`、`--reserve-usd`、`--max-calls`，参数与行为见 [账本命令](../scripts/wiki-budget.ts)。新部署若没有账本，Drop 会在模型调用前拒绝执行；CCR 不会替项目初始化账本。不要重置已有账本；生产模式的额度策略仍以 [F004](features/F004-knowledge-loop.md) 为准。
5. 分别发起一次问答和一次小资料 Drop，在 CCR 日志中核对实际提供商与模型，并确认 Drop 到达待审阅状态。编译产生的正式知识仍需人工批准。

项目有意关闭自动加载 Claude 的用户、项目和本地设置（`--setting-sources ""`），并保留安全模式、工具限制与 MCP 隔离。因此，不能只把路由地址放进个人 `~/.claude/settings.json` 就假设网站会读取它。连接环境变量会继承，写作规范由项目显式提供。

## 2026-11-02 验收证据

在独立目录运行真实 Claude Code 2.1.287 和真实 CCR 2.0.0。CCR 的上游是本地确定性响应服务，不调用真实商业模型，不用其结果评价事实理解或写作质量；正式知识库和当前 Codex 配置保持原样。

| 检查 | 结果 |
|---|---|
| `ccr code -p` | 退出码 0，通过 CCR 返回唯一测试标记 |
| 项目问答 | 实际 `buildChatRequest` → `runChat` → Claude Code → CCR → 测试上游；成功返回流式文本及结束记录 |
| 完整 Drop | 实际 `acceptBatch` → `startDrop`，未替换模型启动器或跳过验证；完成提取、发现、生成及逐页/跨页复核，到达 `review`，生成两个来源页的待审阅变更 |
| 路由核对 | 共 11 次请求；项目传入 `fixture,example/model:probe`，上游实际收到 `example/model:probe`，证明提供商路由由 CCR 解析；材料随请求送达 |
| 修复前回归 | 4 项失败：模型名校验拒绝 CCR 路由，问答及受限 Drop 请求都被阻断 |
| 修复 | 在共享模型名校验处支持提供商前缀、命名空间与版本后缀；继续拒绝空白、换行、以选项开头的名称及 shell 语法；工具与设置隔离规则未放宽 |
| 工程回归 | 10 个相关测试文件、147 项测试通过；类型检查、Lint 和构建通过，Vite 构建 29.39 秒。Lint 保留 27 项既有非阻断警告；本轮未重跑全库测试，日志为 `targeted-final.log`、`typecheck.log`、`lint.log`、`build.log` |

原始记录保存在忽略目录 `tools/wiki-runtime/ccr-verification/`：`red.log`、`transport-receipt.json`、`ccr-complete.log`、`ccr-receipt.json`。本地模拟服务返回的 token/费用字段仅为协议夹具，不是实际模型用量或费用。CCR 后面具体模型能否满足复杂原文保留、图解与跨页推理要求，仍需使用该模型另做真实资料验收。
