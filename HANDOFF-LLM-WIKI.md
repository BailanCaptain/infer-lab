# LLM-Wiki 知识库运维与现查交接（Stage 2 正式基线）

## 1. 当前基线

- **版本契约**：默认主基线为 `vllm-ascend v0.30.0 (c09d3e20)` + `vllm (ced6857a)`，同步对照 `releases/v0.23.0`、`releases/v0.26.0rc` 与 `main (8d6180e2)`；主线标尺采用 `Qwen3-8B`（Dense）与 `Qwen3-30B-A3B`（MoE），例外 A（RFork 10 篇）对齐 `main (8d6180e2)`，例外 B（第 7 章 GLM 与 17 篇 `wiki-scene` 绑定算例）保持固定历史钉点。
- **唯一规范出处**：教学写作与视觉标准见 [docs/wiki-writing-standard.md](docs/wiki-writing-standard.md)，入库/审阅/问答切片协议见 [wiki/HANDBOOK.md](wiki/HANDBOOK.md)，外部 Agent 只读检索入口见 [wiki/AGENTS-GUIDE.md](wiki/AGENTS-GUIDE.md)。

## 2. 常用现查与校验命令（数字以命令实跑为准）

```powershell
pnpm wiki:build             # 重建 wiki/index.md 与 src/content/wiki/registry.json
pnpm wiki:diagrams --check  # 校验 YAML 图规格与原生 SVG XML/白名单契约
pnpm wiki:svg-geometry      # Chromium 真实渲染几何校验（越界/内框溢出/重叠/最小字号 ≥12px）
pnpm wiki:lint              # 校验 frontmatter、双向关系、角标边界与引用完整性
pnpm wiki:audit             # 对照 tools/repos/ 校验固定 commit 源码路径、行号与图 pins 符号
pnpm wiki:gaps              # 扫描全库概念引用缺口与覆盖账本
pnpm -s wiki:find "<关键词>" # 与站内问答同源的全文/别名/邻居图谱检索
```
