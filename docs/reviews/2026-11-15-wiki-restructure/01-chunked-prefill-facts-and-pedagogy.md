# 样板 1：`wiki/concepts/chunked-prefill.md` 旧事实与教学改进清单

- **目标文件**：[`wiki/concepts/chunked-prefill.md`](../../../wiki/concepts/chunked-prefill.md)（350 行，`id: chunked-prefill`，`type: feature`）
- **拟采用修订类型**：`editorial`（纯结构重排、消除 `supplement` 劈断补丁与提示词残留、将 `v0.30.0rc2` 并入四版本对照表；本轮清单未提出需 `supersede.claims` 的正文纠错，不人为捏造正文旧错；若后续独立检视或源码核对发现新反证，则按实改判并启用 `supersede.claims` 有证更正，不以保真要求固化未核实旧错）
- **冻结保护项**：
  1. `L194-L196` 3D 围栏 `wiki-scene`（`inference-mechanism:7`）原样保留；
  2. 与 `inference-mechanism:7` 强绑定的 `L109-L120`、`L171-L177` 教学算例（每步预算 `8`，`A/B` 各 decode `1` 个位置，新请求 `C` `14` 个位置按 `6、6、2` 分三步算完，第 3 步产出 `y₀`，第 4 步转入 decode）原样保留；
  3. 2D 图 [`chunked-prefill`](../../../wiki/diagrams/chunked-prefill.yaml)（`L111-L113`）与 [`chunked-prefill-flow`](../../../wiki/diagrams/chunked-prefill-flow.yaml)（`L183-L185`）保留。

---

## 一、 现有 `sources`（51 条，L15-L72）与 `rawSources`（2 条，L94-L98）核对

| 编号（1-based） | `sources` 引用条目 | 覆盖的核心机制与版本 | 去向分类 |
|---|---|---|---|
| 来源 1–4 (`L16-L19`) | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py` (`#L340-L352`, `#L401-L410`, `#L678-L700`, `#L997-L1019`) | `[C1]` 调度器不区分 prefill/decode、`running`/`waiting` 两道减法、单条上限截断、`_update_after_schedule` 提前推进 `num_computed_tokens` 与 `is_prefill_chunk` | **保留** |
| 来源 5–6 (`L20-L21`) | `vllm@0fc695fc:vllm/config/scheduler.py` (`#L70-L90`, `#L238-L272`) | `enable_chunked_prefill` 静态兜底 `True`、`[C6]` 启动日志、`[C9]` `verify_max_model_len` 严格小于校验 | **保留** |
| 来源 7–10 (`L22-L25`) | `vllm@0fc695fc:vllm/engine/arg_utils.py` (`#L2370-L2394`, `#L2258-L2267`, `#L2518-L2528`), `vllm/config/model.py#L1803-L1811` | `[C7]` 按 `is_chunked_prefill_supported` 默认推导（生成式仅 encoder-decoder 为 `False`）、手动关分块 warning、`[C8]` partial-prefill 抛 `NotImplementedError` | **保留** |
| 来源 11–13 (`L26-L29`) | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py` (`#L259-L263`, `#L293-L338`), `vllm-ascend@db701c1f:.../patch_glm5_next_mamba_scheduler.py#L9-L57` | `need_mamba_block_aligned_split`、`[C12]` `_mamba_block_aligned_split`、`[C13]` GLM 补丁用 `self.block_size` 对齐完整 KDA 状态而非 `4` | **保留** |
| 来源 14–17 (`L30-L33`) | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py` (`#L858-L867`, `#L1078-L1099`, `#L1444-L1470`, `#L2631-L2671`) | 步前 `num_computed_tokens_cpu` 编位置号、`[C15]` `discard_requests_mask`、`[C16]` `_build_attn_state` 执行标签判据、`[C17]` 带种子 RNG offset 回拨 `4` | **保留** |
| 来源 18–19 (`L34-L35`) | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L398-L474`, `.../indexer_kpool_mla_v1.py#L477-L498` | `[C18]` KDA `has_initial_state` / `output_final_state=True` 跨段接状态；稀疏 MLA `seq_lens` 全长与 `index_topk + index_kpool - 1`（`2051`）清单宽度 | **保留** |
| 来源 20–22 (`L36-L38`) | `vllm@0fc695fc:docs/configuration/optimization.md#L41-L62`, `vllm/model_executor/models/config.py#L371-L374`, `vllm-ascend@2c59ff10:vllm_ascend/platform.py#L713-L718` | `[S20]` 小预算（如 `2048`）偏 ITL、大预算偏 TTFT；`[C21]` `align` 要求开启分块断言；`[C22]` v0.23 `SLO_limits_for_dynamic_batch` 联动打开分块 | **保留** |
| 来源 23–28 (`L39-L45`) | `vllm@568afb3a` (`scheduler.py#L463-L467`, `config/scheduler.py#L153-L156`), `vllm@84030bbe` (`scheduler.py#L1026-L1076`, `config/speculative.py#L1811-L1850`), `vllm-ascend@baa023ad:.../batch_invariance.md#L186-L188`, `vllm-ascend@2ed6cbba:.../model_runner_v1.py#L1327-L1350` | v0.26 DP 节拍门控；`[C25][C26]` main 并行草稿预留（MTP 为 `0`）；`[S27]` main `baa023ad` batch invariance 要求关分块、关 APC、配 `--block-size 128` 且不支持驱逐重算抢占；`[C28]` v0.26 标签判据 | **保留** |
| 来源 29–34 (`L46-L55`) | `patch_mamba_config.py#L222-L225` (`[C29]`), `arxiv:2308.16369` (`[S30]` SARATHI), `utils.py#L1396-L1433` (`refresh_block_size`), `raw:sha256-ab8d477a...`, `scheduler.py#L689-L699`, `arg_utils.py#L2370-L2377` | APC+align 状态块计算、SARATHI 出处、普通注意力块大小静默改 `128`（GLM `640` 不受影响）、`waiting` 截断与默认推导补充行号 | **保留** |
| 来源 35–39 (`L56-L60`) | `vllm@ced6857a` (`arg_utils.py#L2794-L2816`, `config/scheduler.py#L70-L74, #L185-L194`), `vllm-ascend@7d825229:vllm_ascend/platform.py#L1067-L1075`, `vllm-ascend@db701c1f:.../kimi_kda.py#L38` | v0.30.0rc2 分块默认与 `prefill_schedule_interval=1`、`profiling_chunk` 在 MRV2 可配 async 而 MRV1 仍拒；KDA 内部 `64` 位置分段常量 | **保留** |
| 来源 40–51 (`L61-L72`) | `vllm@568afb3a` & `vllm@84030bbe` (`core.py`, `scheduler.py`), `vllm-ascend@db701c1f` (`model_runner_v1.py#L2631-L2731, #L2569-L2582`), `vllm@0fc695fc` (`gpu_model_runner.py#L239-L310`, `rejection_sampler.py#L249-L283`) | v0.26/main DP 节拍门控两层条件与 `prefill_capacity_bound` 更新；未完 prefill 采样丢弃的三条消费路径（同步、投机拒绝采样、异步输出排除） | **保留** |
| 拟增补核验锚点（来自 `agy` `L71-L74`） | `vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py` (`#L259-L290`, `#L448-L501`, `#L767-L793`, `#L1121-L1132`) | 支撑正文 `L238-L251` GLM 双机 `20,000` token 三步借块算例（full 组、尾状态组滑窗归还与 KDA 预留公式）的直接源码定位 | **保留（补充入 `sources`）** |

---

## 二、 逐段旧事实与版本/硬件限定条件三出口核对表

| 原文位置 | 原子事实与版本/硬件限定条件摘要 | 关联来源 / 标记 | 出口分类 | 新稿承接位置与说明 |
|---|---|---|---|---|
| `L103-L120` | 定义与首屏示意算例：预算 `8`、`A/B` 各 decode `1` 个位置、`C` 提示词 `14` 个位置按 `6、6、2` 分三步算完，前两步末尾采样结果不作为输出，第 3 步产出 `y₀`，第 4 步转 decode（内嵌 `chunked-prefill` 图） | `[C1]`–`[C4]`、`[C15]` | **保留** | 首屏「长提示词插进来，怎样不卡住别人的回答？」主干；将 `L105` 过早抢跑的普通/线性注意力保存形态区分后移至「历史状态怎样跨段接上」一节，首屏更聚焦 |
| `L121-L139` | 收益与排队边界：关闭分块且单条上限默认 `0` 时，`C` 一步算完撑大为 `16` 个位置拖慢同批 `A/B` 的 ITL，且超余量新请求停止本步 waiting 接纳堵住后续短请求；合批复用权重（实际读量/速度仍取决于缓存、内核与批次）；预算封位置数而非毫秒 | `[C3]`、`[S20]`、来源 33 | **保留** | 「收益与代价」正反账本自然语言主干，就地保留全部限定条件（单条上限默认 `0`、合批收益取决于缓存/内核/批次、预算封位置数非毫秒） |
| `L140-L160` | 三笔代价：`C` 自身 TTFT 更晚（调小/调大预算不单方面保证 ITL 更稳或 TTFT 更短，须按真实负载同时看 TTFT、ITL、总吞吐与长短请求分布）；普通因果注意力逻辑可见历史范围 `14 vs 6+12+14=32`（非实际 HBM 读取次数，因果打分对数均为 `105` 对）；每步调度/输入准备杂活及段末 1 个位置白做词表投影与采样 | `[C15]`、`[S20]` | **保留** | 「收益与代价」代价侧与 `calc` 账单，自然语言就地写明“普通因果注意力逻辑访问范围、非 HBM 实际读次数”及调参测量前提 |
| `L162-L196` | 调度减法与第 2–5 站执行流水线：`running` 先续、`waiting` 后排，取 `min(还差几个, 剩余预算)`（`6、6、2`）；排完即提前推进 `num_computed_tokens`（`0→6→12→14`）并标 `is_prefill_chunk`；执行侧按步前已算数编位置号、查 `block table`、贴 `ChunkedPrefill` 标签；采样丢弃未完段并回拨带种子 RNG；**原样保留 `L183-L185` `chunked-prefill-flow` 图与 `L194-L196` `wiki-scene` `inference-mechanism:7`** | `[C1]`–`[C4]`、`[C15]`–`[C17]` | **保留** | 「调度器怎么切：每一步只做同一道减法」；消除 `L168-L169` 劈断 `calc` 算式的突兀补丁段落，补入直观 `min(need, budget)` 短循环伪代码辅助理解 |
| `L198-L207` | 跨段续接无“拼结果”步骤：位置号与因果掩码不断（`6–11` 看 `0–11`）；普通注意力原处追加 KV cache；线性注意力跨步交接固定大小递推状态；同批请求各自块表/状态槽隔离 | `[C18]`、来源 14/18/19 | **保留** | 「切开不算拼结果：后一段靠什么接上前文？」（承接原 `L105` 后移的普通/线性注意力存储形态对比） |
| `L208-L220` | 边界与变体：① 切点平时不对齐 KV 块，唯独混合模型开 prefix caching 且落入 `align` 模式时向下取整到块大小整数倍；区分 `4-token` indexer-state 物理分格与调度器 `self.block_size` 完整递推状态可复用边界（**剔除 `L212` “给定材料中的”提示词残留**）；② 单条上限 `--long-prefill-token-threshold`（默认 `0`）；③ 手动关分块（默认推导含 pooling 检查、正单条上限先截再查开关、启动要求预算 `>= max_model_len` 及崩溃 warning）；④ 运行时资源约束与昇腾 `ProfilingChunkScheduler` 等未启用变体 | `[C3]`、`[C7]`、`[C9]`、`[C12]`、`[C13]`、来源 33/34 | **保留**（仅剔除 `L212` “给定材料中的”提示词套话） | 「边界与变体：单条上限、关掉分块与块对齐」主干，完整保留物理块 `4` 与公共块边界 `self.block_size` 的对比及 `L339` 尾部重复段落合并 |
| `L221-L254` | GLM 双机 `20,000` token 三步算例：双 DP 组各 `8192` 预算/最多 `32` 条、decode 含 MTP 占 `4` 位置、触发门槛最低 `8068`（`R1` 与场景 `M` `6000` token 不触发）；`20,000` token 在 12 条 decode 下按 `8144、8144、3712` 三步算完（“每步照常前进”仅指获调度机会，不代表输出时间间隔不变）；执行侧四变化（`ChunkedPrefill` 走 eager + 跨机 MoE 超 `128` 换 AllGather；34 层 KDA 跨步接状态 + 步内 `64` 位置分段；11 层稀疏 MLA indexer 挑最多 `2051` 个位置；切点 `8144 = 12×640+464` 不对齐 `640`）；五缓存组借块账（full 组新借 `13→13→6` 累计 `32` 块、KDA 常驻 `12` 块、尾状态组滑窗持有 `2037→2038→930→3` 块，首段约 `15.9 GiB` 占 `3855` 块池子过半）；静态推导无实机开关分块/调预算延迟实测 | `[C13]`、`[C16]`、`[C18]`、来源 18/19/39、新增 `single_type_kv_cache_manager.py` 来源 | **保留** | 「落到 GLM 双机：20,000 个 token 怎样分三步跑完？」（增补步序推进小表，合并 `L229` 独立单句补丁） |
| `L255-L265` | 8 条常见误解（默认开启含 encoder-decoder 例外、总算力未减、仅末段吐 token、无结果拼接、关分块更堵 vs PD 分离、段长不等于 KV 块、KDA 算子内 `64` 分段非调度分块、预算 `8192` 非固定毫秒上限） | 综合前文与 `[C7]`、`[S20]`、来源 39 | **保留** | 「常见误解」小节 |
| `L266-L350` | `## 对照源码` 核验区：钉点声明（含 `v0.30.0rc2` `ced6857a + 7d825229`）、`### 怎么开`、`### 会报什么错`（含严格小于 `< max_model_len` 相等边界 vs 文档“必须大于”措辞，**剔除 `L284` “材料中的文档”提示词残留**）、`### 开销和什么时候别开`（含同步/投机/异步三条丢弃采样消费路径、`baa023ad` batch invariance 要求关分块/关 APC/配 `--block-size 128`/不支持驱逐重算抢占，**剔除 `L317` “材料还提到”提示词残留**）、`### 版本差异`（将 `L304` 孤立的 `v0.30.0rc2` 粗体段并入四版本表格，保留 `L315` DP 节拍门控两层条件详解）、`### 源码位置`、`**待核**` 2 项，并将 `L339-L350` 散装追加的 `**适用边界**` 与来源 33/34/39 归并入对应核验小节 | `[C1]`–`[C30]`、`[S20]`、`[S27]`、`[S30]`、`[D]`、`[!]` | **保留**（归并尾部散装补丁，剔除 `L284`/`L317` 提示词残留） | 文末默认折叠的 `## 对照源码` 核验区（同一 `.md` 文件内完整保留全部机器角标与四版本矩阵） |

---

## 三、 具体讲法改进位置与实施要点

1. **首屏减负与直觉提速（`L101-L120`）**：
   - 将 `L105` 在读者尚未理解“为什么要切”之前就提前展开的“普通注意力 K/V vs 线性注意力递推状态”移入第 4 节「历史状态怎样跨段接上」，首屏紧接核心定义直接进入 `A/B + C(14→6,6,2)` 手算示意与 `chunked-prefill` 2D 图。
2. **收益与代价双面合账，消除 `L144` 免责绕口令（`L121-L160`）**：
   - 将原第 2、3 节整合为对照鲜明的「三项收益 vs 三笔代价」，把 `L144` 连续四句重复解释“预算限制位置数而非时间”的绕口令收束为清晰的调参铁律（同时保留全部负载测量条件）。
3. **修复 `L166-L171` 被 `supplement` 劈断的算式，补充短循环伪代码（`L162-L196`）**：
   - 消除 `L166`（`C 的三步是：`）与 `L171` `calc` 块之间插入的 `L169` 突兀补丁段，将“允许分块 vs 关闭分块退出接纳循环”自然融入调度减法说明，并附上 ~12 行 `min(need, budget)` 调度短循环伪代码；**原样保留 `L194-L196` `wiki-scene` `inference-mechanism:7` 围栏**。
4. **清理 3 处提示词残留与尾部散装补丁（`L212`, `L284`, `L304`, `L317`, `L339-L350`）**：
   - 剔除 `L212`「给定材料中的」、`L284`「材料中的文档」、`L317`「材料还提到」三处内部提示词痕迹；
   - 将 `L304` 孤立的 `v0.30.0rc2` 段落合入 `L306-L313` 四版本对照表，并将 `L339-L350` 散装追加的 5 小段无损归入 `## 对照源码` 对应条目，消除文末复读。
