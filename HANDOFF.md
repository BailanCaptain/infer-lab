# 交接说明（写于 2026-09-06 03:40，更新于 2026-09-06 viz3d 地基（Spike A/B）完成后，供新会话直接接手）

新会话请**先读本文件，再读下面三份**，然后从「五、下一步」**第 8 条的剩余项**（第 1–7 条与第 8 条的 Spike A/B 已完成）开始动手，不要重新讨论方案。播放/Worker 入口：`src/timeline`（barrel `index.ts`）；3D 图元入口 `src/viz3d`（barrel `index.ts`），Canvas 内只放一个 `<Clock/>`；默认句子用 `getTokenPreset()`。

## 当前进度速览（2026-09-06，同步到 `git log` 最新提交「viz3d 地基」）

- **整体仍在 M1**：底层计算、硬件映射、真实预设句、播放引擎与 Worker 已接通，完整样板章和模型工作台尚未交付。下述第 1–7 步指本文件第五节的执行顺序，不等同于总体计划中的 Spike A/B/C 编号。
- **已完成第 1–7 步**：模型解析、参数/KV 分析、单层前向与数值验证、Node 性能 Spike、硬件映射、真实预设 token id、**播放引擎 + Worker（Spike C/D 浏览器验收通过）**。
- **第 8 步已完成前半（Spike A + Spike B）**：`src/viz3d/` 有了尺度/取样/色阶纯函数、`Label`（troika SDF）+ 标签边界注册表、`TensorGrid`（全幅 R32F 纹理平面 + InstancedMesh 放大窗口 + 标签车道）、`CameraRig`；验收页 `#/dev/spike-ab`，Playwright `tests/spike-ab.spec.ts` 2/2 通过。**尚未做**：`camera/views.ts` + CameraDirector、MatMulRig、FlowPacket、KVBlockGrid、NpuModule910B + AnchorRegistry、双层分屏、后期（Bloom/SMAA）。`/dev/spike-*` 都是验收页，不是章节页。
- **尚未开始的界面工作**：3D 双层可视化图元、内容管线与 03 章正文、章节页布局、工作台界面。
- **最近代码验证**：2026-09-06，`pnpm check` **146/146 测试通过**（新增 plane 18、scale 24）；`pnpm build` 通过；`pnpm test:e2e` **5/5 通过**：Spike A 正面机位 70 个标签两两不相交且全在画布内；Spike B 压力模式 5120 格 2 s 内 106–121 帧（SwiftShader 软渲染），21 步换步实例缓冲重写最大 **0.50 ms**（< 2 ms）；Spike C 0.6B 190–218 ms、8B 2146–2236 ms、播放 3.2 s 200 帧 / 4 commit / TweenBar 0 渲染。截图已发用户。
- 两个已跟踪的 tsbuildinfo 文件仍是工作区噪音，未提交。
- **待用户目测**：micro 档标签（0.11 世界单位）在 1× DPR 下约 9–10 px，处于 DESIGN.md 字阶地板；若嫌小，改 `labels/Label.tsx` 的 `LABEL_SIZE.micro`，标签车道高度在 `primitives/layout.ts` 同步调。

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
- `9096ba9` 完成第 6 步，新增 `scripts/gen-preset-tokens.ts`、`src/sim/model/presets{.ts,.tokens.json,.test.ts}`、证据 S02；测试与 benchmark 改用真实预设句。
- `ca0500b` **最新代码基线**：完成第 7 步，新增 `src/timeline/`（store、progress、keyboard、url、reducedMotion、load、worker/）、`src/viz3d/Clock.tsx`、`src/app/pages/dev/SpikeCPage.tsx`（路由 `#/dev/spike-c`）、`playwright.config.ts`、`tests/spike-c.spec.ts`。其后的纯交接文档提交不改变代码进度。

**`src/timeline/`（播放引擎，禁 three/R3F；30 个单测）**：

| 文件 | 内容 |
|---|---|
| `store.ts` | zustand `usePlayback`：`timeline/status/loadMeta/stepIndex/playing/speed/layer/reducedMotion/nofx/userCameraOverride/cameraResetSeq` + actions `load/unload/play/pause/toggle/next/prev/first/last/seek(序号|id)/setSpeed/stepSpeed/setLayer/setNofx/resetCamera`；`selectStep/selectStepCount/selectNoMotion`；`resetPlaybackStore()`。末步 `play` 从头开始，末步 `next` 自动暂停 |
| `progress.ts` | 瞬态 `progress{t,stepIndex,prevStepIndex,holdMs}`（不进 store）；`advance(dtMs)`：过渡 `STEP_TWEEN_MS=900` → 停留 `STEP_HOLD_MS=700` → `next()`；倍速在此相乘；无动效时 t 直接 1；模块内订阅 store 换步重置 |
| `keyboard.ts` | `handlePlaybackKey(e, actions)` 纯函数 + `installPlaybackKeys()`；Space/←/→/Home/End/Esc/[ ]；输入控件与组合键忽略 |
| `url.ts` | `parseLabQuery/formatLabQuery/readHashQuery/withHashQuery/replaceHashQuery` + `useLabUrlSync(chapterId)`。**写 URL 走 `history.replaceState`，不经 react-router**（`useSearchParams` 会让整页多 commit 一次） |
| `reducedMotion.ts` | `watchReducedMotion()` / `useReducedMotionWatcher()`：matchMedia → `store.reducedMotion` |
| `worker/protocol.ts` | `TimelineRequest{modelId,presetId,layerIndex?,chapterId?}`、消息类型、`requestKey` |
| `worker/handle.ts` | `handleTimelineMessage`（Worker 内与测试共用）、`collectTransferables`（去重 Float32Array buffer 零拷贝转移） |
| `worker/timeline.worker.ts` | module worker 入口 |
| `worker/client.ts` | `createTimelineClient(spawn)`：按 key 缓存 Promise、id 配对、`transferMs`= 往返 − buildMs；`createDefaultTimelineClient()` 用 `new Worker(new URL(...), {type:"module"})` |
| `load.ts` | `loadTimelineIntoStore(client, req)`：loading → ready/error，后发请求覆盖先发 |
| `index.ts` | barrel，上层只从这里 import |

`src/app/PlaybackBar.tsx`：播放条唯一实现（从 SpikeCPage 抽出，`data-testid` 不变），两个 dev 页共用。`src/app/pages/dev/SpikeCPage.tsx`：Worker 加载 + 计数器（`window.__spikeC`、`window.__labReady`）。`src/app/pages/dev/SpikeABPage.tsx`（`#/dev/spike-ab`）：四机位（相机距离由 `gridLayout` 包围盒算出，不是手填数字）、三种窗口模式（6×12 / 值模式 8×8 / 压力 64×80）、A/B/输出槽位切换；`window.__spikeAB{frames,stepChanges,lastCostMs,maxCostMs}`、`window.__labels()`。

**`src/viz3d/`（R3F 图元；可 import sim 与 timeline）**：

| 文件 | 内容 |
|---|---|
| `Clock.tsx` | Canvas 内唯一 `useFrame` 驱动，`advance(min(delta,0.1)*1000)` |
| `theme.ts` | `vizTheme()`：从 `tokens.css` 的 CSS 变量读色（含新增 `--color-viz-neg/pos/zero/mask/grid`），组件禁裸色 |
| `scale.ts`（+test） | 纯函数：`displayAspect`（a^0.75，超过拐点 12 后对数增长，单调不并值）、`planeSize`、`sampleAxis`（≤1024 stride 下采样）、`robustScale`（忽略 ≥1e29 哨兵、取 99.5 分位）、`windowRect`/`focusCenter`（对准**第一个**高亮，不取均值）、`fmtCell`/`fmtAspect` |
| `materials/valueColor.ts` | 数值→颜色的唯一 GLSL 定义：负青 / 正琥珀 / 0 近黑，亮度 ∝ (\|v\|/scale)^0.7，哨兵单独出掩码色 |
| `materials/planeMaterial.ts` | 全幅平面 ShaderMaterial（GLSL3）：R32F 纹理、格线（仅逐格对应且 ≥3px）、高亮行列带（最多 8 行 8 列，格数多时加宽到可见）、取景框；`uHiT` 每帧 = progress.t |
| `materials/cellMaterial.ts` | 放大窗口 InstancedMesh 材质：`aVal0/aVal1/aHi0/aHi1` 逐实例，`uT` 插值在 GPU；非高亮缩放 `DIM_SCALE=0.78`（不用透明度），本步无焦点时 `uDimScale=1` |
| `labels/Label.tsx` | drei `<Text>` 封装：子集字体 `public/fonts/notosc-3d.woff`、`sdfGlyphSize=128`（**必须 2 的幂**）、深色描边、`depthTest=false`、三档字号 `LABEL_SIZE` |
| `labels/registry.ts` / `LabelProbe.tsx` | 标签屏幕 AABB 注册表 + `window.__labels()` 探针（dev） |
| `primitives/layout.ts` | `gridLayout`：平面/窗口/车道位置与包围盒；`frameDistance`：按包围盒算相机距离。图元与相机共用这一份 |
| `primitives/TensorPlane.tsx` | 全幅平面（稠密张量下采样纹理；权重走 96×96 thumb）+ 多头张量后方薄片堆 |
| `primitives/CellWindow.tsx` | 放大窗口：容量 5120，换步只重写缓冲并回报耗时；格 ≥0.34 且 ≤64 格时标真值 |
| `primitives/TensorGrid.tsx` | 组合：平面 + 引线 + 窗口 + 8 条车道标签（标题、真实 shape、行/列范围与 ⋯、切片「头 i/n · K\|V=k」、行维/列维、压缩比例与采样说明、掩码说明）；`role==="input"` 的 token id 按分类量处理 |
| `camera/CameraRig.tsx` | `maath/easing.damp3` 平滑到 `pose{pos,target}`，`instant` 时瞬移；CameraDirector 待做 |
| `index.ts` | barrel |

`src/sim/timeline/plane.ts`（+test）：**张量 → 二维视图的唯一规则**（`HEAD_DIMS`、`headAxis`、`planeAxes`、`planeView`），`validate.ts` 的高亮校验已改为复用它；四维 `L0.kv.block` 通过 `picks` 选 K/V 切片。

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
- 命令：`pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm check:deps` / `pnpm check:content` / `pnpm check`（全跑）/ `pnpm dev` / `pnpm build` / `pnpm bench:forward` / `pnpm gen:presets [--write]` / `pnpm test:e2e`（Playwright，自动起 `pnpm dev --port 4173`；截图落在 `test-results/`）。
- Playwright 1.63 需要 chromium build 1243，已用 `pnpm exec playwright install chromium` 装好（2026-09-06）；headless 走 SwiftShader（`playwright.config.ts` 的 launch args），WebGL 可用。
- 3D 文字：`troika-three-text` 0.52.5 由 drei 间接带入（drei 的直接依赖），用 drei 的 `<Text>` 即可，不必单独安装。字体子集 `public/fonts/notosc-3d.woff` 已生成；troika 支持 ttf/otf/**woff**，不支持 woff2。`pnpm gen:font` 扫描 `src/content`、`src/sim`、`src/viz3d`、`src/timeline` 里的 CJK 字符，新增 3D 标签文案后要重跑。

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

7. ~~**`src/timeline` 播放引擎 + Worker**~~ 已完成（`ca0500b`）。契约：store 只放离散状态；`progress.t` 瞬态；Canvas 内唯一 `<Clock/>`；3D 图元在各自 `useFrame` 读 `progress.t`/`prevStepIndex` 写 uniform，换步用 `useLayoutEffect([stepIndex])` 一次重写 buffer；图元组件要 `memo`，不订阅 store 就不会重渲染。证据：30 个单测；Playwright 3/3：0.6B Worker 构建 199–232 ms（<500）、8B 2400–2968 ms（<5000，构建期主线程帧数继续增长）；播放 3.2 s 200 帧 / 4 commit / TweenBar 0 渲染；深链接 `?step=L0.attn.softmax&layer=hardware&nofx=1` 直达且 t=1；快捷键与 URL 写回验证通过。**未做**：IndexedDB 缓存（现为内存 Promise 缓存，接口不变可后补）；相机接管只留了 `userCameraOverride/cameraResetSeq` 字段，CameraDirector 在第 8 步。

待做：
8. ~~Spike A 标签清晰度、Spike B TensorGrid 全幅纹理平面 + InstancedMesh 放大窗口~~（已完成，见第三节 `src/viz3d/` 表与 `tests/spike-ab.spec.ts`）→ 依次：`camera/views.ts`（8 个 view 预设）+ CameraDirector（读 `step.camera.view`，`userCameraOverride` 接 OrbitControls）、MatMulRig（A 左 / B 上 / C 右下，复用 TensorGrid）、FlowPacket、KVBlockGrid（现在 KV 块用 TensorGrid 切片显示，不是终态）、NpuModule910B + AnchorRegistry、双层分屏、EffectComposer（Bloom 阈值 0.85，标签亮度 <0.8）→ 内容管线与 MDX 组件（`content/sources.ts` re-export 前向与硬件 claims，不另抄一份）→ 章节页布局（把 `SpikeCPage` 的播放条抽成 `app/PlaybackBar`）→ `03` 章正文 + `claims.md` → 模型工作台 v1 → Playwright 截图与标签断言（`tests/` 已有骨架与 `window.__labReady` 约定）。

   **开工前已核实的事实（2026-09-06 实际跑 `buildHardwareTimeline(qwen3-0.6b, kv-cache)` 打印所得，不要再猜）**：

   - **`step.camera.view` 只有 8 个取值**：`embed`、`norm`、`matmul`、`heads`、`attention`、`mlp`、`residual`、`kv`。`camera/views.ts` 只需覆盖这 8 个预设，不必按 step id 一一配。
   - **`step.beats` 只出现在 7 个 matmul 步**（q/k/v/o/gate/up/down），固定为 `0 读权重列 → 0.3 乘加 → 0.85 写回`；其余 14 步没有 beats，播放条的 beat 刻度要允许为空。
   - **`op.kind` 分布**：matmul×7、rmsnorm×3、add×2，gather/rope/scores/mask/softmax/pv/merge/silu_mul/kv_write 各 1。
   - **高亮形态**：激活基本是 `rows`（1 行）；权重是 `cols`（1 列）；matmul 输出是 `cells`（1 格）；`mask` 步是 `cells`（15 格）；`embed.gather` 对词表用 `rows`（6 行）。头相关步骤带 `head`，此时 `rows/cols` 指头内二维。
   - **张量数据形态**：激活/分数/KV 全是 dense `Float32Array`；**7 个权重只有 96×96 的 `thumb`，没有全量数据**，全幅纹理平面必须走 `thumb`，放大窗口取值走 `weightAt(lazy, i, j)`。
   - **真实形状**（Qwen3-0.6B，S=6）：`L0.x_in [6,1024]`、`q [6,2048]`、`k/v [6,1024]`、头张量 `[6,16,128]` 与 `[6,8,128]`、`scores/masked/probs [16,6,6]`（`n_q,S,S_k`，headStack）、`mlp.gate/up/act [6,3072]`、权重 `[1024,2048]` / `[1024,1024]` / `[1024,3072]` / `[3072,1024]` / 词表 `[151936,1024]`、`L0.kv.block [6,2,8,128]`（四维 `S,K|V,n_kv,d_h`，TensorGrid 处理不了，要么专门做 KVBlockGrid，要么先按 K/V 拆两片）。
   - 极扁平面是常态：`[6,1024]` 的真实行列比 170:1，`[6,3072]` 是 512:1。按真实比例画会细到看不见，需要在组件里对显示纵横比做压缩（如 `aspect^0.75` 并设下限），**同时把真实 shape 打在标签上**，压缩比例只是显示手段，必须在文案里说明。

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
- Tailwind v4 冲突类按样式表顺序而非 class 顺序取胜：`bg-surface-elevated` 会盖掉后写的 `bg-accent`。基础类不要带背景色，按钮变体各自加（见 `SpikeCPage` 的 `btnBase/btn/btnPrimary`）。
- 不要用 react-router 的 `useSearchParams` 写播放 URL：每次写都让整页重渲染。用 `timeline/url.ts` 的 `replaceHashQuery`。
- R3F 9 + three 0.185 在控制台打 `THREE.Clock: This module has been deprecated` 警告，来自 R3F 内部，不是本项目代码，忽略即可。
- **`L0.attn.masked` 的 `absMax` 是 1e30**（因果 mask 的 −1e30 参与了统计）。着色若直接用 `|v| / absMax`，除被掩码格外整张图全是 0 色。TensorGrid 要么按分位数定标，要么把 ≤ −1e29 的哨兵值单独渲染成「已掩码」样式，不要参与色阶。`ids` 的 `absMax` 是 113272（token id 数值），也不能当作数值场着色。
- 预设句里选的词都是词表内完整 UTF-8 片段的 token；若新句子有字被拆成半个 UTF-8 字节序列，脚本会直接报错，换一句而不是存乱码。
- **troika `sdfGlyphSize` 必须是 2 的幂**（64/128）。填 96 时所有字形渲染成实心方块，数值断言全过、只有截图能看出来——UI 验收必须看图。
- Playwright 每次运行会清空 `test-results/`，跑第二个 spec 会删掉第一个的截图；要看图就把两个 spec 一起跑或先复制走。`playwright.config.ts` 已设 `workers: 1`：两个浏览器同时跑时 8B Worker 构建从 2.2 s 变成 6.1 s，帧数断言也会被拖垮。
- `pnpm gen:font` 现在只扫 ts/tsx 的**字符串**（注释已剥掉），子集 270 KB / 820 字；仍然包含 `forwardLayer.ts` 的 brief/detail 叙述文案（这些走 DOM，不进 3D）。要再瘦身需要把 3D 标签用字与 DOM 文案分开标注，属于后续内容管线的事。
- `TensorGrid` 的 `window`/`box` prop 传字面量对象会让 `CellWindow` 每次父组件渲染都重写实例缓冲；页面里要 `useMemo`。换步不要给 TensorGrid 换 `key`（会把 5120 容量的 InstancedMesh 整个重建，耗时数字就不真实了）。
- 全幅平面上的高亮列带按「格数 × 0.004、至少半格」加宽（1024 列时约 4 格宽），否则一列宽只有半个像素；放大窗口里的高亮是逐格真值。文案里目前没写这条加宽，做章节页时若要严谨可加。
