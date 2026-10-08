# ascend-config-system 审查记录

## P5 写作记录（2026-09-28，第 04 批深改）

**改了什么。** 按「先直觉、后数字」重排为九节：三个入口是什么 → 为什么不合成一路、代价在哪 → JSON 怎样被拆成八组子配置 → 三路撞在一起时的优先级 → 构造与平台两道改写 → 落到 GLM 双机 → 排查顺序 → 常见误解 → 对照源码（五个 H3 齐全）。正文 1,851 字增到约 10,400 字（教学正文约 4,700 字，源码区约 5,700 字）。

**图。** 新增直觉图 `wiki/diagrams/config-inputs.yaml`：三路输入（命令行通用参数 / additional_config / 环境变量）各自的落点，环境变量分成「喂进配置的兼容输入」和「消费者直接读」两股，两股汇到平台校验与改写，再到执行时读到的值；图上标出只有直接读环境那一路绕过校验。重写 `wiki/diagrams/config-flow.yaml` 为代码流程图：解析参数 → 建总配置 → 平台校验与改写 → 每个 Worker 进程各建一份 → 各处来取，右侧展开「缓存能不能复用」的分支与构造期报错。

**数字与出处。** 双机参数取自底稿 [01 §0 全局常量](../../01-deploy-entry-schedule.md) 与 [§A0 怎么走的](../../01-deploy-entry-schedule.md)，页面只写结论并链接 `glm-5-3-flash-two-node.md#部署前提`、`#关键参数各管哪一步`；默认分支（采样归约、词表投影规模、FlashComm1、采样验证两开关）引用[来源基线](../../../../wiki/sources/glm-5-3-flash-baseline.md)。按任务要求，启动命令与成排环境变量都没有整块搬进页面，完整命令链接部署页与教程。

**核实了哪些核心概念（全部对照 `vllm-ascend@db701c1f` 与 `vllm@0fc695fc` 源码片段）。**

- 八组子配置的取出位置与类名：`ascend_config.py#L27-L94`、`#L318-L332`。
- 兼容映射共九对（不是旧版说的两条互不相通的路，也不是 GPT 版说的两组）：`_get_config_value` 的九处调用点与 `#L333-L346` 的键存在判断。
- 单例：模块级 `_ASCEND_CONFIG`，复用需要「已有 + 通过完整性检查 + 未传 refresh + 绑定同一个 VllmConfig」四条，`#L878-L925`。
- 平台：四个校验在 `init_ascend_config` 之前，建完按 PD 角色重置重算调度，`platform.py#L450-L480`、`#L676-L695`。
- 上游语义：`additional_config` 是给平台的不透明字典且整段进编译缓存 hash，上游自己也往里写键，`vllm/config/vllm.py#L355-L363`、`#L476-L486`、`vllm/engine/arg_utils.py#L2223-L2230`。
- 三版差异逐项核：v0.23 `db701c1f`、v0.26 `2ed6cbba`、main `baa023ad`（pydantic `extra="forbid"`、环境变量表 21/20/14 条、平台校验 4/2/1 个、main 已无环境变量回退）。

**纠正的两处过度概括。**

1. 旧版「环境变量不进配置对象、两条路互不相通」，以及由此推出的「全大写去 envs.py 找、小写去 ascend_config.py 找」判断规则：钉住版本上九个字段两边都认，且键名与环境名不一一对应（`weight_nz_mode` ↔ `VLLM_ASCEND_ENABLE_NZ`）。
2. 旧版与 GPT 版都把「未识别的键静默忽略」当通则：`eplb_config` 自己遍历用户字典，遇到不认识的键抛 `ValueError: Config has no attribute`。新版按层级和子配置类分别说明。

**不丢信息勾选。** 旧版（`0f97c8b`，p4 重写前最后一版）逐条清单与勾选结果见会话 scratchpad `p5/ascend-config-system-facts.md`：A1–A17 全部落地，其中 A4、A6 按源码证据纠正，A17 的 Qwen 两卡例子按主线换成 GLM 双机、结论保留。

**单一出处。** 进程边界、fork/spawn 继承、每类进程的入口表只链接 `engine-processes.md#补丁和配置为什么要每个进程各做一遍`；patch 只链接 `ascend-patch-system.md`；平台校验族只链接 `npu-platform.md#校验与改写怎样影响执行`；KV 与容量数字不在本页重算。

**验证。** `pnpm wiki:diagrams`（174 张图与 spec 一致）、`pnpm wiki:lint`（本页无报错）、`pnpm check:content`（通过）、`pnpm wiki:audit`（本页 30 条来源全部定位成功）。写作标准逐项实测：行内代码 0.9/千字、对照源码之上角标 0、calc 0、表与 calc 不相邻、图先行、免责 0.0%、图宽 ≤900。按本轮任务书未起服务、未截图，浏览器验收留给审查环节。

**仍待核。** 见页末「待核」三条：缺镜像内启动日志、教程是文档提交而非镜像代码、main 的子配置构成与默认值未逐项核。

## P5 审查（09-28）

独立审查员，只审不改。读文件严格串行。**跳过的段**：frontmatter 来源清单（L9–L39，由 `pnpm wiki:audit` 校验）；「## 对照源码」正文（L164–L259）按模板只做 grep 核对，未逐行读；代码块与成排环境变量未整段读。没有读取被拦。

**评分：8.5 / 10。**

### 初学者测试（只读前两屏）

昇腾的开关有三个地方能写：命令行通用参数、启动命令附带的一段 JSON、环境变量。那段 JSON 是上游留给平台的口子，上游只原样存下、不检查里面的键，所以键名或层级写错在钉住的两个发布分支上通常不报错，安静走默认值——代价就是「以为开了，其实没开」。第一屏的定义句和直觉图足够说清这件事。

### 核心概念（全部对照 `vllm-ascend@db701c1f` / `vllm@0fc695fc` 逐条核）

写手纠正的两处过度概括**都成立**：

1. **九对兼容映射、键名与环境名不一一对应**：`ascend_config.py` 里 `self._get_config_value(` 共 9 处调用（L82 / L88 / L171 / L177 / L189 / L195 / L201 / L207 / L253），`weight_nz_mode` ↔ `VLLM_ASCEND_ENABLE_NZ`（L249–L254）、`msmonitor_use_daemon` ↔ `MSMONITOR_USE_DAEMON`（L198–L202，确实无昇腾前缀）。判断规则「键在不在字典里」见 `_get_config_value` L336–L339（`if config_key in additional_config`），所以显式写 false 能盖掉环境的开启值——页面 L94 与 L96–L101 的真值表正确。
2. **「未识别键静默忽略」不是通则**：`EplbConfig.__init__` L832–L838 遍历用户字典，`else: raise ValueError(f"Config has no attribute '{key}'")`。对照组也核了：`ProfilingChunkConfig`（L719–L733）、`RejectionSamplerConfig`（L775–L782）用 `.get()` 静默，`AscendCompilationConfig.__init__` 带 `**kwargs`（L588–L595）吞掉未知键。页面 L70 说「只有个别子配置自己查了一遍」、L160 按层级和版本分说，成立。

其余逐条核过、均正确：八组子配置的取出位置（L37–L56 七组 + L331–L332 采样验证）；缓存复用四条件与「未通过完整性检查只警告、不更新缓存、仍返回新对象」（`init_ascend_config` L894–L910）；`get_ascend_config` 未初始化抛 RuntimeError（L921–L925）；环境变量表 21 条、其中 9 条带 `VLLM_ASCEND_` 前缀、构建期变量 5 条、`__getattr__` 每次访问重读（`envs.py` L118–L122）；上游把 `additional_config` 声明为不透明字典并整段进编译缓存 hash（`vllm/config/vllm.py` L360、L478–L486），上游自己写入 `gdn_prefill_backend`（`arg_utils.py` L2226–L2227）；构造期检查（profiling 分块要求 pp>1 见 L168–L173、与均衡调度互斥见 L198–L202 前的 ValueError、最小块裁到 token 预算见 L58–L68）；平台四校验在 `init_ascend_config` 之前、PD producer 侧重置重算调度只警告、既非 producer 也非 consumer 抛 ValueError（`platform.py` L462–L475、L680–L695）；Worker 侧调用点在注册算子之后、`super().__init__()` 之前（`worker/worker.py` L118–L126）。

**写手自报的三版数字全部复核通过**：`_get_config_value` 调用数 9（db701c1f）/ 8（2ed6cbba：顶层 6 个 + `scheduler_config` 里仅 `enable_balance_scheduling` 带环境名，L979–L985；`recompute_scheduler_enable` L986–L991 不带，所以页面 L217 写「顶层 6 个加均衡调度」正确）/ 0（baa023ad，函数已不存在）；envs 表 21 / 20 / 14；建配置前的平台 `_validate_*` 4 / 2 / 1。

### 「教程没传 --additional-config」

成立，两条独立证据：来源基线 `wiki/sources/glm-5-3-flash-baseline.md` L132 明写「教程未传 `--additional-config`」；教程原文 `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` 里 `additional` 出现次数为 0，四处 `vllm serve` 命令块也没有 `export VLLM_ASCEND_*`。底稿 01 §0 全文不含 additional（底稿 L262 另记了「没读完整命令块」的口径）。四条默认分支逐条核对基线 L132 与源码，全部正确：`enable_reduce_sample=False`（L320）、`lmhead_tensor_parallel_size=0`（L512）、`enable_flashcomm1` 环境默认 0（`envs.py` L75）、`enable_block_verify` / `enable_entropy_verify=False`（L778–L779）。`enable_sp()` 的旁路也核了：`utils.py` L905–L924 只在调用方传 `enable_shared_expert_dp=True` 时强制置真，而该字段本身默认 False（L114–L118），所以「返回假」的结论在默认命令下站得住。

### 优先级

与源码一致。页面的三层说法——通用参数各进总配置字段、JSON 键归 AscendConfig 拆分、环境变量分「兼容输入」与「消费者直接读」两股——对应 `_get_config_value` 的键优先、`envs.__getattr__` 的每次重读，以及平台阶段的改写。页面 L105「建对象那一刻定住 vs 每次重读」和 L152 的排查结论都正确。

### 有没有丢信息

`git diff -- wiki/concepts/ascend-config-system.md`（216 增 / 40 删）只看删除行：旧版六个 H2 全部有对应落点（配置是数据 → L54/L68；怎样读取扩展配置 → L82；可计算的优先级例子 → L90；进程内配置对象如何产生 → L107/L119；解析之后还有约束 → L107–L113；从症状回到配置链 → L147）。旧清单抽查 6 条：A6 命名判断法（新版 L103、L157 降级为线索并说明为何不可靠，属纠正）、A7 复用四条件（L119 全在）、A8 时机型报错（L121）、A9 只警告不更新缓存（L119 末句）、A11 平台四校验 + 链接 npu-platform（L113）、A17 旧 Qwen 两卡例子换成 GLM 双机（L123 节）保留「一个开关都没配」的结论。删掉的六条源码引用在新 frontmatter 里有等价或更细的替代（platform.py 五段、worker.py、envs.py 三段、arg_utils.py 两段）。未发现丢信息。

### 链接与单一出处

页面 10 个链接目标全部可解析：`engine-processes.md#补丁和配置为什么要每个进程各做一遍`（L203）、`engine-processes.md#进程怎么摆直接决定要打哪些补丁`（标题在 L238 带中文逗号，按 `src/content/wiki/anchors.ts` 的 `headingSlug` 去标点后一致）、`glm-5-3-flash-two-node.md#部署前提`（L49）/`#关键参数各管哪一步`（L74）/`#启动时发生了什么`（L245）、`npu-platform.md#校验与改写怎样影响执行`（L47）、`ascend-patch-system.md`、`../sources/glm-5-3-flash-baseline.md`，页内 `#怎么开` `#会报什么错` 均存在。单一出处三项都做到了（patch → ascend-patch-system、进程 → engine-processes、部署参数 → two-node#部署前提）。全库 grep 本页 id：无任何页面用锚点指向本页，重排 H2 不会断链。

### 工具

- `pnpm wiki:audit`：通过。本页 30 条来源全部 ✓（行号有效、无越界、无无效 commit）。全库 133 页、1911 条来源。本页**不在** `scripts/wiki/standard-pages.json` 的强制名单里，写作标准只统计。
- `pnpm wiki:diagrams --check`：175 张与 spec 一致；本页新增一条提醒（见 P3-3）。
- 自测写作标准：正文（L52–L161）行内代码 7 个 / 约 12.4 千字 ≈ 0.6 per 千字，远低于 13；calc 0 个；「对照源码」之上无证据角标（角标集中在 L250 的归档段，位于源码节内）；五个 H3 齐全且顺序正确；版本差异表含 v0.23 / v0.26 / main。

### P1

1. **L111 字段错位，且同页「词表投影」指两个不同字段。** 页面写「细粒度 TP 里输出投影和词表投影那两个字段，要求同时打开重算调度」。源码 `ascend_config.py` L152–L160 的断言条件是 `oproj_tensor_parallel_size > 0 or embedding_tensor_parallel_size > 0`，**不包含** `lmhead_tensor_parallel_size`（两个字段在 L512、L513 是分开的）。而本页 L130 用「词表投影」指的正是 `lmhead_tensor_parallel_size`（基线 lmhead=0）。读者照 L111 排查会去查错字段，也会与 L130 自相矛盾。改法：L111 写成「输出投影（`oproj_tensor_parallel_size`）和词嵌入投影（`embedding_tensor_parallel_size`）」，并与 L130 的词表投影（`lmhead_tensor_parallel_size`）明确区分。

### P2

2. **八组子配置全页不给键名，读者无法回到源码。** L84 只给中文名（xlite 图、图编译、算子融合、细粒度 TP、EPLB、权重预取、profiling 分块、采样验证）。全页 grep 只出现 `eplb_config` 与 `scheduler_config` 两个键名，`rejection_sampler_config`、`finegrained_tp_config`、`profiling_chunk_config`、`weight_prefetch_config` 等在正文和「对照源码」里都没有。这与 L86 自己的要求（「只能看源码里它是从哪个字典取的」）打架，也违反「有固定英文名的术语用英文原名」——尤其把 rejection sampler 译成「采样验证」（L84、L132、L235–L236），拿这个词搜源码为零结果。改法：L84 每组后补键名，rejection sampler、finegrained TP 用英文原名 + 首次中文解释。
3. **`config-flow` 图仍在传播被纠正的过度概括。** `wiki/diagrams/config-flow.yaml` L13 的框写「新建 AscendConfig / 逐键取，未识别键忽略」，而本页正文的第二处纠正就是「这不是通则，EPLB 会抛 ValueError」。读者先看图，图文互相打架。改法：改成「多数未识别键忽略」，或在该框标出 EPLB 例外。

### P3

4. **L136–L143 重述 two-node 的参数与推导。** L138 把显存预算公式又写了一遍，L140 做了 32×4=128 的二次推导。按「数字只在单一出处推导」，这两处宜只留结论与链接。
5. **术语先用未讲**：L142 的 MTP、L131 的 FlashComm1、L84 的 xlite 首次出现无解释也无链接（同页对 EPLB、pipeline parallel、PD 分离都给了中文解释，标准不一致）。
6. **`config-inputs` 图上出现代码名 `additional_config`**，`pnpm wiki:diagrams --check` 因此新增一条提醒。取舍：这个名字就是本页主题，可考虑图上改用「启动命令附带的那段 JSON」、把键名放进 caption（caption 里已有）。
7. **L252 两个「9」并列易混**：「兼容映射九对」与「环境变量 21 条中 9 条带昇腾前缀」是两批不同的名字（映射里的 `MSMONITOR_USE_DAEMON` 不带前缀；带前缀的 9 条里有一条没参与映射），并列写会被读成同一批。

### 本轮未核

- 「对照源码」节正文（L164–L259）按模板只做 grep 核对，五个 H3、顺序、版本差异三版覆盖、九对环境变量清单（9 个名字与源码完全一致）已核，其余论述未逐句核。
- v0.26 / main 的子配置完整构成与默认值只核了环境回退与校验计数，未逐项核（页末「待核」已自承）。
- 未在浏览器实际打开本页（本轮为源码与文本审查，任务书未要求起服务）。

## P5 修订记录（2026-09-28，按上面的 P5 审查改）

**P1（断言字段错位）已改。** 先在 `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py` 核原文：L152–L161 的条件是 `finegrained_tp_config.oproj_tensor_parallel_size > 0 or ...embedding_tensor_parallel_size > 0`，不含 lmhead；L511–L513 三个字段确实分开，`lmhead_tensor_parallel_size` 只被 `utils.py` L877–L878 的 `lmhead_tp_enable()` 消费。改了三处：正文第一道构造期检查改为「注意力输出投影（`oproj_tensor_parallel_size`）或词嵌入（`embedding_tensor_parallel_size`）大于 0」并补上「这两处跨 DP 通信需要各 rank token 数一致」的原因（源码注释 L143–L152），明写 LM head 不在这条约束里；「会报什么错」的 `AssertionError` 一条同样改成两个字段名；GLM 双机那节原来说「细粒度 TP 的词表投影规模是 0」，改成「LM head 的规模是 0，跟着整体 TP 走」，与构造期约束不再混。

**P2-1（八组子配置没有键名）已改。** 「JSON 进来以后被拆成什么」原来只有一行中文名，改成八条列表，每条以键名开头：`xlite_graph_config`、`ascend_compilation_config`、`ascend_fusion_config`、`finegrained_tp_config`、`eplb_config`、`weight_prefetch_config`、`profiling_chunk_config`、`rejection_sampler_config`，并写清七组在构造函数开头取（L37–L55）、rejection sampler 在 L331 单独取。自造译名「采样验证」全部去掉，改用 rejection sampler 原名 + 一句中文解释（投机解码里核对草拟 token 的那一步）并链接 speculative-decoding；fine-grained TP 同样给英文原名 + 中文解释。各组的职责按类定义核过：`XliteGraphConfig` L661–L678、`AscendCompilationConfig` L579–L596、`AscendFusionConfig` L643–L660（钉住版本只有 `fusion_ops_gmmswigluquant` 一项）、`FinegrainedTPConfig` L505–L515（五个字段默认 0）、`WeightPrefetchConfig` L685–L701（attn / moe / mlp 三档比例）、`ProfilingChunkConfig` L704–L732（docstring 写明启动时量 prefill 耗时、拟合二次模型）、`RejectionSamplerConfig` L775–L782。「源码位置」表里三行也换成键名（`finegrained_tp_config`、`rejection_sampler_config`），顶层开关补了 `enable_reduce_sample`。

**P2-2（图文矛盾）已改。** `wiki/diagrams/config-flow.yaml`：「逐键取，未识别键忽略」→「逐键取，多数组静默」，报错框补 sub「EplbConfig 还拒未识别键」，caption 也写明「多数组静默走默认值，只有 EplbConfig 那一组会报错」，并加了 `ascend_config.py#L828-L876` 的 pin 作为该说法的出处。`pnpm wiki:diagrams` 已重新生成 config-flow.svg。

**P3 一并改了四条。** P3-4：删掉显存预算公式与 32×4=128 的二次推导，六条通用参数只留结论，推导指回 two-node 的两个锚点。P3-5：MTP 首次出现补「Multi-Token Prediction，模型自带的多 token 预测层，这里拿来草拟候选」+ 链接；FlashComm1 补「vllm-ascend 对序列并行的实现」+ 链接；Xlite 补「openEuler 的图执行库，开启后平台换用 Xlite 专用 Worker」（`platform.py` L656–L658）；LM head 在首次出现处解释。P3-6：`config-inputs.yaml` 图上的 `additional_config` 换成「附带的那段 JSON」（sub 改为「键名归昇腾定义」），键名保留在 caption，`pnpm wiki:diagrams` 对这张图的代码名提醒已消失。P3-7：证据段把两个「9」拆开说——兼容映射九对里有一对环境名不带昇腾前缀，带前缀的 9 条里也有一条没参与映射（自行数过两张名单，与审查一致）。

**验证。** `pnpm wiki:diagrams`：175 张，更新 2 张，本页两张图零提醒零报错；`pnpm wiki:diagrams --check`：175 张与 spec 一致；`pnpm wiki:lint`：通过，本页 0 条（全库另有 19 处待留意，都在别的页）；`pnpm wiki:audit`：通过，本页 30 条来源全部有效（正文 13787 字 / 9 节）。正文行内代码 19 处 / 约 12 千字，远低于 13 per 千字。未起服务、未截图（浏览器验收留给审查环节）。

**仍待核。** 审查「本轮未核」那三条照旧：「对照源码」节正文未逐句核；v0.26 / main 的子配置完整构成与默认值只核了环境回退与校验计数；本页未在浏览器实际打开。

## P5 复审（09-28）

快速复审，只核上一轮 P1、P2 的修订是否落实。读文件严格串行、未启动子代理，每次读源码不超过 20 行；未读「对照源码」正文，也没有读取被拦。

**评分：9 / 10。**（上轮 8.5）

### P1：落实

- 源码：`vllm-ascend@db701c1f:vllm_ascend/ascend_config.py` L152–L161 的条件是 `oproj_tensor_parallel_size > 0 or embedding_tensor_parallel_size > 0`，而且没打开 `recompute_scheduler_enable` 时抛 `AssertionError`。条件里不含 lmhead，报错信息写的原因是跨 DP 的 HCCL 集合通信要求各 rank 的 num_tokens 一致。L511–L515 五个字段默认都是 0。
- 正文 L122：落实。两个字段名都写对了，也写了原因（各 DP rank 的 token 数要一致），并单独写明「LM head 那个字段（`lmhead_tensor_parallel_size`）不在这条约束里」。
- 报错清单 L205：落实。写的是 oproj 或 embedding 大于 0 时要求 `recompute_scheduler_enable=true`，并单独列出「`lmhead_tensor_parallel_size` 不受这条约束」。
- GLM 默认值 L141：落实。改成「LM head 的规模是 0，跟着整体的 TP 走」，和构造期约束不再混在一起；默认值 0 与 L512 一致。本页已经没有「词表投影」这个说法（grep 结果为 0）。

### P2：落实

- 八组子配置的键名：落实。L86–L93 共八条，每条以键名开头，逐个和源码对得上：L37/40/43/46/49/52/55 取出七组，L331 取出 `rejection_sampler_config`。本页 grep「采样验证」为 0。
- config-flow 图：落实。`wiki/diagrams/config-flow.yaml` L13 的 sub 是「逐键取，多数组静默」，L14 是「EplbConfig 还拒未识别键」，L3 的 caption 写明「未识别的键在多数组里静默走默认值，只有 EplbConfig 那一组会报错」。已核：`class EplbConfig` 在 L812，L832–L838 遇到未识别键会 `raise ValueError`。SVG 已重新生成，含「多数组静默」；`pnpm wiki:diagrams --check` 175 张一致，这两张图（config-flow、config-inputs）没有提醒。

### 新发现

- 没有新的 P1 或 P2。
- **P3（同类残留）**：L77 表格「JSON 容器里的键」一行的第三格写的是「钉住的两个分支静默忽略，走默认值」，没提 EPLB 例外。紧挨着的上一段 L70 写的是「多半不报错……EPLB 那一组就会直接报错」，表和段落口径不一致。改法：把这一格改成「多数静默走默认值，`eplb_config` 那一组报错」，与 L225、L208–L209 保持一致。

### 验证

- `pnpm wiki:audit`：退出码 0，通过。本页 30 条来源、正文 13787 字 / 9 节；来源里只有 URL 未联网验证的提示，全库都一样。全库没有无效 commit、没有不存在的文件、没有行号越界。
- 本轮未核：「对照源码」正文，以及浏览器实测。这两项上轮就没核，这次照旧。

## P5 修订记录（09-28，和 npu-platform 对齐平台校验数量）

- **改了什么。** 「版本差异」表「建配置前的平台校验」一行，main 列原写「一个（索引器与 pipeline parallel 相关的那个）」，改为「三个：一个类方法（索引器与 pipeline parallel）加两个模块级函数（投机 + DCP、并行）」，并链接 [NPU 平台的版本差异](npu-platform.md#版本差异)。v0.23「四个」、v0.26「两个」不变。
- **自报口径更正。** 上文写作记录与复核里的「平台校验 4/2/1」只数了 `_validate_*` 类方法，漏了 main 上的两个模块级函数；按「建配置前跑的校验」口径应为 **4 / 2 / 3**，与 npu-platform.md 第 72、198 行一致。
- **核对。** `vllm-ascend@baa023ad:vllm_ascend/platform.py`：`check_and_update_config` 起于 L457，L476 `cls._validate_indexer_pp_config`、L478 `_validate_draft_decode_context_parallel_config`、L479 `_validate_parallel_config`，L492 才 `init_ascend_config`。页面「源码位置」表已引 L457–L495，覆盖这三行，不用改。
- **验证。** `pnpm wiki:lint` 通过，本页 0 条；`pnpm wiki:audit` 本页无 ✗，全库唯一失败在 gap-a5164fe10fa9184412f8，与本页无关。未起服务、未截图。

- **v0.23 列表头复核（09-28）：改了。** 原表头写「v0.23 列核自镜像 db701c1f，在 2c59ff10 上是否逐项相同未核」，把 db701c1f 混进 v0.23 列。已按 `git diff db701c1f 2c59ff10` 核实：ascend_config.py 只差 2c59ff10 新增的采样归约两条 ValueError（L320–L339），envs.py 无差异，platform.py 只差 L596 起的编译开关复位、不在 L450–L480 的四个校验里。表头改为「v0.23 列 = 2c59ff10，db701c1f 单独注明、只有它含 GLM 模型代码与配置 patch」，表内各行对 2c59ff10 成立，未改。
