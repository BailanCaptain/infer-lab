# npu-model-runner 审查记录

## P5 写作记录（第 12 批，2026-09-29，Opus 写手）

### 改了什么

- 深改全页。字数（scratchpad `p5/wc.py` 口径）：改前 1253 → 改后全文 8948、教学正文 7035；写作标准口径（`scripts/wiki/standard.ts` 的 `measureStandard`）对照源码之前 6232 字。
- H2 顺序：是什么（直觉图 + A、C 示意例）→ 为什么需要、代价在哪（含 4 行角色对照表）→ 一步怎么走（示意 calc：5 个词的词表、greedy）→ 两次调用各走哪几段（代码流程图，只讲准备输入之外 runner 新增的职责）→ 两次调用之间执行状态里存了什么（12 项分用途表、顺序约束、引擎/runner 先后图）→ 哪些东西跨步留着（寿命三层表、读代码的分类）→ GLM 双机（16 个 runner、R1 两步、执行状态字节 calc、场景 M 只链 C）→ 常见误解（10 条）→ 对照源码（五个 H3，顺序固定）。
- 图（三张，宽均 900）：
  - `model-runner-layout.yaml`（重画，直觉图）：上层「跨步保留」三样（持久批次、KV cache、权重），中层第一次调用 ①对账 ②拼输入 ③跑模型 ④选第 0、3 行，⑤–⑦ 是第二次调用（取出并清空、采样、按请求交回），中间单独一格「执行状态（暂存）」连接两次调用；可选的「允许哪些词」从左侧进入第二次调用。数都是 A、C 示意数，不含 GLM 形状。
  - `npu-model-runner-code-flow.yaml`（新增，代码流程图）：左列第一次调用（第 3、4 站），右列第二次调用（第 5 站），淡色框是提前离开的出口（状态没取走报错、本步 0 token、流水线非末段、没有执行状态、8 卡都交只收 0 号）；图上不放代码名，pins 钉 db701c1f 的 9 段源码。
  - `npu-model-runner-two-calls.yaml`（新增）：引擎 / runner 两条泳道的先后图，演示引擎在 runner 前向期间算允许词表、等返回空后再发第二次调用。
- 未使用 exchanges 分镜动图（按 09-29 临时规定）。
- frontmatter：title、summary、aliases、sources（39 条，含 v0.23/v0.26/main 对照行）、`verified`（v0.23.0、v0.26.0rc、main）、relations、updated。relations 去掉了指向 request-call-chain、structured-output 的两条：对方已写 builds-on 指回本页，lint 报 relation-duplicate（有向边只写在依赖方）。

### 数字出处

- 01 §A3：R1 第一步每卡 `[4]`、位置 0–3、`[4, 4096]`、含 prefill；每卡 KDA 8 头、MLA 8 头、路由专家 18；计划经广播队列发给本机 8 个 worker。
- 03 §0、§A5：词表 154880、hidden 4096、主干 45 层、MTP 每步 3 个草稿；lm_head 每卡 19,360 列、TP All-Gather 后每卡完整；8 卡同种子各自采样、只收 output_rank 0；GLM 草拟强制 eager；decode 步 4 行 logits 1,239,040 B（正文只引结论并链接一条请求第二圈，不重算）。
- 03 §A6：decode 步满足 uniform decode，回放 4 token 的图；拒绝采样一步交回 1–4 个 token；异步调度按自动判定打开。
- 本页新算的只有两处：GLM 段 calc「执行状态最大的几样」合计 1,304,576 B ≈ 1.24 MiB（隐藏向量 `[4, 4096]` × 2 B = 32,768 B 沿用一条请求页的 BF16 口径）；版本差异里 PCP 临时补齐 1 × 2 × 32 = 64（max_num_seqs 32 取自 03 §0）。
- 场景 M（49 行词表分数拆回 13 条）只链接 concurrent-requests 第 5–7 站，不重算。

### 核心概念对照了什么

- 两次调用与执行状态：`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py` L269–L285（`ExecuteModelState` 12 项）、L1917–L1937（State error、计时校准标志跨进程）、L2306–L2327（PP 非末段、pooling 出口、按 `logits_indices` 取行再 `compute_logits`）、L2349–L2371（存状态、调用 deferred 修正函数、return None）、L2373–L2427（空状态出口、取出清空、CPU fp32 套 grammar、`_sample`）、L2455–L2582（`_bookkeeping_sync` → 草拟 → `ModelRunnerOutput` → `need_accepted_tokens` 在全局流上数接受数 → `AsyncGPUModelRunnerOutput`）。
- 引擎侧交替：`vllm@0fc695fc:vllm/v1/engine/core.py` L443–L463（非阻塞 execute → `get_grammar_bitmask` → 返回 None 才 `sample_tokens`）、L508–L597（批次队列同一步成对发；结构化输出推迟时先处理上一批再补发第二次调用；`unexpected error`）；L200–L203 与 L517–L518 确认无 ec_transfer_config 时 `is_ec_consumer` 为真、本步 0 token 不采样。
- 对账前两处防护：db701c1f L748–L763（KV 加载失败重算的回退守卫）、L1994–L2011（上一步被丢弃的请求，注释说不清零会 KeyError）；上游乐观记账 `gpu_model_runner.py` L1304–L1316、修正函数 L1461–L1494（「second step prev_num_draft_len = 0，third step = 2」的注释支撑「第二步不补账、第三步起补」）。
- 接受数：db701c1f L3842–L3862（`MambaSpec` 扫描）；上游 `_update_states_after_model_execute` L1495–L1513（要求投机解码 + `is_hybrid`）；`glm5_next.py` L2437–L2439（`IsHybrid`）；`mamba/abstract.py` L44–L60（`MambaBase` 报 `MambaSpec`）；KDA 类继承 `MambaBase`（`glm5_next.py` L1541）。
- 草拟与整理的先后：昇腾先 `_bookkeeping_sync` 再草拟（L2455–L2486）；上游 L4462–L4486 注释写明用设备 token 草拟不等 bookkeeping。
- 图模式下隐藏向量是回放的固定输出缓冲：依据 03 §A6 第 5 条（`acl_graph.py` 回放返回录制时的 output）与 `_model_forward` L2803–L2836 直接返回 `run_model()`（flashcomm 关），据此推出「草拟须在下一次前向前读完」，正文写成推论。
- Worker 建 runner：`worker.py` L505–L521；v2 退回 L159–L163；种子 L496–L499。
- 版本：在 2c59ff10 / db701c1f / 2ed6cbba / baa023ad 上逐项 grep：`ExecuteModelState` 12 项一致、State error 一致、CPU grammar 一致、两处防护四版都在、v2 退回只在 v0.23/db701c1f、PCP 补齐只在 v0.23/db701c1f（db701c1f L293–L346 加上再减回）、main 的 `need_accepted_tokens` 改读 `has_mamba_layers`（L4480–L4482）、文件行数与 `execute_model` 起始行；v0.23、v0.26 无 GLM 模型文件，main 在 `models/glm5next/`。

### 旧版信息清单勾选（清单：scratchpad `13898c74…/scratchpad/p5/npu-model-runner-facts.md`）

p4-checkpoint 版（14591fd，改前与之相同）：

| 条目 | 去向 |
|---|---|
| F1 Runner 在计划与模型之间，不管全局调度、不改层结构 | 第一节定义、第二节角色表（「不决定算谁」「各层怎么算归模型」）；relations 保留 glm-5-3-flash 一条 |
| F2 图 model-runner-layout | 保留 id，重画为直觉图 |
| F3 Worker 持有调用 Runner；委托≠进程划分 | 第二节角色表后新增一段，链接 engine-processes |
| F4 Ascend 先做异步回退检查再委托父类；批次映射要一致 | 第四节「对账前多两处防护」；会报什么错第 4 条 |
| F5 无输入有返回路径；有输入时准备各表，可能填充 | 第四节「本步没有 token 就提前返回」、代码流程图；准备内容链接准备输入页 |
| F6 持久对象与临时张量生命周期不同 | 第六节寿命三层表 + 常见误解 |
| F7 A/C 第三轮 T=4，忽略填充等 | 第一、三节示意例（示意数，不带 GLM 形状） |
| F8 形状表 [4]→[4,4096]→四路残差→[2,4096]→[2,154880] | 挪到 GLM 段改用 R1 的真实步：4 行、45 层（四路残差链接一条请求）、最后一层 [4, 4096]、第一步 1 行、第二步 [4, 154880]。A/C 在 GLM 上的 [2,154880] 不再作形状表：GLM 开着 MTP，A/C 不带草稿不是真实 GLM 步，标准也要求 GLM 段不换算例 |
| F9 4096/154880/四路残差；先前向再按 logits_indices 选行 | GLM 段与第三节、代码流程图 |
| F10 2×154880=309,760 是逻辑元素数，不是 FLOPs/显存峰值/每 rank 形状 | 常见误解第 5 条保留 309,760 与三处区分，并补上每卡 19,360 |
| F11 执行状态保存 logits 等，sample_tokens 取用清理；不等于再跑层栈 | 第一、四、五节，常见误解第 3 条 |
| F12 普通按请求采样；未完成 prefill 不当最终预测；投机验证 | 第三节末段（链接 chunked-prefill、准备输入）、第四节右列第 3、4 条、常见误解 |
| F13 PP 非末段、pooling 另有返回路径 | 第四节「两个出口」、常见误解 |
| F14 稀疏 MLA 与 KDA 状态不同；按后端身份 + 缓存规格分组 | 第四节「建注意力元数据」；GLM 第一步新增一句两类层各拿自己那份 |
| F15 计划 → 通用批次信息 → 按层/缓存组元数据 → 层调用 | 第四节「建注意力元数据」 |
| F16 读码顺序；不同生命周期；函数排列≠运行顺序 | 第六节末段、源码位置「读法」、常见误解末条 |
| F17 基于 db701c1f；安装、默认值、设备结果以来源基线为准 | 版本差异末段 |

更早版本 0f97c8b（旧模型，数字不适用，机制按 db701c1f 核后择用）：O1 继承上游 ✓（第二节、怎么开）；O2 init_device 建、v2 开关 ✓；O3 选行公式 → 在准备输入页的怎么开，本页链接；O4 grammar 与前向重叠、sample_tokens 顺序 ✓（第四、五节）；O5 空状态返回 ✓；O6 State error ✓；O7 mamba align 搬状态 → GLM 部署 `mamba_cache_mode=none` 不执行，写在怎么开；O8 每卡一个 runner ✓（GLM 段 16 个）；O9 大文件读法 ✓；O10 v0.23 PCP 补齐、v2 退回 ✓（版本差异）；O11 计时标志跨进程 ✓（开销）；O12 只省输出头、前向省不掉 ✓（第三节、开销）。

### 参考图库

看过 `refs/INDEX.md`、`HOW-THEY-TEACH.md` 和 amd-04 截图。图库讲的是通信原语和 TP/DP/PP/EP，没有直接讲 model runner 的。借了 amd-04（PP）「逐行标出这一步谁在干活、谁空着」的做法，画成引擎 / runner 两条泳道的先后图（淡色「等返回空」表示引擎在等），用我们的配色和图元，没有照搬版式。

### 自查

- 读者检验：只读前两屏能说出 runner 是每张卡上执行一步的对象；为什么需要（计划说请求、模型认行；计划只写增量要有人记全量；拆两次调用给允许词表留空档）；代价（挡在前向前、两次调用严格交替、代码难读）。
- 格式：首图在第一个 H2；图前没有 calc；calc 2 个，分在第三节和 GLM 段；表与 calc 不相邻；正文行内代码 0；对照源码之上角标 0；全页角标 27，其中 C 21 个（77.8%）、D 4、A 2；免责 0.5%；对照源码后无 H2。
- P1 疑点：无。可能被追问的点：执行状态 calc 的隐藏向量 BF16 口径（见待核）；「图模式下隐藏向量是固定输出缓冲」是由 03 §A6 推出的结论。

### 验证

- `pnpm wiki:lint`：通过，本页 0 报错（改动中修过：两条 relation-duplicate；一处指向 async-scheduling 的锚点因该页正被别的写手重写而失效，改成不带锚点的页面链接）。别页只剩 `sources/answer-fbdf…` 的 mark-flood 待留意。
- `pnpm wiki:diagrams --check`：247 张图与 spec 一致。中途 batch-invariance 的 spec 一度报错、挡住全局渲染，本页三张图用同一套 `loadDiagrams` / `renderDiagram` / `figureProblems` 单独渲染和检查（0 问题），之后全局 `--check` 通过。
- `pnpm wiki:audit`：通过，本页 0 问题（修过一处 `patch_use_v2_model_runner.py` 行号越界，L1–L21 → L1–L20）。
- 写作标准实测（同一 `checkStandard` 函数，本页不在名单内）：6232 字 · 行内代码 0.0/千字 · 角标 0 · 对照源码 ✓ · calc 0.32/千字 · 相邻块 0 · 图先行 ✓ · 免责 0.5% · 图宽 ✓。
- 未做浏览器验收（按分工由审查环节做）。三张图用 Playwright 把 SVG 截成 PNG 看过排版，无压字、无出框。

### 跳过与待核

- 按纪律没读 HANDBOOK、docs/plans、codex-p5-common.md。
- 待核：执行状态里隐藏向量的 dtype 未在设备上实测；异步调度是否真的打开要看启动日志 `Asynchronous scheduling is` 一行；v0.23/v0.26/main 只逐项比对了版本表里的条目，其余方法未逐行 diff。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，只审不改页面）。**得分 8.5 / 10。P1 0 条，P2 1 条，P3 6 条。** 学习顺序通过；`pnpm wiki:audit` 本页通过；`pnpm wiki:lint` 通过。

### 初学者测试（只读前两屏）

我能说出：model runner 是每张卡的 Worker 里、从启动一直活到退出的执行对象，它把调度器按「请求」写的计划翻译成模型要的「行」，跑一遍前向，只让每条请求预测下一个 token 的那几行乘词表，然后把分数暂存起来，等引擎第二次调用时再采样、按请求交回。之所以需要它：计划只写增量，得有人记着完整的请求记录；输出按行排列，得有人拆回给各条请求；拆成两次调用，才能给结构化输出留出算表的时间。代价：主机端准备工作挡在前向前面，两次调用必须严格交替，代码难读。

学习顺序：是什么（直觉图 + A、C 示意例子，不算数）→ 为什么需要、代价在哪 → 怎么做（示意 calc：5 个词的词表、greedy）→ 细节（分岔、执行状态、寿命三层）→ GLM 双机 → 常见误解 → 对照源码。**通过**。基础节里没有 GLM 部署数字；GLM 之后只有常见误解和对照源码。

### 核心概念对照（vllm-ascend@db701c1f `vllm_ascend/worker/model_runner_v1.py`，全文件 5480 行，和「五千四百多行」一致）

- 类：`NPUModelRunner(GPUModelRunner)`，L287 ✓。Worker 在 `init_device` 里建 runner（`worker.py` L505–L520），种子在 L498–L499 ✓。
- `ExecuteModelState` 共 12 项（L269–L285），和第五节表的分组对得上 ✓。
- 第一次调用 `execute_model`（L1917）的顺序和第四节、代码流程图一致：
  1. 上一份状态没被取走就报 State error（L1936–L1937）；
  2. 对账前的两处防护：上一步被丢弃的请求（L1994–L2011），以及 KV 加载失败后往回退的请求（`_update_states` 里，L748–L763）；然后调父类对账（L2014）；
  3. 本步 0 个 token 就提前返回（L2041、L2056）；
  4. 依次 `_prepare_inputs`（L2064）→ `_determine_batch_execution_and_padding`（L2088）→ `_build_attention_metadata`（L2198）→ `set_ascend_forward_context`（L2265，传入本步宽度、两个 DP 组各自的 token 数、图模式）→ `_model_forward`（L2289）；
  5. PP 非末段和 pooling 从这里另走出口（L2308–L2324）；
  6. 按 `logits_indices` 取行，再 `compute_logits`（L2326–L2338）；
  7. 存执行状态（L2350）→ 延后的补账（L2368）→ `return None`（L2370）✓。
- 第二次调用 `sample_tokens`（L2373）：没有执行状态就返回空（L2381–L2397）→ 取出后清空（L2415）→ 转到 CPU、用 fp32 套允许词表（L2418–L2424）→ `_sample`（L2427）→ `_bookkeeping_sync`（L2462）→ 草拟（L2486/L2490）→ `ModelRunnerOutput`（L2498）→ 在全局流上等采样事件，再数接受数（L2519–L2526）→ `AsyncGPUModelRunnerOutput`（L2569）✓。
- `need_accepted_tokens` 靠扫描 `MambaSpec` 决定（L3859）；上游 `_update_states_after_model_execute` 还要求开着投机解码且模型是混合模型（vllm@0fc695fc `gpu_model_runner.py` L1495–L1506）✓。
- 引擎侧：`EngineCore.step` 先非阻塞发出 execute，再算 grammar bitmask，拿到 None 才调 `sample_tokens`（vllm@0fc695fc `core.py` L454–L463）✓。
- 「昇腾先整理结果再草拟」：db701c1f L2462 → L2486 ✓。上游对 EAGLE/MTP 这类方法（padded batch）是先草拟（`gpu_model_runner.py` L4465–L4483），对 ngram 仍是整理后再草拟，见下面 P3-3。
- 在 v0.23 / v0.26 / main 三版上抽查：State error、`ExecuteModelState`、CPU grammar、`sample_tokens` 都在；main 的 `need_accepted_tokens` 改读 `has_mamba_layers`（baa023ad L4482）。和写手的版本表一致。
- 「图模式下，隐藏向量就是回放时固定的输出缓冲」：依据是 03 §A6 第 5 条（回放时返回录制那块 output），属于合理推论，不判错。

### 数字（逐个对照底稿，并手算）

- 1,239,040 B = 4 × 154880 × 2（03 L181）；每卡 19,360（03 L177）；KDA 8 头、MLA 8 头、路由专家 18（01 L742）；KDA 34 层（01 L123、L193）；uniform_decode 为真（03 L444）；异步调度按自动判定打开（03 L420）；草拟强制 eager（03 L171 第 17、20 条）；只收 output_rank 0 那份（03 L189）；场景 M 的 49 行、13 条（C 第 5–7 站）。✓
- calc 1：A 行最大值在下标 1，C 行最大值在下标 3；2 × 5 = 10，4 × 5 = 20 ✓。calc 2：4 × 4096 × 2 = 32,768；合计 1,304,576 B，除以 1,048,576 = 1.244 MiB ✓。
- 写手自报的疑点：BF16 口径沿用一条请求页，隐藏向量的 dtype 没有设备实测，页面没把它写成实测，可以接受。

### 丢信息核对（基线 p4-checkpoint）

旧版 6 个 H2 和 facts 清单 F1–F17、O1–O12 抽查了 F8、F10、F16、O11：都有去处。旧版 A/C 在 GLM 上的形状表 [2,4096]→[2,154880] 改成了 R1 两步的真实形状，只剩常见误解里的 2 × 154880，见 P3-5。没有发现丢失的信息。

### 链接与浏览器

- lint 的跨页锚点硬校验通过；全库 11 页链接本页，都不带锚点。
- Playwright 1440 宽打开 5193：第一屏是问题式 H2 + 加粗定义 + 直觉图；三张图都是 900 宽，没有横向滚动，没有压字。截图：scratchpad `npu-model-runner-review-first.png`、`-layout.png`、`-codeflow-full.png`。
- 没有 meta 文本，没有新增分镜；对照源码之上行内代码 0、角标 0；每节最多 1 个 calc，表和 calc 不相邻。

### P2

1. **L184–L192「引擎怎样保证交替」和 `npu-model-runner-two-calls` 图，重讲了已改完的页。**
   - 问题：这一段讲的都是引擎侧行为：EngineCore 非阻塞发出第一次调用 → 趁前向算允许词表 → 等返回空再发第二次调用；异步调度下批次队列成对发出；结构化输出推迟时先处理上一批再补发。这些在 [request-call-chain §一步之内](request-call-chain.md#一步之内enginecore-给-worker-发两次调用)（L137–L157，已有 `request-call-chain-step` 图）和 vllm-engine-core ③ 里都讲过。「为什么需要」第 3 条也已经讲过允许词表和前向重叠。本页又配了一张泳道图重讲，和本批「重叠处一句话 + 链接」的要求不符，是这次扩写里最明显的注水。
   - 改法：只留 runner 侧的结论一两句（worker 按收到的顺序执行，所以任何时刻最多一份执行状态；推迟补发也不会插进新的第一次调用），其余换成链接。泳道图删掉；如果要留，只画 runner 这一侧的状态格占用和清空，不再画引擎怎么排。

### P3

1. **页内重复。**「两次调用必须严格交替 / 没取走就报错」出现在 L92、L146、L158、L182 四处；「按函数先后读不等于运行顺序」出现在 L94、L206、L249 三处，页末「源码位置」还有一段读法；L204 和常见误解 L245 几乎是同一句。改法：代价二只点一句，第五节保留完整原因（它补充了图缓冲这一层）；L94 的读法说明删掉，只留 L206。
2. **L150「建注意力元数据」和准备输入页重叠。** 这件事 prepare-inputs-flow §注意力元数据 已经讲了（那页的代码流程图也把它算进第 3 站）。本页把它列成「准备输入之外 runner 多做的事」，口径不一致。改法：压成一句加两个链接，或者从「多做的事」列表里挪开。
3. **L162「上游 GPU 版反过来，先草拟再整理」缺限定。** 上游只对 EAGLE/MTP/draft-model（padded batch）先草拟，ngram 等方法仍在整理之后（vllm@0fc695fc `gpu_model_runner.py` L4465–L4483、L4553–L4555）。改法：加上「对 MTP 这类方法」。
4. **L152「存完执行状态、返回之前再修正」是 GLM 口径，不是普遍规律。** `mamba_cache_mode == "align"` 或 `use_compress`（模型配置有 `compress_ratios`）时，会在前向前就提前修正（db701c1f L2126–L2133、L2165–L2168）。GLM 两者都不满足（03 L98），所以本页的说法对 GLM 成立。改法：加半句「GLM 这种配置下」，或在「怎么开」里补上 `use_compress`。
5. **常见误解 L244「两行词表分数 2 × 154880」没有指代对象。** 旧版的 A/C-GLM 形状表已经删了，正文里 GLM 部分只出现 1 行和 4 行。改法：写明「如果把 A、C 这一步放到 GLM 上」。
6. **术语先用后讲，外加一处图示问题。** 「块表」（L74）、「隐藏向量」（L76）、「词表分数」（定义句）都在解释之前出现；可以在首次出现处加半句，或链接到 kv-cache / lm_head。另外，直觉图里「允许哪些词」的箭头指向 ⑤取出并清空，实际它是在⑥采样前使用的，箭头应改指 ⑥。

### 跳过了什么

- 按纪律没读 frontmatter 的 sources 区、HANDBOOK、docs/plans、codex-p5-common.md。
- 「对照源码」只用 grep 核了五个 H3 的顺序和版本标记（v0.23 / v0.26 / main、db701c1f 单独标注都在），正文没读。
- 代码块跳过；三张图只看了 label 和浏览器截图，没有逐行读 YAML。
- 源码只读了方法签名和调用顺序，没读算子实现；v0.23 / v0.26 / main 只抽查了关键符号，没有逐行 diff。

## P5 修订记录（09-29）

按「P5 审查（09-29）」修订：P2 修 1 条，P3 修 6 条。

- **P2-1 引擎侧重讲。** 第五节「引擎怎样保证交替」整段压成「谁来保证交替」两句：只留 runner 侧结论（同一步两次调用成对发出、推迟补发也不插进新的第一次调用、worker 按序执行，所以任何时刻最多一份执行状态），其余链接 [request-call-chain#一步之内enginecore-给-worker-发两次调用](../../../../wiki/concepts/request-call-chain.md)。泳道图 `npu-model-runner-two-calls`（yaml + svg，本人新建）删除：它只画引擎怎样排两次调用，没有本页独有信息，内容已由 request-call-chain 的 `request-call-chain-step` 图承担；runner 侧的执行状态占用与清空仍在直觉图里。写作记录「改了什么」里那张图的条目以此为准。
- **P3-1 页内重复。** 代价二缩成一句并链到执行状态一节；代价三删掉「按函数先后读不出运行顺序 / 读法见源码位置」，改链到寿命三层一节；寿命三层一节删掉与常见误解重复的「不能推断所有状态每步重建」半句，只留输入缓冲每步重填这一条新信息。常见误解、源码位置里的读法保留。
- **P3-2 注意力元数据口径。** 从「准备输入前后 runner 多做的几件事」列表里挪出，改成列表后一段：说明它是准备输入的最后一段，保留「按后端身份 + 缓存规格归拢成组」（旧版 F14/F15），链接准备输入 §注意力元数据 与注意力后端 §runner 怎样把层归拢成组。代码流程图里的「建注意力元数据」框保留（只表示先后）。
- **P3-3 上游先草拟的限定。** 改成「上游 GPU 版对 MTP 这类直接用设备上采样结果草拟的方法先草拟再整理，ngram 等方法仍在整理之后」。
- **P3-4 补账时机的适用条件。** 补半句：这是 GLM 这种配置下的顺序；开 align 模式或带压缩配置时，修正提前到前向之前（db701c1f L2126–L2133、L2165–L2168）。
- **P3-5 309,760 的指代。** 常见误解改为「把 A、C 这一步放到 GLM 上，两行词表分数有 2 × 154880 = 309,760 个数……」。
- **P3-6 术语与图。** 定义句「词表分数」、第一节「块表」「隐藏向量」首次出现处各加半句解释。直觉图「允许哪些词」的箭头从指向 ⑤ 改为绕到 ⑥ 采样（虚线），图说同步改成「采样出 token（⑥），有允许词表时先按它压掉不许出现的词」。

字数：8948 → 8927（全文），教学正文 7035 → 7014。

验证：`pnpm wiki:lint` 通过（本页 0 报错，含跨页锚点硬校验；request-call-chain、prepare-inputs-flow、attention-backend-family 三处锚点均解析）；`pnpm wiki:diagrams --check` 246 张与 spec 一致（删去一张后从 247 变 246）；`pnpm wiki:audit` 通过，本页 0 问题。直觉图用 Playwright 截 PNG 看过，新箭头不压字。
