# infer-lab 当前主干交接（Stage 2 正式基线）

- **主站形态**：`/` 与 `/#/home` 为服务器城市开场页，点击「开始阅读」进入 `/#/wiki`（12 个主题目录、185 篇正式页）；`/#/tools` 提供 4 套与知识库双向深链的工程工作台（部署计算器、配置体检、故障排查工作台、AI Core 执行实验室）；17 篇概念页内嵌 `wiki-scene` 交互 3D 场景。
- **远端仓库**：`https://github.com/BailanCaptain/infer-lab`（`main` 分支，`Apache-2.0`）。
- **本地启动**：`pnpm dev:all`（前端 `http://127.0.0.1:5173/`，问答与审阅后端 `http://127.0.0.1:8790`）。
- **核心门禁**：`pnpm wiki:diagrams --check`、`pnpm wiki:svg-geometry`、`pnpm wiki:build`、`pnpm wiki:lint`、`pnpm check`、`pnpm build`、`pnpm test:e2e`。
