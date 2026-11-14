# infer-lab 总体计划（大模型推理交互式教学平台 · vLLM-Ascend 主线）

## 2026-10-21 推理分析与工程实践补全

在现有知识库与“性能与工程优化”分组内补齐分析和实践能力，保留学习者与从业者两种入口，复用已有机制页。四级顺序为：测量与诊断基础 → 生产系统 → 新模型与推理策略 → 昇腾 950 架构映射。具体页面职责、复用范围、学习路线、任务和验收统一记录在[知识补全计划](docs/superpowers/plans/2026-10-21-inference-knowledge-completion.md)，本处不复制任务清单。

本轮先保存计划并交付第一优先级的一个贯穿样例，后续任务不视为已经完成或全部授权。

## 2026-10-14 重启：知识库就是主章节（当前决定）

用户明确推翻旧方案，并选择「知识库就是主章节：按主题目录直接阅读完整内容」。主站以 `wiki/` 的完整正文和 `src/content/wiki/toc.ts` 的主题编排为唯一内容入口，不再另写 22 章课程正文。阅读页保留完整解释、图、算例、版本与来源；搜索与问答沿用同一份知识内容。同日首页要求再次明确为「只有一个按钮，进入整合后的网页」：根路径和 `/#/home` 使用城市开场页，只保留一个「开始阅读」按钮进入 `/#/wiki`；首页不再显示目录、全站导航或环游控制。主题、模型和硬件入口在主站中提供。

本决定取代下方的旧课程边界、先做第 03 章、课程与 Wiki 分离、固定母版和逐章 3D 要求。主站重新设计导航、阅读页面与图文层级；3D 只作为独立辅助探索。旧课程和资产留作历史材料及旧链接兼容，不作为新站的设计或内容验收标准。

验收以首页只有一个阅读入口、按钮进入知识主题、首页与正文往返可用、正文完整、目录搜索与跨页链接可用、桌面和手机实际阅读、来源与问答不受损为准。首页场景加载与失败不能阻止进入主站。视觉实现待用户实际评价，自动检查不代表审美认可。

## 2026-10-11 模型计算层的章节边界（本轮优先）

用户确认：先完成第 03 章，再推广到整个模型计算层。主章节讲通用基础，母版提供可拆装的矩阵、材质和计算部件，知识库作为编写依据与独立查询入口。保留用户认可的 RMS 外观与交互；本轮不改其余五章正文。

| 章节 | 本章要让读者走通的过程 | 接收与交付 | 留给后续的细节 |
| --- | --- | --- | --- |
| 01 Token、Embedding 与向量 | 文字分为编号，编号查表取出位置向量 | 从文字到隐藏矩阵 X | 向量怎样参与运算交给 02 |
| 02 矩阵乘法与张量形状 | 一个点积扩成矩阵投影，读懂输入、权重与输出形状 | 能解释 XW 的逐项计算与维度约束 | 完整层的组织交给 03；芯片搬运在 07 展开 |
| 03 一层 Transformer 怎样更新表示 | 保留 X → RMSNorm → 注意力 → 第一次相加 → RMSNorm → 基础前馈 → 第二次相加 | 同一份 X 逐步变成 X′、Y；确认稳定的层间接口 | 注意力内部交给 04，专家选择交给 06；GLM 特有连接只作折叠延伸 |
| 04 Attention 深入 | 从 Q/K 匹配、因果遮罩、位置到 V 汇总和输出投影 | 接收 03 的归一化支路输入，交回同形状的 ΔA | 先讲通普通注意力，再有依据地比较多头、缓存与其他结构 |
| 05 Prefill 与 Decode | 同一请求先处理输入，再逐步生成，区分本轮 hidden 与历史状态 | 把一趟模型前向展开为多轮请求时间线 | 缓存管理、调度与设备分工交给框架和硬件章节 |
| 06 MoE | 把 03 的前馈区域放大为路由、专家计算与加权合并 | 输入仍是前馈支路表示，输出仍是可写回的 ΔF | 专家放置与跨卡派发交给并行章节 |

03 的九段顺序固定为：输入表示、整层路线、分出残差旁路、RMS、注意力汇总、第一次相加、第二次归一化与前馈、第二次相加、返回整层。动画在正文就地播放和旋转，数值沿同一条计算链传递；各章不可随意改换例子却假称同一次前向。教学层的权重与简化条件必须明确，不能把普通 softmax 注意力冒称 GLM 的 KDA，把单条残差冒称 mHC。

**Goal:** 让学习者沿一条固定路径，从 Token 与矩阵看到 Transformer 的计算，看到请求在 CPU/NPU/HBM/互联/机柜间的流动，理解 vLLM / vLLM-Ascend 的调度、KV Cache、并行与执行机制，最终能读源码并分析 PR 对特性、数据流与指标的影响。

**Acceptance Criteria（全站，逐条覆盖）:**
1. 每章按「问题 → 前置概念 → 交互实验 → 逐步观察形状变化 → 连接硬件/特性/源码 → 小结」组织。
2. 模型计算层与硬件执行层在**每一步**同步：学习者随时知道在算什么、数据在哪、为什么通信、下一步去哪。
3. 教学章用真实模型尺寸（默认 Qwen3-0.6B），形状与字节数可核对。
4. 结论带证据等级 `[S] 官方 / [C] 源码 / [D] 推导 / [A] 假设 / [I] 推断 / [M] 实测 / [!] 冲突`，构建时机械校验。
5. 模型工作台：粘贴 HF `config.json` 得到结构与四类数字，与官方公布参数量误差 < 1%。
6. 中文清晰无遮挡；播放/暂停/单步与画面紧密绑定；可分享 URL 定位到具体步骤。

**Architecture:** 纯静态站点。`sim` 层用纯 TypeScript 把「一次前向」录制成 `Step[]` 时间轴（形状、数值、驻留、搬运、证据全在 Step 里），`timeline` 层是与渲染无关的播放引擎，表现层只读 Step 渲染，不自己推导。因此「两层同步」是构造期性质，由 `validateTimeline` 校验，而不是靠画面对齐。

**Tech Stack:** Vite 8 + React 19 + TypeScript + Tailwind v4 + zustand + MDX + Web Worker，Biome + vitest + Playwright，GitHub Pages 静态部署。

**当前方向（2026-10-08）:** 用户确认恢复 00–21 共 22 章，开始接通首页、课程、GLM 母版、硬件 3D 与独立 Wiki 入口。课程正文不出现 Wiki 链接、词条卡片、侧栏或问答入口；Wiki 可作为编写课程时的内部事实依据。第一轮为站点骨架，完整章节编排与计算/硬件逐步联动分别验收。下方 2026-09-06 的地基与表现层删除记录是历史背景，不代表当前 GLM 母版和硬件资产状态。

**最新用户反馈：当前课程整合方向被否定。** 以下“同日进展”只说明文件与功能存在，不表示正文、布局或整合体验获认可。详细正文的要求不变；需要恢复同一请求/同一模型贯穿的讲解、前置概念与逐步观察，而不是重复独立文章加独立演示入口。助手自行新增的版式不属于已定愿景。用户认可的模型母版 A1–A3 及本计划 §1.3 是重新核对的依据；先审视一章的完整学习过程，再推广到其余章节。

**同日进展:** 用户否定基础正文的讲解深度后，22 章已围绕具体数值、缓存与请求状态、硬件搬运和源码路径重写，内容位于 `src/content/course/`。第 03 章按当前 GLM 的四路残差、mHC、KDA、SwiGLU 和两次写回讲解，不再套用历史 Qwen 样板层；原始母版仍使用教学权重。段落内可以直接播放对应母版步骤或打开硬件部件，放大与切换视图保留章节及步骤。表格、算例和多题自测已接入，Wiki 仍为独立入口。此状态不等同于逐步同步硬件执行、逐章专属动画或模型工作台的全站终态验收；细节见 [站点接入记录](docs/plans/site-shell-integration.md)。

---

## 〇、终点线与不做什么

**终点线（B）**：一个可公开访问的静态站点，22 章 + 模型工作台，每章满足上面 6 条验收标准。

**不做什么**（明确排除，避免绕路）：
- 不做后端、不做账号、不做真实推理服务，全部离线预算好。
- 不下载模型权重进仓库（哈希惰性生成，标 `[A01]`）。
- 无实机，站内不出现自测性能数据，`[M]` 只用于离线可复现的脚本产物。
- 不复用上一版 `../infra-view` 的任何代码（用户已判定失败）。
- 不为动画效果虚构技术流程。

**终态数据契约（Terminal Schema）**：以下类型是终态形态，后续只扩展不重写。表现层无论用什么技术，都只消费它们。

| 类型 | 位置 | 作用 |
|---|---|---|
| `ModelSpec` | `src/sim/modelspec/types.ts` | 全站唯一形状来源。教学章时间轴、工作台数字都从它派生 |
| `Step` | `src/sim/timeline/types.ts` | 唯一真相源。一步的标题、解说、公式、张量、高亮、算子、lineage、硬件驻留、搬运、活跃单元、证据、术语 |
| `Timeline` | `src/sim/timeline/types.ts` | `Step[]` + 张量表 + 预设句 + 硬件 spec |
| `TensorRecord` | `src/sim/timeline/types.ts` | 形状、维度名、角色、数据或惰性权重、字节数、值域 |
| `GenerationTrace` | `src/sim/model/traces.ts` | 真实模型逐 token 生成的 top-k 概率与熵 `[M]` |
| `PlaybackState` | `src/timeline/store.ts` | 离散播放状态；步内进度 `progress.t` 是模块级瞬态，不进 store |

---

## 一、产品结构

### 1.1 学习路径（22 章，分里程碑实现）

**Part 0 · 导论**
- `00` 从一次对话开始：推理到底在算什么。建立全站约定（双层视图、颜色语义、证据标记、播放器用法），预览整条请求路径。

**Part 1 · 模型计算层**
- `01` Token、Embedding 与向量：文字 → token id → `[S,H]`。
- `02` 矩阵乘法与张量形状：GEMM、tile/分块、算术强度（为硬件章铺垫）。
- `03` **Transformer 层的双层数据流**（M1 样板章）：RMSNorm → QKV 投影 → GQA Attention → Softmax → O 投影 → 残差 → SwiGLU MLP。
- `04` Attention 深入：MHA/GQA/MQA/MLA、RoPE、causal mask、FlashAttention 分块与在线 softmax。
- `05` Prefill 与 Decode：两种批形状、KV Cache 的诞生与增长、TTFT/TPOT/ITL、计算密集 vs 带宽密集（roofline）。
- `06` MoE：router、top-k、experts、加权合并。

**Part 2 · 硬件执行层**
- `07` 昇腾 NPU 剖面：AI Core（Cube/Vector/Scalar）、片上存储层级、HBM；H100 SM/Tensor Core/HBM 对照。
- `08` 服务器与机柜：CPU/DRAM/PCIe、8 卡 HCCS 拓扑、RoCE 参数面、A3 超节点；NVLink/NVSwitch 对照。
- `09` 一次请求的硬件旅程：API → tokenizer → 队列 → Scheduler(CPU) → ModelRunner → NPU/HBM → 采样 → 流式输出。

**Part 3 · vLLM / vLLM-Ascend 机制**
- `10` 引擎架构与插件机制：vLLM V1 EngineCore/Scheduler/Worker/ModelRunner；`vllm_ascend/platform.py` 插件入口与 patch 机制。
- `11` KV cache 内存系统：PagedAttention、block table、prefix caching、KV Pool、CPU offload、layerwise/sparse offload。
- `12` Scheduler 与调度策略：continuous batching、chunked prefill、抢占、short request first、batch-job-aware scheduler、async scheduling。
- `13` 并行 I：TP / PP / DP（rank 网格、Column/Row parallel、AllReduce、PP bubble）。
- `14` 并行 II：EP / DPA / EPLB / large-scale EP。
- `15` 并行 III：SP / CP / PCP / DCP 与 64K 长序列两条路径（含 current 禁配审计）。
- `16` Graph mode 与 kernel：ACL Graph（piecewise/full）、torch.compile、自定义 aclnn 算子。
- `17` 量化与 speculative decoding：W8A8、MTP / speculative decoding。
- `18` PD / EPD 分离与 KV 传输：Mooncake、xPyD、layerwise transfer、KV 传输成本。

**Part 4 · 工程与源码**
- `19` 性能工程：指标定义、benchmark 工具、profiling、msprobe、从指标回溯到机制。
- `20` 读源码：`vllm_ascend/` 目录地图、一次请求穿过的调用链。
- `21` PR 影响分析：精选 8 到 12 个已合并 PR，PR → 文件 → 模块 → 特性 → 数据流 → 指标，带证据等级。

附录页：术语表（全站 Term 注册表）、来源索引（S/C 编号）、版本与基线说明。

### 1.2 模型工作台（贯穿全站的核心工具）

粘贴 HF `config.json`，构建整个模型结构，回答四个问题：

1. **每生成一个 token 需要多少 KV Cache 显存**。按注意力类型分别计算：MHA/GQA 按 `2·n_kv·d_head·bytes`；MLA 按压缩潜向量 `kv_lora_rank + rope_dim`；线性注意力/KDA 是固定大小状态而非按 token 增长，单独标注；DSA indexer 的额外索引缓存单列。
2. **总参数量与激活参数量**。dense 层 + 注意力 + top-k 路由专家 + 共享专家 + embedding/lm_head 是否 tie。
3. **给定输入 X k、输出 Y k、batch z 的部署方案**。权重显存、TP·PP 切分后每卡显存、KV 总量、HBM 余量、可行的 TP/PP/DP/EP 组合、是否建议 PD 分离；遵守 vLLM-Ascend 支持矩阵与并行约束（如 `EP_SIZE = TP×DP`、GQA 下 DCP 约束、PCP 禁配）。
4. **Prefill / Decode 理论耗时**。roofline `max(FLOPs/峰值算力, bytes/峰值带宽)` + TP 通信估算 + MFU/MBU 假设滑块，输出 TTFT/TPOT 估算与归因条。

排期：**M1** 做问题 1、2 与结构图（首批 Qwen3 dense / Qwen3-MoE）；**M2** 做问题 3、4 与硬件峰值参数表，补 DeepSeek-V3（MLA/MoE/MTP）与 GLM-5-Next（KDA/DSA/MLA/MoE）解析器。

教学章与工作台共用同一个 `ModelSpec`：工作台选中的模型可直接带进教学章观察。

### 1.3 每章固定教学模板

1. **问题**：一个具体场景（例如「一条 64K prompt 进来，为什么第一个字要等 3 秒」）。
2. **前置概念**：本章新术语列表，可就地展开；依赖前章的概念给回链。未覆盖的前置知识必须在此补齐，否则本章不能标「已覆盖」。
3. **实验台**：交互画布 + 播放器 + 视图切换（模型层 / 硬件层 / 双层）+ 少量参数（预设优先）。
4. **逐步观察**：步骤列表与画布同步；每步显示 输入 shape → 运算 → 输出 shape、当前驻留位置、搬运链路、通信原语；真实数值可展开核对。
5. **连接工程**：硬件部件 → vLLM-Ascend 特性 → 源码入口（固定 commit 的文件/类/函数）→ 影响指标 → 证据等级。
6. **小结与自测**：3 条要点 + 2 到 3 道自测。

**章节与知识库（LLM-Wiki）的关系**（用户 2026-09-20 定，写作约定，不为它加机制）：

- 本站是教学平台，每章正文**要详细讲解**，动画配合讲解，不是「文字很少、只有动画」。
- 知识库已合入本仓库 `main`（`wiki/concepts|params/*.md`；交接见 `HANDOFF-LLM-WIKI.md`）。其中教学式长页（如 `tensor-parallel`、`pipeline-parallel`、`chunked-prefill`、`vllm-v1-shape`）与章节主题重叠，且已逐句对过钉住 commit 的源码、带行号。
- 写某一章时，**先查知识库里 frontmatter `chapters` 挂了该章号的页，以它们为底稿扩写**；章节开头记一行「基于哪几页知识库页」，这些页因上游变化被改时回头看本章。
- 写章节时发现知识库缺了或错了，先补知识库再扩写——知识库始终是事实的底。
- **2026-10-08 已定**：恢复 §1.1 的 22 章，首页与课程导航统一读取 `src/content/chapters.ts`；知识库保留原 22 章编号。`world.json` 的十境数据仅供历史山境资产使用，不再定义站点课程。Wiki 只作为独立入口，课程正文不显示上述内部写作关联。

### 1.4 证据与事实系统

| 标记 | 含义 | 展示 |
|---|---|---|
| `[S##]` | 官方文档 / 论文直接支持 | 内联低对比标签，悬停出来源卡（URL、版本、核验日期） |
| `[C##]` | 固定 commit 源码行为 | 链接到 GitHub 固定 commit 的文件与行号 |
| `[D##]` | 由公式 / shape / rank 规则推导 | 悬停显示推导过程 |
| `[A##]` | 教学假设 | 悬停显示为何假设 |
| `[I##]` | 推断，未被一手来源直接证实 | 黄色标签 |
| `[M##]` | 实测结果 | 只用于离线可复现的脚本产物（当前只有生成 trace） |
| `[!]` | 版本冲突 / 实验状态 / 当前禁配 | 红色整行高亮 |

规则：性能方向性结论只能来自 `[S]` / `[M]`；`[D]` / `[I]` 只能说「可能影响」；`[!]` 必须写明冲突来源与复核日期。构建时校验每个编号都在注册表中，每章至少有来源列表。

事实基线：vLLM `cacc429f` + vLLM-Ascend `28bf3a2e`（2026-08-29 核验），页面同时标注稳定版 v0.23.0。硬件以昇腾为主（Atlas 800I A2 八卡 HCCS、A3 超节点），H100 只做术语对照。

### 1.5 视觉系统

见 `DESIGN.md`（设计真相源）。要点：浅色暖底学习图谱、暖白纸面、深色 248px 课程轨道、橙色唯一行动色、对象身份色全站固定（Token/激活青、权重暖金、KV Cache 蓝、通信紫、控制面灰、错误红）、等宽字体表示机器可核对的事实。

---

## 二、技术架构

### 2.1 目录与依赖方向

```
src/
  design/     Tailwind v4 @theme tokens、语义色、字体；无逻辑
  sim/        纯 TS，禁止 import react / zustand / 渲染库
    tensor/   Tensor 类型、Float32Array 算子、seeded RNG
    modelspec/parseHfConfig → ModelSpec、参数量与 KV 分析
    model/    forwardLayer(spec) 边算边录制、惰性权重、预设句、真实生成 trace
    hardware/ NpuSpec（纯数据）、mapResidency(step, spec) → 硬件层状态
    timeline/ Step/Timeline 类型、Recorder、validateTimeline 不变量
  timeline/   zustand 播放引擎（store、progress、快捷键、URL、Worker 客户端）；禁止 import 渲染库
  viz2d/      DOM 侧图元（空，待建）
  content/    MDX 章节、terms.ts、sources.ts、claims/、mdx-components/（空，待建）
  app/        路由、页面壳、PlaybackBar；唯一把各层拼起来的地方
scripts/      check-content.ts、check-deps.ts、gen-preset-tokens.ts、gen-trace.ts、bench-forward.ts
docs/plans/   单个 feature 的实施计划（按 multi-agent 的 writing-plans skill 写）
reference/    并行策略图片包（只用其事实与证据账本）
```

依赖单向：`design ← sim ← timeline ← viz2d ← content ← app`。Biome `noRestrictedImports` + `scripts/check-deps.ts` 兜底，违反即 CI 失败。表现层选定后在 `viz2d` 之后插入新的一层，不改动这条链的前半段。

### 2.2 仿真核心：Step 是唯一真相源

表现层与 DOM 面板都只读 `Step`，不各自推导。

- **真实尺寸**：`forwardLayer(spec, ...)` 按 `ModelSpec` 真实维度计算（Qwen3-0.6B：H=1024、16 q heads、8 kv heads、d_h=128、I=3072）。序列用内置预设句，token id 由真实 Qwen3 tokenizer 离线算好 `[S]`，S=6。
- **权重**：不存储、不下载。`weightAt(id, i, j)` 按哈希惰性生成，按 `initializer_range` 缩放，内存为零，标 `[A01]`「形状是真实模型，数值不是 checkpoint 输出」。
- **计算位置**：Web Worker 内计算，按 `(modelId, presetId)` 缓存。0.6B 约 200 ms，8B 约 2.2 s。
- **硬件层派生**：`mapResidency` 按规则给出驻留（权重常驻 HBM，激活进 Cube 前经 HBM→L2→L0，KV 写回 HBM kv 区），每条规则带证据等级。
- **确定性**：权重与随机量一律走 `rng.ts` 的 `hashString` + `mixSeed`（按张量 id 与下标定值），禁 `Math.random` / `Date`。
- **测试**：golden（缩小的 spec 与参考值逐元素 1e-5 比对）、真实尺寸不变量（softmax 行和 = 1、RMSNorm 后 RMS ≈ 1、GQA 每组 q head 读同一 K、shape 链与 ModelSpec 一致）、`validateTimeline`（高亮张量存在、transfer 的张量在 residency 中、matmul lineage 维度可乘、step id 唯一、beats 单调）。

### 2.3 播放引擎

- store：`{ timeline, stepIndex, playing, speed, layer, reducedMotion, load/play/pause/next/prev/seek/setSpeed }`。
- 步内进度 `progress.t` 是模块级瞬态对象，不进 store；页面里唯一的时钟每帧调用 `advance(dt)`，画面元素自己每帧读 `t` 直接改 DOM 或 uniform，**播放期零 React 重渲染**；换步的缓冲重写在 `useLayoutEffect([stepIndex])` 一次完成。
- 快捷键：Space 播停、←/→ 步进、Home/End、`[ ]` 调速；输入框聚焦时忽略。
- URL：`?ch=&step=&layer=model|hardware|both&nofx=1`，用 step id 不用序号，`replace` + 150 ms 节流（不用 react-router 的 `useSearchParams`）。
- Reduced motion / `nofx`：`t` 直接为 1，过渡到终态。

### 2.4 表现层：**待重定**

原计划这一节是 3D 图元库（TensorGrid、MatMulRig、FlowPacket、KVBlockGrid、RankLattice、硬件模型库、troika 文字策略、相机导演、后期）。**整节作废**，代码已删除，原因见第四节。

新的表现层必须先通过下面的 Spike 定下画面纪律，再选技术。已知的硬约束（用户多次确认，不可违反）：

- 看得见矩阵维度、切分、计算与聚合；看得见 token / 张量 / KV 的流动。
- 中文清晰无遮挡；画布内只放短标签，长文进画布外 DOM。
- 禁止：平铺立方体阵列、伪 3D 流程图、光点在方块间移动、为动画虚构流程、大段文字堆在画面旁。
- 若一个画面可以用「一个方块 + 一个标签」完整替代，视为未达标。
- 参照物：bbycroft.net/llm、poloclub Transformer Explainer、animatedllm.github.io/generation-model、3Blue1Brown 矩阵动画、matrixmultiplication.xyz。

### 2.5 硬件模型库：**待重定**

原计划是程序化 3D 模型（`NpuModule910B`、`AtlasServerA2`、AnchorRegistry、爆炸视图）。依赖表现层选型，随 2.4 一起重定。`src/sim/hardware/` 的数据层（部件、锚点、驻留规则、搬运路径）已完成且与渲染无关，保留。

### 2.6 内容管线

- Vite：`@mdx-js/rollup` + `remark-frontmatter` + `remark-mdx-frontmatter` + `remark-gfm`；`import.meta.glob` 懒加载章节。
- Frontmatter（zod 校验）：`{ id, order, part, title, problem, prerequisites, sources, lab:{ timeline, defaultLayer }, baseline }`。
- MDX 组件：`<Term id>` 悬停卡、`<Evidence id>` 角标、`<Lab step>` 点击跳步且正文与步骤双向高亮、`<StepList/>` 由 timeline 自动生成、`<ShapeLineage/>`、`<Callout kind>`。
- `scripts/check-content.ts`：编译 MDX 收集引用，对照注册表与 timeline step id；校验 frontmatter、每章 sources 非空、prerequisites 已定义、每个 step evidence 非空。失败非零退出，接入 `pnpm check`。当前是占位实现。
- 每章配 `claims.md`（同图片包 CLAIM_LEDGER 格式）。

### 2.7 章节页布局

三栏壳：左课程轨道 248px 深色固定，中栏实验台 + 播放条，右栏解读 380px。窄于 1024px 纵向堆叠，右栏变底部抽屉。中栏画布内容随 2.4 重定。

**注意**：这个壳做过一版（`#/lab`），因为右栏堆长文被用户否定为「幻灯片」。重做时右栏只放一句话加悬停，细节折叠。

### 2.8 测试与验证

- vitest：sim golden / 不变量 / validateTimeline；store 逻辑；纯函数。
- Playwright：每章每步访问 `?step=<id>&nofx=1`，等 `window.__labReady`，1280×800 截图；断言画布 `data-step-id` 与右栏一致。
- 静态：`tsc --noEmit`、Biome、`check:content`、`check:deps`，统一 `pnpm check`。
- **UI 改动必须看截图**，只读代码不算验收（曾出现字体渲染成实心方块而所有数值断言全过）。
- 交付前把关键截图发给用户目测。

---

## 三、M1 任务分解与当前状态

M1 = 地基 + 样板章 `03` + 工作台 v1。

| # | 任务 | 状态 | 证据 / 说明 |
|---|---|---|---|
| 0 | 脚手架：Vite/TS/Tailwind tokens/DESIGN.md/Biome/vitest/HashRouter/Pages Action | 完成 | `pnpm check` 通过，可部署 |
| 1 | `sim/modelspec`：`parseHfConfig` + `ModelSpec` + 形状推导 | 完成 | Qwen3-0.6B / 8B / 30B-A3B 解析正确 |
| 2 | `sim`：tensor 算子 + `forwardLayer` + 惰性权重 + Recorder + golden | 完成 | 21 步，每步有中文解说、lineage、高亮、证据 |
| 3 | `sim/hardware`：NpuSpec + mapResidency + validateTimeline | 完成 | 每步 residency / transfers 完整，20 个硬件用例 |
| 4 | 预设句真实 token id | 完成 | `pnpm gen:presets`，golden 测试 |
| 5 | `timeline` 播放引擎 + Worker + 快捷键 + URL | 完成 | `#/dev/spike-c` 验收：0.6B Worker 构建 < 500 ms，播放期零 commit |
| 6 | 真实生成 trace（计划外补充） | 完成 | `pnpm gen:trace`，三句预设各 12 个贪心 token 的 top-10 概率 `[M]` |
| 7 | 工作台数字引擎：参数量、激活参数、每 token KV | 完成 | `src/sim/modelspec/analyze.ts` + golden 测试，对照官方参数量 |
| **S1** | **Spike：定表现层的画面纪律** | **未开始，阻塞项** | 见下 |
| 8 | 表现层图元库 | 未开始 | 待 S1 |
| 9 | 硬件层画面 | 未开始 | 待 S1 |
| 10 | 内容管线 + MDX 组件 + terms/sources + `check:content` 完整实现 | 未开始 | 与表现层无关，可先做 |
| 11 | 章节页布局（三栏壳 + 右栏 tabs + 逐步观察表 + 窄屏） | 未开始 | 做过一版被否，重做时右栏只放一句话 |
| 12 | `03` 章 MDX 正文 + `claims.md` + `00` 导论骨架 + 术语表页 + 来源页 | 未开始 | 与表现层无关，可先做 |
| 13 | 工作台页面（左粘贴 config，右四个 Tab） | 未开始 | 数字引擎已就绪，只差页面 |
| 14 | 模型结构图 | 未开始 | 待 S1 |
| 15 | Playwright 截图基线 + CI | 部分 | 只剩 `tests/spike-c.spec.ts` |

### Spike S1：定表现层的画面纪律

**这是 Spike，不是交付物。产出是一份写进 `DESIGN.md` 的规则，不是代码。**

**为什么必须先做**：同一件事已经失败三次（分步静态构图 + 长文右栏、纸面平板块、格子体），三次都是我先写代码再给用户看，三次都被整体否定。根因不是某个参数没调好，是「画面要长什么样」从来没有被双方确认过。

**限时**：一轮讨论。不写任何画面代码。

**做法**：
1. 取参照物的实际截图（bbycroft、Transformer Explainer、AnimatedLLM、3B1B），和用户逐张过。
2. 对每张问三个问题：这张图里 3D/动画承载了什么二维静图做不到的信息？画面上同时出现多少个元素？文字有多少？
3. 把答案落成可检查的条目写进 `DESIGN.md`，例如「一屏只有一个焦点」「体量用什么表示」「数值什么时候出现」「标签最多几档」。
4. 用户明确同意后，才进入任务 8。

**完成标准**：`DESIGN.md` 里有一节画面纪律，用户明确说「按这个做」。

**下一步（S1 通过后）**：从一个最小对象开始（例如一个 `[6,1024]` 激活），只交一张静帧给用户看；静帧批准后才做动效。每次只交一张图。

### 可以不等 S1 先做的

任务 10、12（内容管线与 `03` 章正文）、13（工作台页面，纯数字与表格）都不依赖画面选型。是否先做由用户定。

---

## 四、已作废的部分（2026-09-06）

原计划把 3D 当作主要表现手段。相关代码已全部删除（提交 `24cf6fd`，59 个文件，5537 行），**不要恢复**。

**删除的**：`src/viz3d/` 全部图元与场景、`#/lab` 与 `#/model` 两个页面、Spike A/B 验收页、四个相关 Playwright 用例、3D 字体子集与 `gen-font-subset.ts`、three / @react-three/fiber / drei / postprocessing / @types/three / maath / subset-font 七个依赖。

**作废的计划条目**：§2.4 3D 图元库整节、§2.5 硬件 3D 模型、§1.4 里的 3D 文字规则、DESIGN.md 原「3D 场景语法」一节、M1 原任务 1/2/7/8/9/14。

**原因**：三版画面依次被用户否定为「跟幻灯片有什么区别，大段大段的文字」「怎么能这么丑，你到底参考了什么」「这不就是平片图吗」。共同根因：画的是示意图而不是物体，只搬了参照物的机制没有搬它们的画面纪律。

**保留的**：`src/sim/` 全部、`src/timeline/` 全部、页面配色与字体、`PlaybackBar`、`#/dev/spike-c` 验收页。

**暂时没有消费者但保留的**（表现层重建后会用到，有测试，不要删）：
- `src/sim/timeline/plane.ts` 的 `planeView`：张量 → 二维视图的轴选择规则。
- `Step.camera`、`Step.beats`：步的镜头与子节拍字段。

**流程约束（用户明确要求）**：不许再由 AI 自作主张地「先做一版看看」。动画面之前先定纪律并拿到用户明确同意；先静帧后动效；每次只交一张图。

---

## 五、里程碑

| 里程碑 | 交付 | 验收 |
|---|---|---|
| **M1** 地基 + 样板章 + 工作台 v1 | 工程骨架、DESIGN.md、播放引擎、单 NPU 硬件数据、表现层图元、MDX 管线、`00` 骨架、`03` 完整章、术语表页、工作台 v1 | 用户目测 `03` 章达到「看得见矩阵/形状/流动、双层同步、文字无遮挡」；工作台数字与官方一致 |
| M2 模型计算层 + 工作台 v2 | `01 02 04 05 06`；工作台加部署方案与耗时估算、硬件参数表、DeepSeek-V3 与 GLM-5-Next 解析器 | 同标准 |
| M3 硬件执行层 | 硬件模型完整（NPU 剖面、8 卡服务器、机柜、H100 对照）、`07 08 09` | 硬件模型全站复用可证 |
| M4 引擎与内存与调度 | `10 11 12` | 同标准 |
| M5 并行三章 | `13 14 15` | 同标准 |
| M6 图 / 量化 / PD | `16 17 18` | 同标准 |
| M7 工程与源码与 PR | `19 20 21`、精选 PR 标注 | 同标准 |

每个里程碑结束：typecheck + 单测 + 内容校验 + Playwright 截图，把截图发给用户目测验收后再进下一个。

**当前位置：M1，第 8 项之前，阻塞在 Spike S1。**

---

## 六、单个 feature 的实施计划

本文件是总体大纲。具体到一个 feature 时，按 Multi-Agent 的 `writing-plans` skill 写分步实施计划，存到 `docs/plans/{feature-name}-plan.md`：每步一个动作、写精确文件路径与完整代码、写精确命令与预期输出、先红后绿、频繁提交。

---

## 七、Feature 索引

单个 feature 的聚合文件放 `docs/features/F{NNN}-name.md`（Status / Why / What / AC / 决策 / Timeline），实施计划放 `docs/plans/`，写法参照 Multi-Agent 的 `feat-lifecycle` 与 `writing-plans` skill。

| ID | 名称 | 规范与当前验收状态 | 实施计划 |
|---|---|---|---|
| F001 | 课程知识库与问答 | [F001](docs/features/F001-llm-wiki.md) | [计划](docs/plans/llm-wiki-plan.md) |
| F002 | 参数清单与版本谱系 | [F002](docs/features/F002-param-lineage.md) | [计划](docs/plans/param-lineage-plan.md) |
| F003 | GitHub 语料与报错溯源 | [F003](docs/features/F003-github-corpus.md) | [计划](docs/plans/github-corpus-plan.md) |
| F004 | 使用驱动的知识积累闭环 | [F004](docs/features/F004-knowledge-loop.md) | [计划](docs/plans/knowledge-loop-plan.md) |

**验收状态只看上表四份 feature 里的验收表**；「现在在哪、接下来做什么」看 [HANDOFF-LLM-WIKI.md](HANDOFF-LLM-WIKI.md)；页数、预算这类会变的数字按它 §2 的命令现查。本索引不复制状态和数字。

F001 同时给 §2.6 内容管线提供 Term 注册表：`<Term id>` 的 id 与摘要来自 `src/content/wiki/registry.json`（由 `wiki/concepts/` 派生），不再另建 terms 表。
