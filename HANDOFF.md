# 交接说明（写于 2026-09-06 03:40，更新于 2026-09-06 13:17，供新会话直接接手）

新会话请**先读本文件，再读下面三份**，然后从「五、下一步」**第 5 条**（第 1–4 条已完成）开始动手，不要重新讨论方案。

> 上手前先看「四、环境事实」最后一条：本会话的模型会中途从 Fable 5.1 掉到 Opus 5，属已查明的正常现象，不必排查。

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

已提交（`git log --oneline`）：
- `1307ebc` 脚手架：Vite/TS/Tailwind v4 tokens（`src/design/tokens.css`）、`DESIGN.md`、Biome（含 `noRestrictedImports` 分层约束）、vitest、HashRouter 空壳、`.github/workflows/deploy.yml`、自托管字体、`scripts/{check-deps,check-content,gen-font-subset}.ts`。
- `a440f5c` sim 层基座 + 本文件：`pnpm typecheck && pnpm lint && pnpm test` 首次全通过（2026-09-06 06:07，11 个测试）。
- 其后一条（见 git log）：`src/sim/model/`（单层前向 + 证据注册表 + 测试）、`validate.ts` 头维高亮修复、`scripts/bench-forward.ts`。`pnpm check` 全通过（51 个测试）。

**`src/sim/` 各文件（全部已通过 typecheck / lint / test）**：

| 文件 | 内容 |
|---|---|
| `rng.ts` | `hashString`(FNV-1a)、`mixSeed`、`Xorshift32`、`mulberry32`；禁 `Math.random` |
| `modelspec/types.ts` | `ModelSpec` / `LayerSpec` / `AttentionSpec`(mha\|gqa\|mqa\|mla\|linear_kda\|dsa) / `MlpSpec`(dense\|moe) / `DTYPE_BYTES` / `attnQDim` / `attnKvDim` / `isHomogeneous` |
| `modelspec/parseHfConfig.ts` | 支持 qwen3 / qwen3_moe / qwen2 / llama；解包 `text_config`；记录 `unrecognized`；MoE 层判定 `!mlpOnly.has(i) && numExperts>0 && (i+1)%sparseStep===0`；`UnsupportedModelError` |
| `modelspec/analyze.ts` | `analyzeParams`、`kvBytesPerTokenLayer`（KV 公式唯一定义处）、`analyzeKvPerToken`、`weightBytes`、`fmtBytes`、`fmtCount` |
| `modelspec/presets{.ts,/*.json}` | 三份 HF 官方 config 原文（Qwen3-0.6B / 8B / 30B-A3B）+ 官方参数量 + `getPresetSpec(id)`、`DEFAULT_MODEL_ID` |
| `modelspec/analyze.test.ts` | 解析器 + 参数量 golden（0.6B 非嵌入 0.44B、8B 6.95B、30B-A3B 30.5B/激活 3.3B，误差 <1%/<2%）+ KV 用例。**已通过** |
| `tensor/tensor.ts` | `Tensor{shape,dims,data:Float32Array}` 与 `zeros/fromArray/at2/at3/reshape/clone/shapeLabel/absMax` |
| `weights.ts` | `LazyWeight`（形状 `[in,out]`，HF 存 `[out,in]`）、`weightAt/weightColumn/weightRow/weightThumb`；`U(−√3σ, √3σ)` |
| `tensor/ops.ts` | `rmsnorm`、`rmsnormLastDim`、`linearLazy`、`embedLazy`、`splitHeads`、`ropeInplace`、`attentionScores`(GQA)、`causalMaskInplace`、`softmaxLastDim`、`attentionValues`、`mergeHeads`、`add`、`siluMul` |
| `timeline/types.ts` | **`Step` 是唯一真相源**；`Timeline`、`TensorRecord`、`Location`、`OpKind` |
| `timeline/recorder.ts` | `Recorder.dense/weight/step`，边算边录 |
| `timeline/validate.ts` | `validateTimeline`：id 唯一 / title ≤14 / brief ≤40 / evidence 非空 / 张量已登记 / 高亮不越界（**带 `head` 时 rows/cols 指头内二维**）/ matmul 可乘 / beats 单调 / transfer 有落点；`validate.test.ts` 覆盖高亮规则 |
| `model/claims.ts` | `FORWARD_CLAIMS`：S01、C01–C09（transformers **v4.51.3** `modeling_qwen3.py` 行号，2026-09-06 实际打开核验）、D01–D03、A01–A03；`assertClaimIds` |
| `model/forwardLayer.ts` | `forwardLayer(spec, layerIdx, ids, rec, {positions?, xIn?})`：Qwen3 dense 单层，录 21 步（qkNorm=false 为 20 步）；`buildLayerTimeline(spec, preset, {layerIndex?, chapterId?})` 构造期跑 `assertValid` + `assertClaimIds`。MoE / MLA / attention_bias 抛错（M2） |
| `model/forwardLayer.test.ts` | ① H=32 缩小 spec 与独立 Float64 参考实现 21 个张量逐元素 <1e-5；② Qwen3-0.6B 真实尺寸不变量（形状链、softmax 行和、RMSNorm、GQA g(h)=⌊h/2⌋、KV 字节 = `analyzeKvPerToken`×S、确定性）；③ 步骤顺序、证据注册、`validateTimeline` 无 issue；④ 变体（MHA、无 qkNorm、xIn 串两层、错误输入） |

`scripts/bench-forward.ts`（`pnpm bench:forward`）= Spike D 的 Node 版：**Qwen3-0.6B 单层 S=6 约 111 ms，Qwen3-8B 约 1.3 s**（2026-09-06，本机），都在验收线内（0.5 s / 5 s）。浏览器 Worker 内的数字还没测。

步骤 id（固定，可进 URL）：`embed.gather → L0.ln1 → L0.attn.q → L0.attn.k → L0.attn.v → L0.attn.qknorm → L0.attn.rope → L0.attn.scores → L0.attn.mask → L0.attn.softmax → L0.attn.pv → L0.attn.merge → L0.attn.o → L0.res1 → L0.ln2 → L0.mlp.gate → L0.mlp.up → L0.mlp.act → L0.mlp.down → L0.res2 → L0.kv.write`。

## 四、环境事实

- Windows 11 + PowerShell；Node v24.14.0；pnpm 10.32.1；Claude Code 2.1.263；项目已 `git init`（HEAD = `829ba05`）。
- 本机 **没有** Python `transformers` / `tokenizers`（只有 numpy 1.21.5）→ 预设句子的 token id 改用 Node 加载 Qwen3 `tokenizer.json` 离线生成，结果作为 `[S]` 数据随预设打包。
- 命令：`pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm check:deps` / `pnpm check:content` / `pnpm check`（全跑）/ `pnpm dev` / `pnpm build`。
- **模型会中途从 Fable 5.1 掉到 Opus 5，这是本项目的固有现象，不是配置错误、不是用户操作。** 至今三次会话各触发一次，事件类型 `model_refusal_fallback`、类别 `frontier_llm`、`scope: session`（一旦触发，本次会话余下全部在 Opus 5 上跑），记录在 `~/.claude/projects/C--Users---Desktop-infra-view-new/*.jsonl`。原因是本项目正文长期讨论大模型推理内部机制（Transformer 逐步计算、KV Cache、并行切分、NPU 执行），命中了 Fable 5.1 的前沿模型话题分类器；官方提示语自己写明「有时会发生在安全、正常的对话上」。`~/.claude/settings.json` 里配置的仍是 `claude-fable-5-1[1m]`，所以**下次新会话会再从 Fable 起步，并可能再次掉档**。若要行为稳定，用户可以直接把模型固定成 Opus 5；不要为此改动代码或删减内容。

## 五、下一步（M1，按序；对应计划 §2.10）

已完成（有测试/命令输出为证）：
1. ~~验证 sim 层~~ `pnpm check` 全通过；参数量 golden 通过。
2. ~~`src/sim/model/forwardLayer.ts`~~ 21 步，每步有中文 brief/detail/formula、lineage、evidence、terms、highlight。
3. ~~测试~~ 对拍 / 不变量 / validateTimeline 均通过（51 个测试）。
4. ~~Spike D~~ Node 版达标（见上）；**浏览器 Worker 内计时留到播放引擎接上 Worker 时顺手做**。

待做：
5. **`src/sim/hardware/`**：`NpuSpec`（910B anchors：`hbm[0..3]`、`cube`、`vector`、`l2`、`hccs[0..6]`、`pcie`）+ `residencyRules.ts` + `mapResidency(step, spec)` 填充 `Step.hardware`（权重常驻 HBM 权重区；激活 HBM→L2→cube；softmax / RMSNorm / SwiGLU 走 vector；KV 写回 HBM kv 区；每条规则带证据等级，证据 id 注册进 `claims.ts` 同类注册表）。验收：每步 residency/transfers 完整，`validateTimeline` 仍无 issue，transfers.bytes 与 `TensorRecord.bytes` 一致。

   **当前状态（2026-09-06 13:17）：一行代码都还没写。** 已读完全部前置（`Step.hardware` 契约见 `src/sim/timeline/types.ts` 的 `Location` / `HardwareUnit`；`Recorder.step` 默认填 `{residency:{},transfers:[],active:[]}`；`validateTimeline` 已校验「transfer 张量必须在本步 residency 中有落点」）。**卡在第一步：昇腾 910B 的官方事实来源还没查。** 两次会话都是刚要发 WebSearch 就被打断，至今没有发出过任何搜索。

   接手时按这个顺序做：
   1. 先定事实。需要的是**结构性事实**（M1 不需要峰值算力/带宽数字，那是 M2 工作台的事）：一颗 910B 有几个 HBM stack、AI Core 里 Cube/Vector/Scalar 的分工、片上缓存层级（L2 / L1 / Unified Buffer）、单卡 HCCS 链路数与八卡拓扑、PCIe 形态。优先级：华为昇腾社区与 CANN 官方文档 `[S]` > 昇腾开源仓库 `[C]` > 公开二手资料 `[I]`。查不到的物理细节**必须标「概念剖面」`[A]`**，不要编数字——计划 §2.5 已经明确允许这样做，站内也不得出现自测性能数据（无实机）。
   2. 证据写进新的 `src/sim/hardware/claims.ts`（**不要往 `model/claims.ts` 里塞**，那是 03 章前向的注册表；两者结构相同、各自独立，`content/sources.ts` 后面统一 re-export）。
   3. 再写 `NpuSpec` 与 `residencyRules.ts`，最后 `mapResidency`。
   4. `sim/` 层禁止 import three / react / zustand（`pnpm check:deps` + Biome 会拦）。
6. **预设句子 token id**：本机无 Python transformers，用 Node 读 Qwen3 `tokenizer.json`（需下载一次，约 11 MB，不入库）离线生成 S≈6–8 的中文短句 id，作为 `[S]` 数据写进 `src/sim/model/presets.ts` 并替换测试里的占位 id（当前 `PLACEHOLDER_IDS` 只是词表内的合法 id，不代表任何句子）。
7. 之后依次：`src/timeline` 播放引擎（zustand store + 单个 `<Clock/>` 推进瞬态 `progress.t` + 快捷键 + URL `?ch=&step=&layer=&nofx=1` + reduced-motion，Spike C；Worker 内跑 `buildLayerTimeline` 并计时）→ `viz3d`（Spike A 标签清晰度、Spike B TensorGrid 全幅纹理平面 + InstancedMesh 放大窗口、CameraDirector、MatMulRig、FlowPacket、KVBlockGrid、NpuModule910B + AnchorRegistry、双层分屏）→ 内容管线与 MDX 组件（`content/sources.ts` 应 re-export `sim/model/claims.ts`，不要再抄一份）→ 章节页布局 → `03` 章正文 + `claims.md` → 模型工作台 v1 → Playwright 截图与标签断言。

每完成一步：跑相关校验 → `git commit` → 按 Why / What / Evidence / Tradeoff / Open Questions 汇报；只有拿到实际命令输出或测试结果才能说"完成"。UI 改动必须在浏览器里实际打开验证，并把关键截图发给用户目测。

## 六、容易踩的坑

- 权重形状约定 `[in, out]`（`y = x·W`），与 HF checkpoint 的 `[out, in]` 相反，写文案时要说明。
- `sim/` 层禁止 import three / react / zustand；`timeline/` 禁止 import three。违反会被 `pnpm check:deps` 与 Biome 拦下。
- Tailwind v4 用 `@theme`（`src/design/tokens.css`），Biome 需 `css.parser.tailwindDirectives: true`（已配）。
- 大批量写文件不要用 bash heredoc 串联（历史上失败过），逐个文件写。
- 高亮 `Highlight.rows/cols` 在带 `head` 的三维张量上指头内二维（`[n_q,S,S_k]` 的 rows 是 S），validate 已按 dims 里的 `n_q`/`n_kv` 识别头维；新张量的头维必须用这两个名字。
- RMSNorm 后 RMS 不是恰好 1：词嵌入数值小（σ=0.02）时 ε=1e-6 占 mean(x²) 的 0.25%，RMS≈0.99875。写文案和断言都要按 `sqrt(ms/(ms+ε))`。
- 因果 mask 的 −1e30 存进 Float32 是 `Math.fround(-1e30)`，断言别用字面量。
- `ropeInplace` / `causalMaskInplace` 原地修改，`splitHeads` / `mergeHeads` 是共享 data 的视图：录制前要 `clone`，否则前一步的张量会被改掉。
- `tsconfig.*.tsbuildinfo` 被 git 跟踪，每次 tsc 都会改动；提交时不要顺手带上（建议用户决定是否 `git rm --cached` + 加 .gitignore）。
