# 交接说明（写于 2026-09-06 03:40，更新于 2026-09-06 预设 token 接通后，供新会话直接接手）

新会话请**先读本文件，再读下面三份**，然后从「五、下一步」**第 7 条**（第 1–6 条已完成）开始动手，不要重新讨论方案。Worker/播放入口应调用 `src/sim/buildTimeline.ts` 的 `buildHardwareTimeline`，默认句子用 `src/sim/model/presets.ts` 的 `getTokenPreset()`。

## 当前进度速览（2026-09-06，同步到代码提交 `9096ba9`）

- **整体仍在 M1**：底层模型计算、硬件映射与真实预设句已接通，完整样板章和模型工作台尚未交付。下述第 1–6 步指本文件第五节的执行顺序，不等同于总体计划中的 Spike A/B/C 编号。
- **已完成第 1–6 步**：模型解析、参数/KV 分析、单层前向与数值验证、Node 性能 Spike、硬件 spec/驻留/搬运/证据校验、真实中文预设 token id。默认句「大模型推理需要显存」S=6，可生成 21 步双层时间线。
- **第 7 步尚未开始**：`src/timeline` 播放引擎与 Worker 尚不存在；页面仍是首页空壳。
- **尚未开始的界面工作**：Worker 与播放引擎、3D 双层可视化、内容管线与 03 章正文、工作台界面、Playwright 截图/交互验收。
- **最近代码验证**：2026-09-06，`pnpm check` **77/77 测试通过**，类型/Lint/依赖方向通过；`pnpm build` 通过；`pnpm bench:forward` 0.6B 最快 139 ms、8B 最快 1599 ms。内容校验因无章节跳过；Biome 两条既有配置提示未处理。浏览器 Worker 性能尚未验证。
- **代码基线固定为 `9096ba9`**。两个已跟踪的 tsbuildinfo 文件仍是工作区噪音，未提交。

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
- `829ba05` **前向计算基线**：`src/sim/model/`（单层前向 + 证据注册表 + 测试）、`validate.ts` 头维高亮修复、`scripts/bench-forward.ts`。`pnpm check` 全通过（51 个测试）。
- `829ba05` 到 `38f5795` 之间仅改本文件；`d53348a` 新增硬件证据注册表。
- `51adac4` 完成第 5 步，包含 `hardware/spec.ts`、`residencyRules.ts`、`mapResidency.ts`、硬件校验与测试、`sim/buildTimeline.ts` 双层入口；修正 id 字节统计。
- `9096ba9` **最新代码基线**：完成第 6 步，新增 `scripts/gen-preset-tokens.ts`、`src/sim/model/presets{.ts,.tokens.json,.test.ts}`、证据 S02；测试与 benchmark 改用真实预设句。其后的纯交接文档提交不改变代码进度。

除本次交接文档同步外，工作区仅有 `tsconfig.app.tsbuildinfo` / `tsconfig.node.tsbuildinfo` 改动；tsc 会更新它们，本轮没有提交（处理办法见「六、容易踩的坑」最后一条）。

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
| `model/claims.ts` | `FORWARD_CLAIMS`：S01–S02、C01–C09（transformers **v4.51.3** `modeling_qwen3.py` 行号，2026-09-06 实际打开核验）、D01–D03、A01–A03；`assertClaimIds`。S02 = 预设 token id 来源，`embed.gather` 引用 |
| `model/presets.tokens.json` | **生成文件，勿手改**：tokenizer 来源（repo / revision `c1899de2` / SHA-256 `aeb13307…`）+ 三句预设 `kv-cache`「大模型推理需要显存」S=6、`ascend`「昇腾芯片正在计算注意力」S=6、`hello`「你好，世界！今天天气怎么样」S=7；`tokens` 是每个 id 的 UTF-8 片段，拼回等于原文 |
| `model/presets.ts` | `TokenPreset`、`TOKEN_PRESETS`、`TOKENIZER_SOURCE`、`DEFAULT_TOKEN_PRESET_ID = "kv-cache"`、`getTokenPreset(id?)`；结构兼容 `Timeline["preset"]` |
| `model/presets.test.ts` | 5 个测试：来源字段格式、默认/唯一/未知 id、S∈[6,8] 与拼回原文、id 均为普通 BPE 词（< 151643）且在三个预设模型词表内、与 transformers.js 对拍过的 golden id |
| `model/forwardLayer.ts` | `forwardLayer(spec, layerIdx, ids, rec, {positions?, xIn?})`：Qwen3 dense 单层，录 21 步（qkNorm=false 为 20 步）；`buildLayerTimeline(spec, preset, {layerIndex?, chapterId?})` 构造期跑 `assertValid` + `assertClaimIds`。MoE / MLA / attention_bias 抛错（M2） |
| `model/forwardLayer.test.ts` | ① H=32 缩小 spec 与独立 Float64 参考实现 21 个张量逐元素 <1e-5；② Qwen3-0.6B 真实尺寸不变量（形状链、softmax 行和、RMSNorm、GQA g(h)=⌊h/2⌋、KV 字节 = `analyzeKvPerToken`×S、确定性）；③ 步骤顺序、证据注册、`validateTimeline` 无 issue；④ 变体（MHA、无 qkNorm、xIn 串两层、错误输入） |
| `hardware/claims.ts` | 15 条硬件声明（5 S、1 D、9 A），含原件 URL、页号、核验日期、SHA-256；未知物理规格不填数字 |
| `hardware/spec.ts` | `NpuSpec` / `NPU_910B`，概念部件、锚点、路径、区域；共享 `locationAnchor` / `tensorHome` 与 spec 校验 |
| `hardware/residencyRules.ts` | 13 种 OpKind 的教学规则、证据与解释；`stepIO` 读取完整 lineage，覆盖双路 Q/K |
| `hardware/mapResidency.ts` | `mapResidency(step, spec, tensors)` / `mapTimelineResidency(timeline, spec?)`，纯函数填充硬件信息，保留模型数值 |
| `hardware/validate.ts` | 驻留、路径连续性、输入输出完整性、字节、活跃单元、合并证据校验；由 `validateTimeline` 调用 |
| `hardware/residency.test.ts` | 20 个测试：完整映射、特殊步骤、变体、幂等性、自定义槽位、structuredClone 与损坏数据拒绝 |
| `buildTimeline.ts` | **后续 Worker/播放器入口** `buildHardwareTimeline(model, preset, {layerIndex?, chapterId?, hardwareSpec?})`；buildMs 包含前向、映射与校验 |

`scripts/bench-forward.ts`（`pnpm bench:forward`）用默认预设句（S=6）并计入硬件映射与校验：**Qwen3-0.6B 三次 183/147/139 ms，Qwen3-8B 三次 1599/1644/1656 ms**（2026-09-06，本机 Node），均为 21 步、35 张量，在验收线内（0.5 s / 5 s）。这是 JS 仿真构建耗时，不是 NPU 实测；浏览器 Worker 尚未计时。

`scripts/gen-preset-tokens.ts`（`pnpm gen:presets [--write]`）：自实现 byte-level BPE（NFC → 官方正则预切分 → 字节映射 → 按 merge rank 合并 → 查表），读取 `tools/tokenizer/qwen3-tokenizer.json`（缺失时按固定 revision 下载并校验 SHA-256；已 gitignore）。三句预设 id 已与 `@huggingface/transformers` 3.x（暂存目录安装，不进项目依赖）逐 id 对拍一致，且 `decode(ids)` 等于原文。要加句子改脚本里的 `SENTENCES` 再 `--write`，脚本会自动跑 Biome 格式化。

步骤 id（固定，可进 URL）：`embed.gather → L0.ln1 → L0.attn.q → L0.attn.k → L0.attn.v → L0.attn.qknorm → L0.attn.rope → L0.attn.scores → L0.attn.mask → L0.attn.softmax → L0.attn.pv → L0.attn.merge → L0.attn.o → L0.res1 → L0.ln2 → L0.mlp.gate → L0.mlp.up → L0.mlp.act → L0.mlp.down → L0.res2 → L0.kv.write`。

## 四、环境事实

- Windows 11 + PowerShell；Node v24.14.0；pnpm 10.32.1；项目已 `git init`，当前 HEAD 以 `git log` 为准。
- 本机 **没有** Python `transformers` / `tokenizers`（只有 numpy 1.21.5）→ 预设句子的 token id 已用 Node 加载 Qwen3 `tokenizer.json` 离线生成（`pnpm gen:presets`），结果作为 `[S02]` 数据随预设打包。
- 命令：`pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm check:deps` / `pnpm check:content` / `pnpm check`（全跑）/ `pnpm dev` / `pnpm build` / `pnpm bench:forward` / `pnpm gen:presets [--write]`。

## 五、下一步（M1，按序；对应计划 §2.10）

已完成（有测试/命令输出为证）：
1. ~~验证 sim 层~~ `pnpm check` 全通过；参数量 golden 通过。
2. ~~`src/sim/model/forwardLayer.ts`~~ 21 步，每步有中文 brief/detail/formula、lineage、evidence、terms、highlight。
3. ~~测试~~ 前向基线为 51 个测试；完成第 5 步后总计 **72 个测试通过**（新增 20 个硬件用例与 1 个 id 字节回归）。
4. ~~Spike D~~ Node 版达标（见上）；**浏览器 Worker 内计时留到播放引擎接上 Worker 时顺手做**。

5. ~~**`src/sim/hardware/`**~~ 已实现 `NpuSpec`、13 种 OpKind 的驻留规则与 `mapResidency(step, spec, tensors)`。第三参数提供 `TensorRecord.bytes`；组合入口 `buildHardwareTimeline(model, preset, options)` 生成双层时间线。

   **当前状态（2026-09-06）：第 5 步代码与验收完成，未做 UI。** `buildLayerTimeline` 仍为纯模型入口；`mapTimelineResidency` 返回新步骤、保留张量数据引用，并附加 `Timeline.hardwareSpec`。该字段存在时 `validateTimeline` 强制硬件完整性；有硬件数据却无 spec 也报错。

   实现契约：
   - `spec.ts`：部件、坐标、锚点、搬运路径、单元引用、区域槽位；`locationAnchor` 与 `tensorHome` 是共享映射。HBM/HCCS 物理数量保持 null，四个 HBM 槽和七个 HCCS 邻居锚点均为概念表示。
   - `hardware.residency` 表示主要后备存储，**不是**步内所有副本或整个张量片上驻留。Cube 输入落在 L0A/L0B，结果从 L0C 经 FixPipe 写回；Vector 使用 UB。计算单元不是存储落点。
   - Q/K 归一化和 RoPE 使用完整 lineage，双路均映射；scores 的缩放显式走 Vector；merge 共享数据视图零搬运，仅 Host 元数据操作；Embedding 只搬选中行，用输出 id 表示该数据量，禁止搬整张词表；KV 写入逻辑 kv 区，单 NPU 步不启用 HCCS。
   - token id 按 int32 教学约定计四字节（HW-A09），不再跟随模型 bf16 两字节。修复前稳定失败：两个 id 期望 8 B、实际 4 B；修复后回归测试通过。JS Float32 容器与设备 dtype 无关。
   - 硬件校验覆盖主要驻留、路径合法/连续、输入输出完整、字节、证据及活跃单元；构建后 `structuredClone` 仍可校验，alias 保留，适合下一阶段 Worker。

   本轮证据结论（原件 URL、PDF 页号、核验日期与 SHA-256 均在 claims.ts）：
   - CANN 8.1.RC1.alpha002 官方 PDF，文档版本 01（实际原件日期 2025-08-26），阅读器 p31–35 已下载、抽取并逐页渲染核对。确认 AIC/AIV 分离、各自 Scalar、Cube 的 L1/L0 路径、Vector 的 UB 路径及核外 L2。注意 p31 上半图是**耦合**架构；A2 应用 p32 的**分离**架构图。不要复制文档中的具体执行单元数量（p32 图含 FixPipe，文字枚举却未计入）。
   - 华为 R24.0（25H2）彩页 p3 原页确认 Atlas 800I A2 八模组 HCCS 全互联、使用 HBM。每卡七个邻居是拓扑推导 `[HW-D01]`，不是物理 lane 数。搜索命中的 Atlas 200I A2 边缘产品 npu-smi 文档不适用于 800I A2，不能借其 lane 编号证明目标规格。
   - **尚未直接证实**：910B 子型号 HBM 堆叠数、物理 HCCS lane 数/端口编号、Host 到目标模组的 PCIe 接线/代际/宽度。彩页有容量/算力占位值，PCIe 字段仅指服务器扩展插槽。禁止据此填 NPU 规格。
   - 注册表共 15 条（5 S、1 D、9 A），使用 `HW-` 前缀；Claim 类型复用、证据数据独立。新增 A07 特殊搬运语义、A08 概念几何/资源代表、A09 token id 计量。前向与硬件证据在硬件校验中统一检查，后续 sources 应 re-export 两表。
   - 本轮验证：全量检查与构建通过；20 个硬件测试 + 1 个 id 字节回归加入原有 51 个测试。覆盖 21 步/20 步变体、非零层、不同槽位、幂等性、不改数值、序列化及损坏硬件拒绝。Node 性能见上。未改 UI，未做浏览器验收；Worker 实测仍待做。

6. ~~**预设句子 token id**~~ 已完成（`9096ba9`）：`scripts/gen-preset-tokens.ts` 用 Node 读 Qwen3 官方 `tokenizer.json`（revision `c1899de2`，SHA-256 `aeb13307…`，约 11 MB，不入库）离线生成三句 S=6/6/7 的中文预设，写入 `src/sim/model/presets.tokens.json`，由 `presets.ts` 导出；`forwardLayer.test.ts` 与 `bench-forward.ts` 的占位 id 已替换为 `getTokenPreset()`。`residency.test.ts` 与 id 字节回归里的 `[1,2]` 是刻意的最小用例，保留。证据：三句 id 与 `@huggingface/transformers` 3.x 逐 id 一致、`decode(ids)` 等于原文；`pnpm check` 77/77 通过；`pnpm build` 通过。**尚未做**：预设仍是纯文本，没有套 chat 模板（`<|im_start|>` 等特殊 token 留给后续章节讲）；三份预设模型共用词表这一点靠 HF API 的 LFS SHA-256 核验，未逐个下载三份文件。

待做：
7. 依次：`src/timeline` 播放引擎（zustand store + 单个 `<Clock/>` 推进瞬态 `progress.t` + 快捷键 + URL `?ch=&step=&layer=&nofx=1` + reduced-motion，Spike C；Worker 内跑 `buildHardwareTimeline` 并计时）→ `viz3d`（Spike A 标签清晰度、Spike B TensorGrid 全幅纹理平面 + InstancedMesh 放大窗口、CameraDirector、MatMulRig、FlowPacket、KVBlockGrid、NpuModule910B + AnchorRegistry、双层分屏）→ 内容管线与 MDX 组件（`content/sources.ts` re-export 前向与硬件 claims，不另抄一份）→ 章节页布局 → `03` 章正文 + `claims.md` → 模型工作台 v1 → Playwright 截图与标签断言。

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
- `src/sim/model/presets.tokens.json` 是生成文件：改句子只改 `scripts/gen-preset-tokens.ts` 的 `SENTENCES`，然后 `pnpm gen:presets --write`；改完要同步 `presets.test.ts` 的 golden id，并用 transformers.js 复核（暂存目录 `npm i @huggingface/transformers@3`，不进项目依赖）。`tools/tokenizer/*.json` 已 gitignore，勿提交 11 MB 词表。
- 预设句里选的词都是词表内完整 UTF-8 片段的 token；若新句子有字被拆成半个 UTF-8 字节序列，脚本会直接报错，换一句而不是存乱码。
