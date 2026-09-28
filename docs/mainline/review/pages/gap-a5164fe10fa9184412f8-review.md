# gap-a5164fe10fa9184412f8（HCCL buffer）审查记录

## 修订记录

- 2026-09-28 来源修正：`vllm@0fc695fc:vllm/utils/mem_utils.py#L256-L276`（该版本文件仅 275 行，`pnpm wiki:audit` 报行号越界）改为 `#L263-L268`，对应 `after_profile.measure()` → `diff_from_create = after_profile - before_create` → `non_torch_increase = diff_from_create.non_torch_memory`，即「非 torch 增量 = after_profile − before_create」的真实出处。frontmatter 第 26 行与正文来源表第 184 行同一条引用一并改正。改后 `pnpm wiki:audit` exit 0，行号越界 0，本页 18 条来源全部有效。

## P5 审查（09-29）

独立审查（只审不改）。按纪律逐段读页面、逐条对源码核，不逐句引用原文。

### 初学者测试

只读前两屏能得出：这是每个通信组在每张成员卡上预留的一块固定中转显存，建组时按配置定大小、服务期间不释放，而且每一块都直接从 KV cache 的预算里扣，所以组越多、留得越大，能存的对话历史越少。测试通过：概念、动机、代价三点在前两屏都齐了。

### 源码对照（全部在钉定 commit 上核过）

- 三个大小常量（200/50/100）：`vllm_ascend/utils.py` L67–69 @ db701c1f，页面一致；v0.26（2ed6cbba L64–66）与 main（baa023ad L82–84）值相同，版本差异表结论成立。
- 挑值分派（dp/dynamic_eplb 精确匹配、mc2 子串匹配返回空、其余默认 200）：utils.py L1126–1149，页面第 116 行附近的描述与代码一致；mc2 分支仍构造带组名的配置、只缺缓冲字段，页面这条辨析正确（L1118–1123）。
- DP 公式（(规模+1)×int32 向上取整再与 50 取大）：utils.py L1152–1163，页面 calc 与代码一致。
- 注册表键（成员、后端、配置、复用域；Options 的组名字段被排除在键外但配置里含组名）：`_hccl_pg_registry.py` L26–56、L65–90，页面第 118–120 行的机制与「待核 3」的保留都对。
- 复用域（含 eplb 自成一域、mc2 自成一域、其余共用）：`patch_distributed.py` L39–43，一致。
- MC2 tiling：默认 200、uint16 越界只警告并用默认、解析异常记 error（`dispatch_ffn_combine_tiling.cpp` L62–84）；实际判据 ×3 + 10 MB 而报错文案写 3MB（L284–290）——页面指出的文案与实现不一致属实，是个好发现。
- 显存分账：快照在建组前（`worker.py` L464 起，含空闲不足的报错）、可用 KV 的扣减式（L557–580）、非 torch 增量口径（`vllm/utils/mem_utils.py` L263–268），页面均一致。
- 上游组名（world/tp/dcp/pcp/pp/dp/ep）与 mc2、dynamic_eplb、细粒度 TP、FlashComm 组的建组条件：两仓 parallel_state 核过，表格的组清单与成员描述成立。

### 数字复核

650 M ÷ 7.969 MiB = 81.6→82 块、82×640 = 52,480、占 3,855 块约 2.1%、1,250 M 合计与「150 多个块」——算术全部复算无误；7.969 MiB、3,855 块、640 token/块 均链接到双机部署页的唯一推导出处，本页只做折算，符合「数字只引用不重推」的约定。

### 问题清单

- **P1（1 条）第 76 行附近（表格 dp 行）与第 92 行附近**：dp 行把「每步同步两机还有没有活干」写成这条 HCCL 组的职责，但第 79 行自己又说那次 2 元素存活同步走 CPU（gloo）通道，前后矛盾；且按源码（`model_runner_v1.py` L713–722）2×DP 的 int32 元数据归约默认也走 CPU 组，只有 `dp_allreduce_on_npu` 为真才走这条 HCCL 组，而该开关默认 False（`ascend_config.py` L317）、底稿 01 §841 也明确写了默认走 CPU。改法：dp 行职责改为「为 DP 元数据归约预留；默认该归约走 CPU 通道，开 `dp_allreduce_on_npu` 才走这条组」，第 92 行附近补一句默认路由并与第 79 行、底稿 01 对齐。缓冲 50 M 照留这一点不受影响。
- **P2**：无（除 P1 外未发现机制或数字错误）。
- **P3（3 条）**：
  1. 第 79 行附近：把「三类按开关才建的组」写成「三个组」，且其中细粒度 TP 是四个组、FlashComm 侧除 FlashComm2 外还有一个受 `multistream_overlap_gate` 控制的组未提；FlashComm2 的建组条件是开关函数而非「规模配 0」。建议改成「三类」，并把条件说法与代码对齐。
  2. 第 157 行附近：「8 个组的配置值合计 1,250 M」——mc2 组没有该字段，实际是 7 个组的字段之和；建议写「除 mc2 外 7 个组」。
  3. lint 的 mark-flood 提示：内联标记 33 处超 30，建议合并相邻标记降到阈值内。

### 锚点与工具

出链四个锚点（双机页三个、expert-parallel 一个）目标标题都存在；入链 4 处（cann-hccl、collective-communication、kv-cache-memory-profiling、index）都能解析，其中带锚点的一条与本页标题 slug 一致。两个图 spec（yaml+svg）都在。`pnpm wiki:lint` exit 0（本页仅 mark-flood 提示）、`pnpm wiki:audit` exit 0（本页 18 条来源有效）。

### 打分

**7.5 / 10**。机制主体、常量、公式、分账口径、版本对照、数字折算全部核实无误，「常见误解」「待核」两节的克制值得保留；扣分在 dp 组职责的前后矛盾（P1）与三处小疵。P1 改法很小，改完可到 8.5。

### 审查覆盖说明

全文各节均已读到（跳过 frontmatter sources 正文明细、代码块内文与命令块，按纪律未读）；源码核对均在钉定 commit 上用 git show 完成；无读取被拦情况。

## P5 修订记录（09-29）

- **P1（dp 组职责矛盾）已修**。独立核实依据（钉定 commit db701c1f，git show，只记位置）：`vllm_ascend/worker/model_runner_v1.py#L713-L722`（DP 元数据归约的通道选择与开关分支）、`vllm_ascend/ascend_config.py#L317`（开关默认值为 False），与审查结论一致。改动三处：表格 dp 行职责改为「为 DP 元数据归约预留；默认走 CPU 通道，开 `dp_allreduce_on_npu` 才走这条组」（页面第 76 行）；第 79 行状态同步句加「默认」；第 92 行补默认路由与开关一句。两处源码位置已加入「源码位置」表（第 179 行），50 M 照留不动。
- **P3-1 已修**（第 79 行）：「三个组」改「三类组」；补上 FlashComm 一侧受 `multistream_overlap_gate` 控制的第二个组；条件说法与代码对齐——细粒度 TP 四个组按各自规模配 0 不建（`distributed/parallel_state.py#L135-L150` @ db701c1f），FlashComm2 由开关函数决定（同文件 L153），`multistream_overlap_gate` 组见同文件 L104。
- **P3-2 已修**（第 157 行）：「8 个组的配置值合计 1,250 M」改为「除 mc2 外 7 个组」。
- **P3-3 已修**：内联标记 33 → 24 处。做法：版本差异表 v0.23 行去掉 5 个与「源码位置」表重复的标记；证据索引段把三连标记按「一个论断一枚」收敛（回退、三版一致改为指向对应小节/表格，被去掉的标记在各自论断处仍有落点）；为 DP 代入取下限这条本页推导补 1 枚 [D]。收敛后 [C] 占比 79%，同时满足 mark-flood 的总量与占比两条规则。
- **检查**：`pnpm wiki:lint` exit 0、`pnpm wiki:audit` exit 0，输出中 grep 本页 id 均无告警（audit 里只出现在统计行，来源 18 条有效）。
- **读取情况**：无被拦。

## P5 复审（09-29）

独立复审（只审不改），不依赖修订者结论，源码自查。

### P1 独立核实

- `vllm_ascend/worker/model_runner_v1.py` L713–722 @ db701c1f：DP 元数据归约构造 2×dp_size 的 int32 张量，通道按 `dp_allreduce_on_npu` 分支——False 走 `get_dp_group().cpu_group`（CPU），True 走 `device_group`（NPU/HCCL）。
- `vllm_ascend/ascend_config.py` L317 @ db701c1f：开关默认 False。
- 维护分支 2c59ff10 同逻辑（model_runner_v1.py L694–699、ascend_config.py L317），行为一致。
- 结论：修订者「dp 组为 DP 元数据归约预留、默认归约走 CPU、开 `dp_allreduce_on_npu` 才走该组」成立，与我独立核实一致，无分歧。

### 页面两处改动

diff 五个 hunk 全读。表格 dp 行、第 79 行（加「默认」）、第 92 行（补默认路由与开关）三处说法已统一，无残留矛盾；配合第 92 行「只发几个 int32」的解释，初学者可读。

### P3 抽查（3/3 落实）

1. P3-1：「三个组」已改「三类组」，细粒度 TP 四组按各自规模 >0 才建（parallel_state.py L142–149 @ db701c1f，otp/lmheadtp/emtp/mlptp 核实）、FlashComm2 由 `flashcomm2_enable()` 决定（L153）、`multistream_overlap_gate` 组（L104）——三处行号自查属实。
2. P3-2：第 157 行已改「除 mc2 外 7 个组」。
3. P3-3：版本差异表与证据索引段的标记已收敛，本轮 lint 输出中本页 0 条 mark-flood。

### 检查

`pnpm wiki:lint` exit 0（本页无告警）；`pnpm wiki:audit` exit 0（本页仅统计行，来源 18 条）。

### 结论

**通过，8.5 / 10**。P1 修订依据与改法均独立核实成立，三条 P3 按首审改法落实，未发现新问题。读取全程无被拦。
