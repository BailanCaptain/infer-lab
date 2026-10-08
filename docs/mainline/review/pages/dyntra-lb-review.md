# dyntra-lb 审查记录

## P5 写作记录（2026-09-29，第 15 批，Opus 写手）

### 改了什么

- 整页深改。旧版有两份：p4-checkpoint（与改前现版相同，正文约 4.7k 字符）和 P4 重写前最后一版 c60c4fa（约 19.1k 字符，以 Qwen3.6-35B-A3B 为例）。新版正文约 30.3k 字符（含源码区），源码区之上约 19.5k 字符。
- 结构按「是什么 → 为什么 → 怎么算 → 细节 → GLM 双机 → 常见误解 → 对照源码」：
  1. DyntraLB 是什么（一句话定义 + 示意例子 + 机制直觉图）；
  2. 为什么需要（MoE+DP 两处会合、两种等待；与 EPLB、Balance Scheduling 分工表；三样代价）；
  3. 怎么算（块数、失衡两种量法 calc、四步规划、收尾）+ H3 吞吐账 calc；
  4. 计划怎样落地（准备候选、互报向量、各自算计划；代码流程图）；
  5. 暂停、抢占、预取三种状态（对象/粒度、KV 块、恢复条件表）——对应本批验收要点「缓存池与换出区分对象、粒度和恢复条件」：DyntraLB 暂停不还块、不换出；真抢占收回并重算；预取先占块；另注明开 recompute 调度时抢占改走存走 KV 的路；
  6. 什么时候生效（dynamic/static、第 250 步按波次、阈值单位是块、四个启动前提 + MoE 暗门）；
  7. GLM 双机（本部署没开也开不了；场景 M 对照；块数尺子在 GLM 上偏得更多；「一块」可能只有 4 token 待核；暂停与抢占的差别用 B3 数字对照）；
  8. 常见误解 7 条；9. 对照源码五个 H3。
- EPLB 关系：第二节用时间线图标出「dispatch 前各组自己的那段（DyntraLB / Balance Scheduling）」与「combine 前专家那段（EPLB）」，配三行对照表；基础概念（MoE、EP、DP、PD、KV 块、All-Gather）一句话 + 链接，不重讲。
- 图：`dyntra-lb.yaml` 重画（仿 balance-scheduling 的①②③三栏：各组块数 → All-Gather 同一张表 → 下一步 DP1 换人、DP0 冻结，加按比例的负载长条）；新增 `dyntra-lb-bubble.yaml`（两组一步 decode 的时间线，括号标出两个机制各管哪段）；新增 `dyntra-lb-flow.yaml`（EngineCore 每步一圈 + 全局有活时的四步，含生效/不生效分支与「下一步执行」虚线，带 pins）。三张图都用 Playwright 打开 SVG 文件截图自查过（没起服务）。参考图库看了 amd-10-hi（DP+EP：注意力各卡各算、AllToAll 会合），借「注意力阶段不通信、会合点在 dispatch」的讲法；分镜动图按 09-29 暂停令未用。
- frontmatter：标题改为 DyntraLB 官方名；summary ≤200 字；aliases 补官方全称；sources 30 条全部重钉；relations 改写理由；updated 2026-09-29。
- 角标：源码区之上 0 个；全页 28 个（C 21 / S 5 / D 1 / I 1，C 占 75%）。

### 数字出处

- 01 §B1：场景 M（DP0 6,048 token、DP1 28 token，两组都按 6,048 宽前向；差距来自 prefill 新请求）；本部署没有 kv_transfer_config。
- 01 §B3：一条约 67,000 token 的请求被抢占还掉 120–121 块、约 9 步重算、KDA 状态丢失；只作「暂停 vs 抢占」状态对照，不当 DyntraLB 收益。
- 01 §0「block_size 五种含义」：逻辑块 640、indexer 状态组块 4、EngineCore 在 KV 初始化后把 cache_config.block_size 改成最小组块（GLM 上 4）——推出「GLM 上 DyntraLB 的一块可能只有 4 token、700 块≈2,800 token」，标为待核（main 上 GLM 组布局未核）。
- GLM 层数（34 KDA + 11 稀疏 MLA + MTP）、主 attention 每查询至多 2,048 位置、indexer 随历史变长：取自 glm-5-3-flash、attention-cost 页，只链接不重算。
- 页内示意数（128/1/64 块、131/4 → 131/67、失衡 63.5 → 32、吞吐账 355.3/328.8/311.2 每 10⁶ 时间单位、20000÷19.2≈1,042 块、700 块在 128/32/2,048 token 块下的等价）按源码公式现算，均标「数为示意」。
- 本部署未启用、不虚构 GLM 效果数字；吞吐、时延、代理相关性、跨机两组、与 MTP/async/EPLB 同开，全部列在页末「待核」。

### 核心概念对照了什么

- vllm-ascend@baa023ad：`core/dyntra_lb_scheduler.py`（块数、预取与候选、计划落地、准入、暂停与抢占）、`patch/platform/patch_dyntra_lb_core.py`（planner 全流程：fill → increase swap → decrease swap → drop、抵消、freeze；缓冲区、add_request 长请求检测、run_balance_load、all_gather 打包）、`patch_engine_core.py`（引擎类替换 if/elif）、`platform.py`（五道 ValueError、调度器类选择）、`ascend_config.py`（默认值、校验、只认 scheduler_config 嵌套）、`recompute_scheduler.py`（DyntraLB 版 recompute 调度器共用同一 mixin）、官方说明 `feature_guide/dyntra_lb.md`（适用前提含「吞吐优先于本地顺序」、单机要求、阈值单位、两步流水、不是保证、排障步骤、与投机解码/async 需验证）。
- 上游 vLLM v0.29.0（98dff2a8，main 配套，依据 main 历史里「升级到 vLLM v0.29.0」提交）：MoE 才建 DPEngineCoreProc、step_counter 每步加一与波次清零、nnodes_within_dp 定义、KV 初始化后改写 block_size；v0.23.0（0fc695fc）：`_preempt_request` 收回全部块、进度清零，block_size 改写。
- 版本：2c59ff10、db701c1f、2ed6cbba 整仓 `git grep -i dyntra` 为空；baa023ad 有。`lb_newly_added` 在 baa023ad 只有单元测试设置，上游 v0.26.0、v0.29.0 均无。

### 与旧版的差异（纠正与取舍）

- 旧 P4 版说「nnodes_within_dp 不能简化成所有 DP rank 同一主机」，旧 c60c4fa 版说「同一组 DP 副本必须在一台机器」：官方文档要求「所有 DP 组在一台机器」，代码检查只拦「一组跨机」。新版两层都写清，并指出「两组分两台」检查拦不住但不受支持。
- 旧 c60c4fa 版说 `dyntra_lb_config` 写到顶层「是配置错误、不会打警告照样生效」，措辞含糊；新版按 `extra="forbid"` 写成「配置校验时报错」。
- 旧版漏了 planner 第 0 步「先补空位」（fill_running_from_waiting），新版补上；旧版「让最轻的变重」没说挑哪一对，新版写明按「离新平均值最近」挑。
- 吞吐账从 3.553e-4 这类写法改成「每 10⁶ 时间单位完成的条数」，数值等价。
- Qwen3.6-35B-A3B 专属数字（块 2048、26 万 token = 128 块、默认阈值 = 1,433,600 token 永远到不了）：主线模型已换成 GLM，改成不点名的通用示意（「每块 2,048、上下文上限 262,144 的模型最多 128 块，默认 dynamic 永不启动」）；deepseek_v4 的 32 块同样改成「每块 32 token 时 22,400」。patch_mamba_config 改大块的说明被 GLM「一块是多少 token」一条取代。

### 旧版信息清单勾选

清单：旧会话 scratchpad `p5/dyntra-lb-facts.md`（O1–O51、P1–P10）。

- 保留（新版可找到）：O2–O8、O10、O11、O13、O15–O31、O33–O51；P1–P10。
- 改写保留：O1（26 万 token 长对话 → 128 块示意长对话）、O9/O14/O32（模型名去掉，数值关系保留为通用示意）、O12（改为「只数 token 占几块、不看块里存什么」，并在 GLM 节落到 KDA 固定状态）、O45（顶层键实为校验报错，已纠正）。
- 删除：无。

### 自查

- 首屏：问题式 H2 + 一句话定义 + 示意例子 + 直觉图；图前无 calc、无 GLM 数字。
- 每节 calc ≤1（两处 calc 分属 H2 与 H3），表与 calc 不相邻。
- 写作标准测量（checkStandard 单页跑）：源码区之上行内代码 0、角标 0、免责句 2.1%，无问题项。
- `pnpm wiki:lint`：本页 0 报错。最后一次运行时整体因别页 `recompute-cpu-offload.md` 与 `kv-cache-cpu-offload.md` 的 alias 重复（dup-alias）报错，非本页，未动。
- `pnpm wiki:diagrams --check`：257 张图一致，本页三张无报错、无提醒。
- `pnpm wiki:audit`：通过；本页 30 条来源行号全部有效。
- 跳过：知乎参考 403 打不开（图库已记录），未读；未起服务、未做页面浏览器验收（留给审查）。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，只审不改页面；未开子代理）。

### 结论

- **分数：8.5 / 10。** P1 0 条，P2 2 条，P3 7 条。
- **学习顺序：通过。** 是什么（问题式 H2 + 一句话定义 + 128/1/64 块示意例子 + 直觉图）→ 为什么（MoE 通信点两处会合，与 Balance Scheduling、EPLB 分工表，三样代价）→ 怎么算（块数、失衡 calc、四步规划、吞吐账 calc）→ 落地 / 三种状态 / 生效条件 → GLM 双机 → 常见误解 → 对照源码。第一屏和基础节没有 GLM 数字；GLM 数字只在 GLM 一节，且都注明「不是 DyntraLB 的效果」。
- **初学者测试（只读前两屏）：** DyntraLB 是 PD 分离 decode 端几个 DP 组每步互报各请求的 KV 块数、下一步在本组内暂停轻的/接纳重的请求，让各组注意力那段读的历史接近，少在 MoE 通信点等最重的组；它管注意力那段，EPLB 管专家那段，Balance Scheduling 只数条数；代价是被暂停请求变慢、每步多一次互报、预取先占块、块数只是估计。——能说清。
- **audit：本页通过**（30 条来源行号全部有效，全库 `ok wiki:audit`）。`pnpm wiki:lint` 通过（10 处待留意均非本页）；`pnpm wiki:diagrams --check` 257 张一致。
- **别名：无重复。** 用脚本扫全库 frontmatter 的 id / title / aliases，本页 7 个别名在其他页零命中；eplb 页别名是 EPLB / Expert Parallelism Load Balancer / 专家负载均衡 / dynamic_eplb / log2phy / 冗余专家，data-parallel 是「前端负载均衡」，large-scale-ep 是「外置 DP 负载均衡」，都不冲突。
- **注水 / 重复：无大段注水。** 约 6 倍是相对 p4-checkpoint（4.7k 的压缩版）；相对 P4 前的 c60c4fa（正文 19.1k），新版正文 19.8k（源码区之上）+ 10.8k（源码区），新增内容都是有出处的机制细节（先补空位、按离新平均值最近挑、抵消与冻结、候选预取上限、两种模式、四道启动检查、MoE 暗门、三种状态对照表、GLM 上尺子偏差）。MoE / EP / EPLB 只一两句 + 链接，没有重讲。小重复：「暂停不还 KV、预取先占块」在 159 行和误解 196 行几乎同句（P3-6）。

### 核心概念逐条对照（vllm-ascend@baa023ad，上游 vLLM 见各条）

| 页面说法（行） | 源码 | 判定 |
|---|---|---|
| 块数 = ceil(已有 token ÷ 块大小)，块大小取 cache_config.block_size（93） | `core/dyntra_lb_scheduler.py#L41-L52`（`len(all_token_ids)` 向上取整） | 对 |
| 失衡两种量法：阈值 ≥1 用 最重−平均，<1 用 (最重−平均)/最重；默认 5.0（95） | `patch/platform/patch_dyntra_lb_core.py#L132-L138`；`ascend_config.py#L1363-L1373` | 对 |
| 先补空位、按排队顺序不看轻重（107） | 同文件 `#L164-L173`，但只在循环前调用一次 `#L267-L268` | 对，措辞见 P3-1 |
| 最轻组找「running↔更重候选」、挑离新平均值最近且比原来更近的一对（108） | `#L175-L199`、`#L276-L280` | 对 |
| 最重组同样找更轻候选（109）；两边都没换才考虑停一条（110） | `#L286-L293` | 对 |
| 停一条的吞吐账 20000 + 19.2×最重块数，吞吐 = 全组 running 条数 ÷ 时长，严格更高才停（116） | `#L201-L237` | 对 |
| 停止条件：失衡低于门槛或本轮无动作，最多 1000 轮（105） | `#L127`、`#L271-L302` | 对 |
| 同组同块数一出一进抵消；无「进」的组冻结（112） | `#L304-L320` | 对 |
| 计划在「全局还有没有活」为真后算，下一步开头执行（131、133） | `#L454-L470`；`dyntra_lb_scheduler.py#L250-L289` | 对 |
| 候选：waiting / PREEMPTED 且 KV 已到；预取上限 2×上限−running（139） | `dyntra_lb_scheduler.py#L171-L248`（上限 `#L175`） | 对 |
| 互报向量长 2×上限+2，末两格 = running 条数、新长请求标志；DP1 = [1,1,1,1,64,0,0,0,4,0]（140） | `patch_dyntra_lb_core.py#L380-L388`、`#L472-L491` | 对（手核 10 格） |
| 按块数在 running 里找、同块数取决于先后（143）；冻结时一律不接（143） | `dyntra_lb_scheduler.py#L263-L292`（`lb_newly_added` 首轮在生产中无处设置） | 对 |
| 暂停：状态 PREEMPTED、排回 waiting 队首、KV 不还、另记集合；真抢占先划掉（157） | `#L364-L395` | 对 |
| 真抢占收回全部块、进度清零（154） | `vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L1473-L1493`（与 v0.29.0 同） | 对 |
| dynamic：>700 块触发，未激活时每步 2 个整数 All-Reduce(MAX)，256 步无新长请求关；static 仅排障（163-165） | `patch_dyntra_lb_core.py#L393-L452`；官方 `feature_guide/dyntra_lb.md#L76`、`#L106-L108` | 对 |
| 第 250 步按波次从头数（166） | 上游 `core.py` 波次结束 `step_counter = 0`（84030bbe `#L2246-L2247`） | 对 |
| 四道启动检查（D 节点 kv_consumer、DP>1、不与 Balance / profiling chunk 同开、nnodes_within_dp≤1）（169-174） | `platform.py#L984-L1012`（五个 ValueError，页面把两条互斥合成一条） | 对 |
| nnodes_within_dp 拦的是「单组跨机」，两组分两台算出 1（174） | `vllm@84030bbe:vllm/config/parallel.py#L753-L759` | 对 |
| 只有 MoE+DP 才建 DPEngineCoreProc，dense 不报错也不跑（176） | 上游 `core.py#L1319`；`patch_engine_core.py#L33-L42` | 对 |
| 与 EPLB 无互斥检查（85） | `platform.py#L984-L1012` 无 eplb 分支 | 对 |
| v0.23 / db701c1f / v0.26 没有 DyntraLB | `git grep -il dyntra` 在 2c59ff10、db701c1f、2ed6cbba 均 0 个文件 | 对 |
| 适用前提「decode 吞吐比严格保持本地顺序更重要」、不是保证、与投机 / async 需验证（87） | 官方说明 `#L19-L22`、`#L156-L157`、`#L202-L205` | 对 |

### 示意演算手算

- 平均 (131+4)/2 = 67.5，失衡 63.5；换后 (131+67)/2 = 99，失衡 32。对。
- 找换人对：DP1 原距离 |4−67.5| = 63.5；1↔64 后 |67−99| = 32 < 63.5，接受。对。
- 按源码逐轮跑例子：第 0 轮 DP1 换入 64，DP0 无候选；第 1 轮 DP1 只剩候选 1（Δ=0 不算「更重」），两边都没换，进吞吐账，两种停法都更低，退出。与页面「32 块仍高于门槛但无动作」一致。
- 吞吐账：8 ÷ 22,515.2 × 10⁶ = 355.31；7 ÷ 21,286.4 × 10⁶ = 328.85；7 ÷ 22,496 × 10⁶ = 311.17；20000 ÷ 19.2 = 1,041.7。对。
- 阈值：700×128 = 89,600；700×32 = 22,400；262,144 ÷ 2,048 = 128；700×4 = 2,800。对。

### 数字与底稿

- 场景 M：DP0 6,048、DP1 28、两组按 6,048 宽前向、差距来自 6,000 token 的 prefill —— 与 01 §B1 场景 M 表一致。
- 抢占：约 67,000 token、还 120–121 块、约 9 步重算、KDA 状态一起丢 —— 与 01 §B3（2026-09-28 更正后）一致。
- 块大小改写成各组最小值（GLM 上 indexer 组 4，而非 640）—— 与 01 §0「block_size 五种含义」一致；上游 84030bbe `core.py#L345` 仍有此改写；main 上 GLM 组布局标待核，合规。
- 页面没有虚构任何 DyntraLB 在 GLM 上的吞吐 / 时延数字；GLM 数字只用于「对照」，并明说不是收益。通过。

### 丢信息

- p4-checkpoint 旧版 5 个 H2 的内容（成本代理不是显存、两种失衡量法、131/4→131/67 算例、吞吐账、计划下一步执行与暂停保留状态、默认值与 701 块边界、启动检查与 nnodes 解释、MoE 引擎类替换、验证模型、成本与待验证项）新版全部可找到。
- facts 清单 O1–O51、P1–P10 抽查 O16、O19、O30、O36–O38、O41–O47、P3、P4、P7：均在。P7 里「长请求尾延迟是否恶化」没有单独列进待核，只被「吞吐和时延没有实测」概括（P3-5）。

### 链接与锚点

- `pnpm wiki:lint` 跨页锚点硬校验通过；全库指向本页的 6 处（async-scheduling、balance-scheduling×2、recompute-scheduler、index×2）都不带锚点，改标题无影响。

### 浏览器实测（Playwright，桌面 1440，用户预览 5193，未起停服务）

- 截图：`scratchpad/dyntra-lb-review-first.png`（第一屏）、`-fig0.png`（主图）、`-fig1.png`（时间线）、`-fig4.png`（流程图）、`-table1.png`（三种状态表）。
- 第一屏：标题、summary、别名行、问题式 H2、加粗定义、「先交代几个词」、示意例子，主图上半进入首屏。无横向滚动（scrollWidth = clientWidth = 1440）。控制台只有 4 条 502（问答后端未连，与本页无关）。
- 三张图字号清晰、不溢出；无分镜动图。

### P1（0 条）

无。

### P2（2 条）

- **P2-1　第 71 行与 `dyntra-lb-bubble` 图：把逐层发生的会合写成「一步里有两处会合」。** MoE 模型每个 MoE 层都要 attention → dispatch → 专家 → combine，一步 decode 要把这两处会合重复几十次；图题「一步 decode：先各算注意力，再一起过专家」会让初学者以为一步只过一次专家。结论不变（逐层累积仍由注意力最重的组决定）。改法：正文改成「每一层里都有两处会合，一步要把它重复一遍又一遍」，图题改成「一层（每个 MoE 层都重复一次）」或在图注里补这句。
- **P2-2　第 186 行「主 attention 每个查询最多读 2,048 个位置」与出处不符。** 02 底稿 `docs/mainline/02-forward.md` 第 439 行和 attention-cost 页第 135 行是「2,048 个选中位置 + 最多 3 个尾部位置 = 2,051 格」，2,048 是位置预算（index_topk），不是上限。结论（不随历史变长）不受影响，故记 P2。改法：写成「按 2,048 的位置预算选（上限 2,051 格，见 attention-cost）」或只说「读的位置数封顶，不随历史变长」。

### P3（7 条）

- **P3-1　第 105–107 行：「先补空位」被列成每一轮的第 1 步。** 源码只在进入循环前补一次（`patch_dyntra_lb_core.py#L267-L268`），循环里只有换人 / 停一条；若每轮都补，第 4 步停掉的那条会被立刻补回。改法：「先一次性补空位，然后一轮轮做下面 2–4 步」。流程图「补空位 → 换人 → 必要时停一条」本身没问题。
- **P3-2　「换人赚了什么」只在误解第 193 行一句带过。** 两组条数、步长都没变，初学者会问「被暂停的那条亏了，赚在哪」。建议在第 65 行后补一句：64 块那条迟早要算，趁 DP0 反正要读 131 块时算，它就不会在以后某一步自己成为最重的那组。
- **P3-3　主图第一屏就出现「All-Gather 互报块数」，正文到第 140 行才解释 All-Gather。** 建议主图图注或第 59 行加半句「（每组交一份、人人拿到全部）」。
- **P3-4　主图 DP1「下一步」的负载长条是两段同色（3 + 64），渲染成一个小圆头加一条长条，像是画坏了。** 改法：新换进来的 64 用另一色调区分，或合成一段 67。
- **P3-5　待核清单没单列 facts P7 的「长请求尾延迟是否恶化」。** 可并入第 279 行「吞吐和时延」一条，写明包括被暂停请求的尾延迟。
- **P3-6　第 159 行和误解第 196 行几乎是同一句（暂停腾不出块、预取还会提前占块、显存不够靠真抢占）。** 保留误解那条，第 159 行可只留「管不到 KV 池快满」加链接。
- **P3-7　版本口径与站内不完全一致。** 第 253 行写「main 配套的上游是 vLLM v0.29.0」（98dff2a8，依据 c173a64a4 的 Docker 升级）；expert-parallel 等 21 页按 `.github/vllm-main-verified.commit` = 84030bbe 核 main。两者对本页结论只有一处差别：84030bbe 的「全局还有没有活」改成 `dp_sync_interval`（默认 16）且第 1 步也同步（`core.py#L2264-L2267`、`config/parallel.py#L145`），流程图里「每 32 步才真跨组同步一次」只对 v0.23 / v0.29.0 成立。DyntraLB 每步照跑不受影响。建议版本差异一行补一句两种配套的区别。另：待核里「main 上 GLM 缓存组布局」可在 `baa023ad:vllm_ascend/models/glm5next/cache_config.py` 核（该文件仍有 `AscendIndexerKPoolTailSpec`，要求块大小不小于压缩比），能核掉就从待核里去掉。

（附带观察，不计分）别名「动态负载均衡」较泛，eplb 页正文用「动态 EPLB」，问答检索时可能把问动态 EPLB 的问题引到本页；relations 里 balance-scheduling 在 main 上与本特性二选一，kind 用 `alternative-to` 比 `builds-on` 更贴切。

### 跳过

- 按规则未读 frontmatter 的 sources 区（由 audit 校验）和「## 对照源码」正文，只用 grep 核了五个 H3 齐全、顺序正确、版本差异含 v0.23 / v0.26 / main。
- 未读 HANDBOOK、docs/plans/；未整份读 TERMS。
- 参考图库本页未涉及通信原语讲法的新图，未另看。

## P5 修订记录（09-29）

按「P5 审查（09-29）」逐条修订：P2 2 条、P3 7 条全部修完，附带观察 2 条也顺手改了。

### P2

- **P2-1 会合是逐层的，不是一步一次。** 第二节首句改成「每个 MoE 层里……一步里有多少个 MoE 层就等多少回」；引出时间线图那句改成「每个 MoE 层里都有两处会合……一步 decode 要走过全部层，这样的会合就重复一层又一层」。`dyntra-lb-bubble` 图题改为「一个 MoE 层：先各算注意力，再一起过专家（每层重复）」，图注补「画的是一个 MoE 层；一步 decode 里每个 MoE 层都把这一段重复一遍」。
- **P2-2 稀疏 MLA 的读取上限。** GLM 节改成「按 2,048 个位置的预算挑，连同最多 3 个尾部位置，每个查询至多读 2,051 个位置，不随历史变长」，链接 attention-cost「稀疏 MLA：一层挂三份缓存……」一节，不在本页重算。

### P3

- **P3-1** 规划步骤改为「先一次性补空位，然后一轮轮做后面三步」，第 1 步写明只在开始时做一次、第 4 步停掉的那条不会被立刻补回（`patch_dyntra_lb_core.py#L267-L268` 在循环外）。
- **P3-2** 第一节图后补一段「这样换赚在哪」：64 块那条迟早要算，趁 DP0 反正要慢时让 DP1 算，空等变干活，它以后也不会让 DP1 成为最重的组；亏的是被暂停的短问答。
- **P3-3** 第一屏例子里首次出现 All-Gather 处补「（每组交一份，结束后人人拿到全部）」。
- **P3-4** 主图 DP1「下一步」的负载长条合成一段 67，不再画成小圆头 + 长条（重新截图确认）。
- **P3-5** 待核第一条改为「吞吐和时延，包括被暂停请求和长请求的尾延迟会不会变差」。
- **P3-6** 第三种状态那节末段删去与常见误解重复的「暂停腾不出块、预取占块、显存不够靠真抢占」，只留「管不到 KV 池快满（见下文常见误解）」和 CPU offload 链接。
- **P3-7 版本口径。** main 配套上游改按站内口径 `.github/vllm-main-verified.commit` = 84030bbe 核：sources 里 MoE 才建 DP 进程、步数与波次、节点数定义、块大小改写四条改钉 `vllm@84030bbe`，新增 `dp_sync_interval`（默认 16）与已验证提交文件两条；v0.29.0（98dff2a8）的块大小改写保留为对照。版本差异段写明两处不同：跨组同步间隔（84030bbe 第 1 步和每 16 步，v0.23.0/v0.29.0 每 32 步，DyntraLB 每步照跑不受影响）；块大小改写（84030bbe 跳过不参与前缀缓存的组）。源码区「计划何时算」一条和流程图「全局还有没有活」的副标题、图注同步改为「隔若干步」（本部署每 32 步）。
- **P3-7 附带的待核。** 按建议到 `baa023ad:vllm_ascend/models/glm5next/` 核了：main 上 GLM 的缓存组是「主 MLA + 压缩 indexer 共用块号」「indexer 尾状态组」「KDA 组」；尾状态组每块 = 压缩比 4 + 投机草稿数（`kv_cache.py#L28-L42`，本部署 MTP 3 → 7），且 `prefix_cacheable = False`（`core/kv_cache_interface.py#L303-L322`）；上游 84030bbe 改写块大小时跳过不参与前缀缓存的组，注释里直接点名 GLM-5.3-Flash 的 kpool tail（`core.py#L333-L349`）。于是原来「GLM 上一块只有 4 个 token、700 块≈2,800 token」这条推断**是错的**，已改写：按 84030bbe，一块 = 全注意力组的逻辑块（本部署镜像上 640）；按 v0.29.0 发布版不跳过，一块 = 7。按 640 算，本部署上下文上限 133,120 token 一条请求最多 208 块，默认 700 块阈值够不着，dynamic 默认不会自己启动（一块超过约 190 token 都是这个结果）。原待核「main 上 GLM 缓存组布局」已核掉，换成更窄的一条「main 上 GLM 全注意力组逻辑块的具体值没实跑确认」。

### 附带观察

- 别名「动态负载均衡」改为「动态 DP 负载均衡」，避免把问动态 EPLB 的问题引过来。
- relations 里 balance-scheduling 的 kind 由 builds-on 改为 alternative-to。

### 验证

- 每次保存后都跑了 `pnpm wiki:lint`，本页始终 0 报错；最后一次整体通过（10 处待留意，都是别页的 mark-flood）。
- `pnpm wiki:diagrams --check`：257 张图与 spec 一致，本页三张无报错、无提醒；主图和时间线图重新用 Playwright 打开 SVG 文件截图看过。
- `pnpm wiki:audit`：通过；本页来源 33 条，新钉的 84030bbe、glm5next、verified-commit 各条行号有效。
- 单页写作标准测量：源码区之上行内代码 0、角标 0、免责句 2.1%，无问题项；全页角标 30 个（C 23 / S 5 / D 1 / I 1，C 占 77%）。
