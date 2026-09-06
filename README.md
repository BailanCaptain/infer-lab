# infer-lab · 大模型推理可视化实验室

以 vLLM-Ascend 为主线的大模型推理交互式教学平台。学习者从 Token、向量、矩阵出发，看懂 Transformer 的计算，看懂请求如何流经 CPU、NPU、HBM、互联与机柜，理解 vLLM / vLLM-Ascend 的调度、KV Cache、并行与执行机制，最终能读源码并分析 PR 对特性、数据流和性能指标的影响。

## 原则

- **教学优先**：每章按「问题 → 前置概念 → 交互实验 → 逐步观察形状变化 → 连接硬件/特性/源码 → 小结」组织。
- **两层数据流对应**：模型计算层与硬件执行层在每一步同步。
- **真实尺寸**：教学章按真实模型（默认 Qwen3-0.6B）维度计算与渲染；权重为固定种子生成，页面明确标注。
- **事实纪律**：以 vLLM-Ascend 文档与固定 commit 源码为依据；结论带证据标记 `[S] 官方 / [C] 源码 / [D] 推导 / [A] 假设 / [I] 推断 / [M] 实测 / [!] 冲突`。

事实基线：vLLM `cacc429f` + vLLM-Ascend `28bf3a2e`（2026-08-29 核验）；页面同时标注最新稳定版 v0.23.0。

## 开发

```powershell
pnpm install
pnpm dev          # 本地开发
pnpm check        # typecheck + lint + 单测 + 依赖方向 + 内容校验
pnpm build        # 产物在 dist/
pnpm test:e2e     # Playwright 浏览器验收
```

目录与依赖方向：`design ← sim ← timeline ← viz2d ← content ← app`，见 `scripts/check-deps.ts`。视觉合同见 `DESIGN.md`。

## 参考与授权

- 并行策略教学图包（`reference/parallelism-teaching-dark/`）：只使用其事实与证据账本，图全部重做为交互组件。
- InferFlux（CC BY-NC）：只借鉴教学与交互思路，不复制代码。
- LLM Visualization、Transformer Explainer（MIT）：借鉴叙事与交互设计。
- 站内嵌入的 vLLM / vLLM-Ascend 源码片段遵循 Apache-2.0，标注固定 commit 与行号。
