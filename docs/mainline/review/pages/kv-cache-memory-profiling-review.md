# kv-cache-memory-profiling 审查记录

## P5 写作记录（2026-09-28，第 07 批，深改）

写手：Opus 写手（按 P5 通用做法）。改前为 `p4-checkpoint` 版本（工作区未动过）。

### 改了什么

- **重排为六步骨架。** 首屏：问题式 H2「启动时怎样知道还能给 KV cache 多少显存？」+ 一句话定义 + 直觉图；第二屏：生命周期不同为什么要试跑、HCCL 缓冲 650 M ≈ 82 块作动机数字、三处代价、三个易混量小表（3 行）；然后 GLM 双机（四个 H3）、常见误解（7 条）、对照源码（五个 H3，顺序固定，三版差异表）。
- **直觉图重画** `wiki/diagrams/kv-cache-memory-profiling.yaml`：四行逐项扣减——①定预算（总显存 × 显存比例，右端斜纹为预算外）②扣权重 ③扣激活峰值 ④扣非 torch 增量（括注 HCCL 缓冲），剩下的是 KV cache 的份额并落到「切成 KV 块」；预算外段括注「切完 KV 才占：录图等」。只示意先后与归属，不标字节。
- **新增代码流程图** `wiki/diagrams/kv-cache-memory-profiling-flow.yaml`：快照 → 建通信组 → 加载权重 → 是否指定显式 KV 预算（是：照样试跑、直接用指定值；否：两次 profile run → 预算减三项）→ EngineCore 取 8 卡最小块数 → 分配 KV 池 → 录 decode 图 → 打印建议值；标注对应双机页启动第五到第七步。
- **删去编造算例**（64 GiB/0.9/30/4/2、2 MiB/11,059 页、16 位置/7 页），按标准「不编造数字算例」改为链接双机页的真实算例结论。
- **单一出处**：54.40 GiB → 30.00 GiB → 3,855 块（精确 3,908）、8,355,840 B/块、13,056 B/token、9.6 GiB 预算外、15 块短请求只写结论并链 `glm-5-3-flash-two-node`；权重分项与常驻链 `device-memory`；HCCL 650 M ≈ 82 块链 `gap-a5164fe10fa9184412f8`；块规格链 `kv-cache-spec`；索引器 FP32 副本 54 MiB 链 `tensor-parallel`；8192 token 预算与 MC2 门槛 128 链 `one-request`。本页零 calc，不重算任何数。
- **修生产路径出处**：删去指向来源基线页的段落，sources 全部改为钉住的生产路径源码（db701c1f / 0fc695fc）加三版对照，共 22 条。
- relations：保留 device-memory、kv-cache-spec，新增 gap-a516…、acl-graph；未写 glm-5-3-flash-two-node，因为双机页已有 builds-on 指向本页（lint relation-duplicate 要求只写一侧）。

### 数字取自

- 01 §A0（第 5–9 步：先量显存、再切块、后录图）、§A0.3（整卡 21,078 MiB ≈ 20.58 GiB，算例取整 21 GiB，路由专家每卡 18 个）、§A0.5（64 GiB × 0.85、3.4 GiB 假设且不含图、30.00 GiB、8,355,840 B、3,855 块）、§A0.6（7 个录图尺寸）、§A2.1（token 预算 8192）；待核 1–3（HBM 总量、权重实测、激活/非 torch/图内存只能从日志读）。
- 02 §1.3（整卡权重合计；表下「索引器 FP32 副本 54 MiB/卡，profile run 不执行索引器，从预算外出」）、§1.4（13,056 B/token、8,355,840 B/块）。
- 页内只引用结论，推导在上述唯一出处页。

### 核心概念对照的源码

- 预算与启动检查：`vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L464-L480`；快照先于 `_init_worker_distributed_environment`（L497），所以建组时的 HCCL 缓冲进入非 torch 增量。
- 扣减公式：同文件 `#L527-L597`（显式预算快路径 L537-L553；`memory_profiling` 区间 L557；区间内读 torch 峰值覆盖 `torch_peak_increase` L563-L570；`available = requested − non_kv` L590）。
- 非 torch 口径：`vllm@0fc695fc:vllm/utils/mem_utils.py#L96-L126`（非 torch = (total − free) − memory_reserved）、`#L191-L256`（区间入口 reset peak）、`#L263-L268`（`non_torch_increase = after_profile − before_create`）。
- 权重量测：`vllm_ascend/platform.py#L865-L867`（`max_memory_allocated`）、`model_runner_v1.py#L3729/L3794`。
- 试跑内容：`model_runner_v1.py#L3683-L3696`（先按 MC2 容量跑一次，再调上游）、`vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L6227-L6241`（`_dummy_run(max_num_tokens, is_profile=True)` + 采样试跑）；`model_runner_v1.py#L3332-L3460`（profile 时 force_eager、不建注意力元数据）、`attention/sfa_v1.py#L1660-L1666`（元数据为空 `fill_(0)` 返回）。
- 引擎汇总：`vllm/v1/engine/core.py#L244-L263`；`vllm/v1/core/kv_cache_utils.py#L2024-L2085`（显式块数覆盖、够不够一条最大长度、取 `min_num_blocks` 并收缩张量）；报错文字 `#L713-L750`。
- 录图与建议值：`worker.py#L717-L758`（`capture_model()` 在切 KV 之后；建议值 = requested − 四项 − 150 MiB，注释说明余量用途）。上游对照：`vllm/v1/worker/gpu_worker.py#L416-L443`（图内存预估只在 CUDA 且显式打开环境变量时才扣）。
- 三版：`2c59ff10` 与 `db701c1f` 的 `determine_available_memory`、`profile_run` 逐行 diff 相同；`2ed6cbba` 加层复用放大与稀疏 KV 卸载调整，`profile_run` 的 MC2 加跑包在关闭编译里；`baa023ad` 另有多缓存组缩放、KV 卸载、KVPP 调整。

### 旧版信息清单勾选（21 条）

清单原文在会话 scratchpad `p5/kv-cache-memory-profiling-facts.md`。结果：

- F1–F7、F9、F12–F21：新版都有，位置见清单。
- F8（64/0.9/30/4/2 算例）、F10（2 MiB/11,059 页）、F11 中的 16 位置/7 页：属编造算例，按写作标准删除，结论改由双机页真实数（3,855 块、7.969 MiB、短请求 15 块）承担并链接；F10 的「布局和对齐约束」落实为各卡取最小块数、张量按比例收缩（新核源码）。

### 新增（改前没有、这次核实后加入）

- 试跑在 GLM 上分两次：MC2 门槛 128 一次 + 8192 一次，同一量测区间取峰值。
- 试跑不建注意力元数据，稀疏 MLA 返回全零、索引器不运行；因此激活峰值不含稀疏 MLA 注意力计算，索引器副本也不在扣减项。
- 预算外 15% 还要装快照前已被占的显存（由启动检查条件推出）。
- EngineCore 取同一引擎 8 张卡最小块数；两道容量检查及报错文字。
- 上游 GPU Worker 的图内存预估与 NPUWorker 的差别；`num_gpu_blocks_override`、`max_num_batched_tokens`、`enforce_eager` 对量测的影响。

### 自查

- 标准检查（scratchpad `check-any.mts`，本页不在名单内，手动按名单规则跑）：教学正文 3,149 字（改前 1,119 字；audit 口径全页 9,636 字）；行内代码 0.3/千字；对照源码之上角标 0；calc 0；首图先行（图前无数字、无 calc）；免责句 0.0%；图宽 900。
- 全页角标 27 处：C 21、S 1、D 4、A 1（C 占 77.8%）。
- `pnpm wiki:lint` 通过（本页无问题）；`pnpm check:content` 通过；`pnpm wiki:diagrams --check` 186 张一致；`pnpm wiki:audit` 本页 22 条来源行号全部有效。

### 疑点（只报告，未改他页）

- 双机页「启动时发生了什么」第五步写「拿假数据跑一遍完整前向」：源码是两次试跑（MC2 门槛 128 + 8192），且稀疏 MLA 在试跑中直接返回全零，并非完整前向。
- 两台机器的 EngineCore 各自算出的块数是否再对齐，未核（本页只写同一 EngineCore 内取最小）。

## P5 审查（09-28）

审查员独立核对，只审不改。纪律：严格串行、未启动子代理、源码每次最多读 20 行。

**跳过的段**：frontmatter 来源清单（L8–L30，交给 audit）；「## 对照源码」正文（L137 起）只 grep 了 H3 和版本号，没有读正文；本页正文没有代码块。没有读取被拦截。

### 1. 初学者测试（只读前两屏 L43–L78）

能说清楚。我的一句话：vLLM 启动时先圈出「总显存 × 0.85」作为预算，用假数据按最大批量试跑一次，量出权重、激活峰值和不经 PyTorch 的占用，从预算里扣掉，剩下的切成 KV 块。代价有三点：启动时多跑一次前向；结果只对当前这套配置有效；录图这类后来才出现的占用量不到，只能由预算外那 15% 兜住。三个量的对照表（L74–L78）很有用。

### 2. 核心概念（逐条对照源码）

| 页面说法 | 判定 | 证据 |
|---|---|---|
| 先拍快照，定预算 = 总量 × 比例；空闲量不够就报错 | 对 | `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py` L466–L480 |
| 快照在建通信组之前，所以 HCCL 缓冲落进非 torch 增量 | 对 | 同文件：快照在 L466，`_init_worker_distributed_environment` 在 L497 |
| 在 `memory_profiling` 区间里跑 `profile_run`；激活峰值 = 录图前的 `allocated_bytes.all.peak` 减去区间开始时的值 | 对 | worker.py L557–L571；区间入口重置峰值统计：`vllm@0fc695fc:vllm/utils/mem_utils.py` L248 |
| 非 torch 增量 = 试跑后的（已用 − 保留），减去启动快照时的同一个差 | 对 | mem_utils.py L125（定义），L263–L268（`diff_from_create` 取的是 `after_profile − before_create`） |
| 可用 KV = 预算 − 权重 − 激活峰值 − 非 torch 增量 | 对 | worker.py L572–L574、L590 |
| 先按 128 个 token 跑一次 MC2 路径，再跑上游那次 8192 个 token 的试跑，两次在同一个区间里 | 对 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py` L3683–L3696；`mc2_tokens_capacity` 的来历见 `ascend_forward_context.py` L202–L217 |
| 试跑走 eager、不建注意力元数据，稀疏 MLA 层返回全零，索引器不运行 | 对 | model_runner_v1.py L3332–L3344（只有 `force_attention` 或 FULL 图才建元数据）、L3417（`force_eager=is_profile`）、L3458–L3460；GLM 的稀疏 MLA 走 `indexer_kpool_mla_v1.py` L809–L815，再进 `sfa_v1.py` L1660–L1666 的 `output.fill_(0)` |
| 显式 KV 预算时照样跑 `profile_run`，但直接返回指定值 | 对 | worker.py L538–L553 |
| **先切 KV、后录图** | 对 | `vllm@0fc695fc:vllm/v1/executor/abstract.py` L123–L126：先 `initialize_from_config`（分配 KV），再 `compile_or_warm_up_model`；录图在 worker.py L719 |
| 录图后的日志和建议值：四项加 150 MiB，两种建议值 | 对 | worker.py L728–L738 |
| **各卡取最小块数，多出的张量按比例收回** | 对 | `vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py` L2052–L2078（先按每卡检查，再取 `min_num_blocks`，`tensor.size` 按比例缩小）；vllm-ascend 没有改写 `get_kv_cache_configs`（git grep 结果为空） |
| 上游 GPU 的图内存预估只在 CUDA 上、而且要打开环境变量才扣 | 对 | `vllm@0fc695fc:vllm/v1/worker/gpu_worker.py` L419–L441 |
| 索引器 FP32 副本在第一次前向时才创建 | 对 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py` L1350–L1352（`_wk_weight_f32 is None` 时才 `.float()`） |

写手的疑点 2（两台机器的 EngineCore 算出的块数会不会再对齐）：**不会对齐**。`vllm@0fc695fc:vllm/v1/engine/core.py` L236–L295 里没有跨 DP 的同步。前端在 `core_client.py` L722–L726 把各引擎的 `num_gpu_blocks` **相加**，注释原文是 "Sum values from all engines in DP case"。所以本页 L112 写「8 张卡里取最小」是对的；两台机器的块数各自独立，前端汇报的是两者之和。

**漏掉的机制（P2-1）**：试跑中被跳过的不只是稀疏 MLA。GLM 的 34 层 KDA 用的是上游的 `KimiGatedDeltaNetAttention`（glm5_next.py L2080–L2081）。它的 `_forward` 看到 `attn_metadata is None` 就直接 return，注释写的是 "V1 profile run"（`vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py` L282–L284）。vllm-ascend 里的 `ops/kimi_kda.py` L487–L489 也有同样的守卫。结果是 q/k/v、β 和门控投影照常算，o_norm 和 o_proj 也照常跑（输入是全零），但短卷积和 chunk KDA 递归核没有运行。45 层里有 34 层是 KDA，本页 L96、L123、L131 却只列了稀疏 MLA。

### 3. 数字与单一出处

- 54.40 GiB、30.00 GiB、3,855 块、3,908 块、8,355,840 B、13,056 B、7.969 MiB、9.6 GiB，都和双机页 L111–L113、L211–L233 以及底稿 `docs/mainline/01-deploy-entry-schedule.md` L222–L243 一致。本页只给结论，推导链接到 [双机页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)，没有重算，**符合要求**。
- 权重 21,078 MiB ≈ 20.58 GiB，和双机页 L177、device-memory L68、L89 一致。L108 链到了 device-memory 的「启动预算」一节，**符合要求**。
- HCCL 的 650 M、约 82 块、5 万多个 token，和 gap-a5164fe10fa9184412f8 页 L100–L106 一致，L64 链到了该页的 `#这些组合起来从-kv-里拿走多少`，**符合要求**。
- 索引器 FP32 副本「约 54 MiB/卡、第一次前向才创建、不计入 KV 预算」，和 TP 页 L306、L312 以及双机页 L233 **三处一致**；本页 L96 链到了 TP 页。
- 3.4 GiB、64 GiB 都标明是教学假设，没有编造新数字。直觉图里的段长只在 yaml 里用来排版，SVG 上不显示数字，图注也写了「不是实测比例」。

### 4. 双机页「完整前向」的判断（只判断，不改）

双机页 L272 的原句：「每个 worker 拿假数据跑一遍完整前向」。**这句不准确，建议改。**

- 次数不对：GLM 要跑两次 dummy 前向，先 128 个 token（MC2 路径），再 8192 个 token（AllGather 路径）。上游那次后面还跟着一次采样试跑（`gpu_model_runner.py` L6228–L6235），MTP 草稿层也跟着跑（model_runner_v1.py L3642–L3652）。
- 也不是「完整」前向：试跑走 eager、不建注意力元数据。MoE、MLP、各层的投影和跨卡通信照常执行；但稀疏 MLA 层整层直接返回全零，索引器不运行；KDA 层只算投影，递归核被跳过。
- 建议改成（单一出处，细节链接到本页）：「**第五步，量出剩余显存。** 每个 worker 用假数据按一步的上限试跑：GLM 先按 128 个 token 跑一次，再按 8192 个跑一次。试跑不建注意力元数据，稀疏 MLA 层直接返回全零，KDA 层跳过递归计算，所以这不是一次完整前向。测出激活峰值后，用预算减去权重、激活峰值和非 torch 占用，得到还能给 KV cache 多少，见 [KV cache 显存预算](kv-cache-memory-profiling.md#试跑两次先按-128-个-token再按-8192-个)。」
- 双机页 L283 和 L335 也出现了「完整前向」，但那两处说的是 DP 空闲组陪跑，不是试跑，这次没有核。

### 5. 有没有丢信息

`git diff -U0` 只看删除的行，共 37 行。旧版的 5 个 H2 都有对应的新位置，旧清单 21 条已经逐条勾过。我抽查了 6 条，都能在新版里找到：

- F3（生命周期）→ L62 和 L114
- F9（预算外不是额外缓存）→ L118、L130、L131
- F10（布局约束）→ L112 的「取最小、按比例收回」
- F13（录图在后，另留 150 MiB）→ L121、L125、L130
- F14（显式预算照样试跑）→ L135
- F16（换配置要重新量）→ L69

另外 F17 在版本差异 L172，也还在。F8 和 F10 里编造的算例（64/0.9/30、2 MiB/11059）是有意删掉的，已经换成链接到双机页的真实算例，不算丢信息。旧版指向 [GLM 来源基线](../sources/glm-5-3-flash-baseline.md) 的链接在新版里没有了，列为 P3。

### 6. 链接、锚点、格式

- 出链锚点逐条对了 heading slug，全部存在：双机页 5 个、gap 页、tensor-parallel、device-memory、one-request 两个。
- 全库指向本页的链接有 8 处，都不带锚点。wiki/index.md 的 L22 和 L169 还是旧标题「显存容量：从运行开销算出缓存预算」。index 是派生文件，跑一次 `pnpm wiki:build` 就会更新。
- 对照源码的五个 H3 都在（L139/L149/L157/L163/L175），顺序正确；版本差异里 v0.23、v0.26、main 三个都有（L165–L172）。
- 证据角标最早出现在 L177，都在对照源码之下。正文行内代码只有 1 处（L53）。没有 calc，也不存在表格和 calc 相邻的情况。
- 用 Playwright 把两张 SVG 截图看过了：四行扣减图读起来很清楚；流程图的问题见 P3-2、P3-3。
- `pnpm wiki:lint` 通过，本页没有告警。`pnpm wiki:audit` 的结论是 ok，本页 22 条来源行号全部有效，没有无效 commit、没有越界。

### 7. 打分：8.5 / 10

**P1**：无。

**P2**
- **P2-1**，位置 L96、L123、L131：试跑中没真正执行的计算只写了稀疏 MLA，漏了 KDA（45 层里 34 层）。KDA 的短卷积和 chunk 递归核在试跑中被跳过，只有投影在跑。影响：读者会低估激活峰值没量到的部分，双机页的改法也依赖这一条。改法：L96 加一句「KDA 层同样拿不到元数据，只算投影，递归计算直接跳过」；L123 的列表和 L131 的误解条补上 KDA；对照源码区加两处来源，`vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L282-L284` 和 `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2080-L2081`。

**P3**
- P3-1，术语先用后讲。L102 表里先出现 MTP，到 L106 才解释。L114 的 KDA、L96 的「稀疏 MLA」、L94 的 AllGather 在本页都没有解释。改法：第一次出现时各加半句解释，或者链到对应页。
- P3-2，流程图第 9 格「打日志给建议值」画在两条路径汇合之后，但源码只在没有指定显式预算时才打这行日志（worker.py L728）。改法：第 9 格加上「仅自动路径」；L125 也补一句这个条件。
- P3-3，流程图第 6 格先「取最小块数」，第 7 格才「块数 = 可用 KV ÷ 每块字节」，和源码及正文 L112 的顺序（先各自除、再取最小）相反。另外，除法和取最小都在 EngineCore 进程里的 `get_kv_cache_configs` 完成，不是 worker 自己做的，L112 的「每个 worker 把自己的可用 KV 显存除以每块字节」也应该改成「EngineCore 按每个 worker 报来的可用显存各自除」。
- P3-4，L112 可以补一句「两台机器各自取最小、互不对齐，前端汇报的块数是两台之和」（core_client.py L722–L726），顺带回答写手的疑点 2，也免得读者把日志里的总块数误当成单机的。
- P3-5，L64 第一次出现 7.969 MiB 时没有就地链接出处（L108 才链到双机页）；L102 的 21,078 MiB 可以直接链到双机页「每张卡上放了什么」。
- P3-6，旧版指向 GLM 来源基线页的链接丢了。可以在对照源码的源码位置里补回。
- P3-7，提交前跑一次 `pnpm wiki:build`，把 index.md 里的旧标题刷新掉。

### 本轮运行的命令
- `git show db701c1f:<file> | sed -n` / `git show 0fc695fc:<file> | sed -n`（上表各行号，每次不超过 20 行）
- `git diff -U0 -- wiki/concepts/kv-cache-memory-profiling.md`（只看删除的行）
- `pnpm wiki:lint`：ok，19 处待留意，都不在本页
- `pnpm wiki:audit`：ok，审计 133 页，无效 commit 0、行号越界 0
- 用 Playwright 截取两张 SVG，截图在会话 scratchpad

## P5 修订记录（09-28，按上面「P5 审查」改）

### 改了什么
- **P2-1（KDA 漏写）已改。** 「试跑两次」一节把原来只讲稀疏 MLA 的一段改成两类注意力并列：11 层稀疏 MLA 填零返回、索引器不跑；34 层 KDA 照算 q/k/v、β、门控投影，在短卷积和递归之前返回，输出全零，后面的归一化和输出投影照跑。新增两段：
  - **偏向和幅度**：漏掉的计算只会让激活峰值偏低、不会偏高（峰值取最高点，没跑的计算不分配临时张量）；各层临时张量用完即释放，34 层不累加，偏低上限是单层 KDA（每卡 8 头、8192 token）的短卷积和递归临时占用，且只有它超过别处最高点才体现。**这一层具体多大没有实测，本页不给数。**
  - **为什么不影响结论**：KDA 递归状态本身在 KV cache 里，从可用 KV 切；GLM 激活峰值本就未实测，30.00 GiB / 3,855 块用的是 3.4 GiB 教学假设；漏量和稀疏 MLA 一样由预算外 15% 支付。
  - 「预算外」清单、「试跑量到的就是最高峰」误解条、源码位置「试跑的内容」和推断条都补上 KDA。
- **P3-1**：MTP 的解释挪到表格里第一次出现处；稀疏 MLA、KDA 第一次出现时各加半句解释并链到 sparse-attention、linear-attention；AllGather 路径加半句解释并链到 collective-communication#all-gather。
- **P3-2**：流程图第 9 格改为「自动路径才打建议值」，图注同步；正文日志一段补「只在没有指定显式 KV 预算时才打」（已核 `db701c1f:worker.py` L722–L728 的条件和注释）。
- **P3-3**：流程图第 6 格改为「各卡算块数：可用 KV ÷ 每块字节，向下取整」，第 7 格改为「取最小块数，分配 KV 池」；正文「切成块」一节改为 EngineCore 收齐后各自除、再取最小，worker 只报数。
- **P3-4**：同一段补「两台机器各有一个 EngineCore，各自取最小、互不对齐；API 服务进程把两台块数相加」，并删去待核里对应的一条。
- **P3-5**：7.969 MiB 第一次出现处链到双机页 `#占住一个块号要用多少显存`；表中 21,078 MiB 链到 `#每张卡上放了什么`。
- **P3-6**：源码位置「三版对照」末尾补回 [GLM 来源基线](../../../../wiki/sources/glm-5-3-flash-baseline.md) 链接。
- **P3-7 未做**：`pnpm wiki:build` 会改写 `src/content/wiki/registry.json` 等派生文件，工作区里这些文件已有别人的未提交修改，写手范围也不含 src/，留给提交的人跑。
- frontmatter 来源新增 4 条：`vllm@0fc695fc:.../kimi_gdn_linear_attn.py#L282-L284`、`vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L487-L489`、`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2080-L2081`、`vllm@0fc695fc:vllm/v1/engine/core_client.py#L722-L726`。正文只给前两条挂 [C23][C24]；后两条没挂角标，因为挂上后 [C] 占比超过 lint 的 80% 上限（mark-flood），代码名已写在句中。

### 核对的源码
- `vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py` L240–L284：投影和 `core_attn_out = torch.zeros(...)` 在 `_forward` 之外照算；L282–L284 `attn_metadata_raw is None` 时 return，注释为 V1 profile run。
- `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py` L477–L489：同样的守卫。
- `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py` L2080–L2081：KDA 层用 `KimiGatedDeltaNetAttention`。
- `vllm@0fc695fc:vllm/v1/engine/core_client.py` L722–L726：DP 下块数相加。
- 每卡 8 个 KDA 头取自底稿 `01-deploy-entry-schedule.md` L720；KDA 64 头 × 128 取自 `02-forward.md` L31。

### 跳过的
- 读 `kimi_kda.py` 的 chunk 预填充路径（L420 附近）时会话被安全分类器拦下，没有再读。所以 KDA 单层临时占用没有按算子逐项算，本页只给方向和上限的结构，不给数。

### 验证
- `pnpm wiki:diagrams`：更新 1 张（kv-cache-memory-profiling-flow），本图无告警；`--check` 187 张与 spec 一致。
- `pnpm wiki:lint`：ok，19 处待留意，本页无告警（中间一度出现本页 mark-flood，已按上条处理）。
- `pnpm wiki:audit`：退出码 0，本页来源 26 条，本地引用与行号校验通过。
- 没有截图，流程图改字后的框内排版留给浏览器验收。
