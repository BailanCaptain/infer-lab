# 交接说明（写于 2026-09-06 03:40，供新会话直接接手）

新会话请**先读本文件，再读下面三份**，然后从「五、下一步」第 1 条开始动手，不要重新讨论方案。

| 文件 | 作用 |
|---|---|
| `CLAUDE.md`（本目录） | 工作规则：证据契约、交付格式、最小必要改动 |
| `C:\Users\-\.claude\plans\shimmering-zooming-scroll.md` | **完整计划**（22 章蓝图、架构 §2.1–2.12、M1 任务表 §2.10、里程碑） |
| `C:\Users\-\.claude\projects\C--Users---Desktop-infra-view-new\memory\` | 已确认决策与用户对视觉质量的反馈 |

---

## 一、项目是什么

以 **vLLM-Ascend** 为主线的中文**交互式教学平台**（纯静态站点）。学习路径：核心概念 → Token/向量/矩阵计算 → 请求穿过 CPU/NPU/HBM/互联/机柜 → vLLM/vLLM-Ascend 的调度/KV Cache/并行/执行 → 读源码与分析 PR 影响。

硬约束（用户原始需求，违反即返工）：
1. **教学优先**：每章 = 提出问题 → 补前置概念 → 交互图看计算 → 逐步观察形状变化 → 连接硬件/特性/源码。
2. **两层数据流每一步都要对应**：模型计算层（形状/数值）与硬件执行层（驻留/搬运/活跃单元）同步呈现。
3. **3D 只用在确实提升理解处**：看得见矩阵维度、切分、计算、聚合；看得见 token/张量/KV 流动；硬件模型参考真实设计并全站复用；中文清晰无遮挡；播放/暂停/单步与图形紧绑定。
4. **禁止**：平铺立方体阵列、伪 3D 流程图、光点在方块间移动、为动画虚构流程。
5. **事实纪律**：结论有来源，区分官方 `[S]` / 源码 `[C]` / 推导 `[D]` / 假设 `[A]` / 推断 `[I]` / 实测 `[M]`（当前为空）/ 冲突 `[!]`。

用户明确否定上一版 `..\infra-view`（"太烂了"）——**不要读、不要复用它的任何代码**。前端观感可参考 `C:\Users\-\Desktop\Multi-Agent\multi-agent-skills\design-taste\SKILL.md`。

## 二、已确认决策（不需再问用户）

- 技术栈：Vite + React 19 + TS + react-three-fiber 9 + drei + postprocessing + Tailwind v4 + zustand + MDX；GitHub Pages 静态部署；深色主题。
- 事实基线：vLLM `cacc429f` + vLLM-Ascend `28bf3a2e`（2026-08-29 核验），页面同时标注稳定版 v0.23.0。
- 硬件：昇腾为主（Atlas 800I A2 八卡 HCCS、A3 超节点），H100 只做术语对照；**无实机，站内不得出现自测性能数据**。
- **教学章一律用真实模型尺寸**（默认 Qwen3-0.6B，可切 Qwen3-8B），抽样显示格值；不用 H=8 微型模型（微型 spec 只在 golden 测试里用）。`ModelSpec` 是全站唯一形状来源。
- 权重不下载、不存储：按 `(张量 id, i, j)` 哈希惰性生成，标 `[A01]`。
- 模型工作台（用户重点需求）：粘贴 HF `config.json` → 构建整个模型结构（3D）→ 回答四问：① 每生成一个 token 的 KV Cache 显存；② 总参数量与激活参数量；③ 给定 prompt X k / 输出 Y k / batch z 的部署方案；④ prefill/decode 理论耗时。**M1 只做 ①②+3D 结构图，③④ 放 M2。**
- 图片包 `reference/parallelism-teaching-dark/`（19 张 PNG + `SOURCE_INDEX.md` + `CLAIM_LEDGER.md`）：**只用其事实与证据账本**，图全部重做成交互组件。

## 三、代码现状

已提交：commit `1307ebc` "Scaffold infer-lab" —— 脚手架可跑可部署，`pnpm check` 当时通过。
包含：Vite/TS/Tailwind v4 tokens（`src/design/tokens.css`，颜色与字阶语义）、`DESIGN.md`、Biome（含 `noRestrictedImports` 分层约束）、vitest、HashRouter 空壳、`.github/workflows/deploy.yml`、自托管字体、`scripts/{check-deps,check-content,gen-font-subset}.ts`。

**未提交且从未跑过 typecheck / lint / test 的新文件**（`git status`: `?? src/sim/`、`?? .gitattributes`、`?? scripts/subset-font.d.ts`）：

| 文件 | 内容 |
|---|---|
| `src/sim/rng.ts` | `hashString`(FNV-1a)、`mixSeed`、`Xorshift32`、`mulberry32`；禁 `Math.random` |
| `src/sim/modelspec/types.ts` | `ModelSpec` / `LayerSpec` / `AttentionSpec`(mha\|gqa\|mqa\|mla\|linear_kda\|dsa) / `MlpSpec`(dense\|moe) / `DTYPE_BYTES` / `attnQDim` / `attnKvDim` / `isHomogeneous` |
| `src/sim/modelspec/parseHfConfig.ts` | 支持 qwen3 / qwen3_moe / qwen2 / llama；解包 `text_config`；记录 `unrecognized` 字段；MoE 层判定 `!mlpOnly.has(i) && numExperts>0 && (i+1)%sparseStep===0`；`UnsupportedModelError` |
| `src/sim/modelspec/analyze.ts` | `analyzeParams`（逐层 items + total/active/nonEmbedding）、`analyzeKvPerToken`（`2·n_kv·d_h·bytes`，非 MHA/GQA/MQA 抛错）、`weightBytes`、`fmtBytes`、`fmtCount` |
| `src/sim/modelspec/presets{.ts,/*.json}` | 三份 HF 官方 config 原文（Qwen3-0.6B / 8B / 30B-A3B）+ 官方公布参数量 + `getPresetSpec(id)`、`DEFAULT_MODEL_ID` |
| `src/sim/modelspec/analyze.test.ts` | 解析器用例 + 参数量 golden（对照官方，dense 误差 <1%、激活 <2%）+ KV 用例。**尚未运行** |
| `src/sim/tensor/tensor.ts` | `Tensor{shape,dims,data:Float32Array}` 与 `zeros/fromArray/at2/at3/reshape/shapeLabel/absMax` |
| `src/sim/weights.ts` | `LazyWeight`（形状按 `[in,out]`，注意 HF `nn.Linear` 存 `[out,in]`，页面要同时标注）、`weightAt/weightColumn/weightRow/weightThumb`；均匀分布 `U(−√3σ, √3σ)` |
| `src/sim/tensor/ops.ts` | `rmsnorm`、`rmsnormLastDim`(q/k norm)、`linearLazy`（按列流式）、`embedLazy`、`splitHeads`、`ropeInplace`(rotate_half)、`attentionScores`(GQA `g(h)=⌊h/(n_q/n_kv)⌋`)、`causalMaskInplace`、`softmaxLastDim`、`attentionValues`、`mergeHeads`、`add`、`siluMul` |
| `src/sim/timeline/types.ts` | **`Step` 是唯一真相源**：`model{tensors,highlight,op,lineage}` + `hardware{residency,transfers,active}` + `camera/evidence/terms/beats`；`Timeline`、`TensorRecord`、`Location`、`OpKind` |
| `src/sim/timeline/recorder.ts` | `Recorder.dense/weight/step`，边算边录 |
| `src/sim/timeline/validate.ts` | `validateTimeline` 校验 id 唯一 / title ≤14 字 / brief ≤40 字 / evidence 非空 / 张量已登记 / 高亮不越界 / matmul 可乘 / beats 单调 / transfer 有落点 |

> 结论：**sim 层的骨架写完了，但一行都没验证过。** 新会话第一件事就是跑起来。

## 四、环境事实

- Windows 11 + PowerShell；Node v24.14.0；pnpm 10.32.1；项目已 `git init`（HEAD = `1307ebc`）。
- 本机 **没有** Python `transformers` / `tokenizers`（只有 numpy 1.21.5）→ 预设句子的 token id 改用 Node 加载 Qwen3 `tokenizer.json` 离线生成，结果作为 `[S]` 数据随预设打包。
- 命令：`pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm check:deps` / `pnpm check:content` / `pnpm check`（全跑）/ `pnpm dev` / `pnpm build`。

## 五、下一步（M1，按序；对应计划 §2.10）

1. **验证 sim 层**：`pnpm typecheck && pnpm lint && pnpm test`，修完全部报错。验收 = 参数量 golden 通过（0.6B 非嵌入 0.44B、8B 非嵌入 6.95B、30B-A3B 30.5B/激活 3.3B）。
2. **`src/sim/model/forwardLayer.ts`**：`forwardLayer(spec, layerIdx, ids, rec)`，Qwen3 单层前向，边算边 `rec.step()` 录约 20 步：
   `embed.gather → L0.ln1 → L0.attn.q/k/v → L0.attn.qknorm → L0.attn.rope → L0.attn.scores → L0.attn.mask → L0.attn.softmax → L0.attn.pv → L0.attn.merge → L0.attn.o → L0.res1 → L0.ln2 → L0.mlp.gate/up → L0.mlp.act → L0.mlp.down → L0.res2 → L0.kv.write`
   每步写中文 `brief`(≤40 字)/`detail`/`formula`、`lineage`（如 `[S,H] · [H,n_q·d_h] → [S,n_q·d_h]`）、`evidence`、`terms`。
3. **测试**：① 缩小 spec（H=32）下算子与 Float64 朴素实现逐元素对拍 1e-5；② 真实尺寸不变量（softmax 行和=1、RMSNorm 后 RMS≈1、GQA 组内共享同一 K/V 头、残差 shape 不变、shape 链与 ModelSpec 一致）；③ `validateTimeline` 对生成的 timeline 无 issue。
4. **Spike D 性能**：Worker 内 Qwen3-0.6B / 8B 单层 S≈6 前向计时。验收：0.6B <0.5s、8B <5s；8B 不达标则降级为「仅形状」模式。
5. **`src/sim/hardware/`**：`NpuSpec`（910B anchors：`hbm[0..3]`、`cube`、`vector`、`l2`、`hccs[0..6]`、`pcie`）+ `residencyRules.ts` + `mapResidency(step, spec)` 填充 `Step.hardware`（权重常驻 HBM 权重区；激活 HBM→L2→cube；softmax 走 vector；KV 写回 HBM kv 区；每条规则带证据等级）。
6. 之后依次：`src/timeline` 播放引擎（zustand store + 单个 `<Clock/>` 推进瞬态 `progress.t` + 快捷键 + URL `?ch=&step=&layer=&nofx=1` + reduced-motion，Spike C）→ `viz3d`（Spike A 标签清晰度、Spike B TensorGrid 全幅纹理平面 + InstancedMesh 放大窗口、CameraDirector、MatMulRig、FlowPacket、KVBlockGrid、NpuModule910B + AnchorRegistry、双层分屏）→ 内容管线与 MDX 组件 → 章节页布局 → `03` 章正文 + `claims.md` → 模型工作台 v1 → Playwright 截图与标签断言。

每完成一步：跑相关校验 → `git commit` → 按 Why / What / Evidence / Tradeoff / Open Questions 汇报；只有拿到实际命令输出或测试结果才能说"完成"。UI 改动必须在浏览器里实际打开验证，并把关键截图发给用户目测。

## 六、容易踩的坑

- 权重形状约定 `[in, out]`（`y = x·W`），与 HF checkpoint 的 `[out, in]` 相反，写文案时要说明。
- `sim/` 层禁止 import three / react / zustand；`timeline/` 禁止 import three。违反会被 `pnpm check:deps` 与 Biome 拦下。
- Tailwind v4 用 `@theme`（`src/design/tokens.css`），Biome 需 `css.parser.tailwindDirectives: true`（已配）。
- 大批量写文件不要用 bash heredoc 串联（历史上失败过），逐个文件写。
