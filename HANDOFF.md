# infer-lab 当前主干交接（Stage 2 正式基线）

- **主站形态**：`/` 与 `/#/home` 为服务器城市开场页，点击「开始阅读」进入 `/#/wiki`（12 个主题目录、193 篇正式页［含 41 篇正式参数页］，含因果图谱与内嵌 6 模式公式尺）；顶部导航「部署与排障」（`/#/tools`）提供 5 套与知识库双向深链的工程工作台（估算要几张卡 / 部署计算器、检查启动命令 / 配置体检、分析报错日志 / 在线排障、芯片算子沙盘 / AI Core 实验室、生产故障通关场）；17 篇概念页内嵌 `wiki-scene` 交互 3D 场景，硬件 3D 支持部署显存透视叠加。
- **远端仓库**：`https://github.com/BailanCaptain/infer-lab`（`main` 分支，`Apache-2.0`）。
- **本地启动**：`pnpm dev:all`（前端 `http://127.0.0.1:5173/`，问答与审阅后端 `http://127.0.0.1:8790`）。
- **核心门禁**：`pnpm wiki:diagrams --check`、`pnpm wiki:svg-geometry`、`pnpm wiki:build`、`pnpm wiki:lint`、`pnpm check`、`pnpm build`、`pnpm test:e2e`。
