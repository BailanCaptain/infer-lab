# P5 写作记录（GPT-6 Astra，10-04）

页面：[vllm-ascend-for-rl](../../../../wiki/concepts/vllm-ascend-for-rl.md)。官方篇名为 **vLLM-Ascend for RL**，取 kebab-case `vllm-ascend-for-rl`；动笔前用 `rg --files wiki/concepts -g '*vllm-ascend-for-rl*' -g '*reinforcement*'` 查重，无命中。另搜 RL、rollout、强化学习、训推、权重同步、rl_config，找到的是其他专题的零散内容，没有同主题完整页。

## 范围与结构

本次只新建本页、两张图的 YAML / SVG、本记录；未编辑其他作者页面，未修改 src/、scripts/wiki/standard-pages.json、docs/plans/，未提交 git。正文生产方式为直接写作，无 raw 快照，按当前 schema 如实设 `origin: direct`。

按用户共同要求及 docs/wiki-writing-standard.md 阅读 TP、EP 样板后组织：

1. 一句话说明 RL 的训练端与 rollout 推理端分工，首屏放生成—评分—训练—同步循环图。
2. 从换权重的版本边界解释暂停的必要性；三种真实暂停模式及其等待/样本损失代价。
3. 同物理卡 NPU IPC 与跨物理卡 HCCL 的区别；只演算发送方加接收方的通信组计数，不引用 GLM 的显存数字冒充 RL 效果。
4. 概率记录、Router Replay、tokens-only、工具调用、DP 路由；训推一致与批不变分别解释、链接既有专题。
5. GLM 固定在线服务逐 token 走读，说明未配置训练端、sleep 和权重同步，以及扩展成 RL 仍需验证的条件。
6. 常见误解后收束到源码区，固定五个 H3：怎么开、会报什么错、开销和什么时候别开、版本差异、源码位置。

首图 `vllm-ascend-for-rl-cycle` 为 860×460；源码流程图 `vllm-ascend-for-rl-update` 为 880×830。两图均为手写 figure spec，使用仓库 renderFigure 生成 SVG，无动画。只渲染本人的两张图，避免全量生成命令写到其他写手尚未完成的图。

流程图把主线第 2 站暂停、第 4 站换权重及第 5/7 站生成返回连接起来，start 后先进入 update，再分流至 HCCL / NPU IPC 后端，完成后 finish、resume；错误分支停止更新。

## 对照的官方文档与源码

下表全部经本轮本地 `git show <commit>:<path>` 阅读，不以浮动 main 替代固定版本。路径相对于对应上游仓库，行号是页面 sources 中的定位。

| 证据 | 文件与行号 | 核对内容 |
|---|---|---|
| Ascend main `baa023ad` | `docs/source/user_guide/feature_guide/rl.md:1–60` | 官方篇名、rollout 分工、统一开关与两种部署 |
| 同上 | 同文件 `62–197` | sleep 两阶段唤醒、IPC/HCCL、start/update/finish、暂停模式与 keep 跨版本风险 |
| 同上 | 同文件 `199–240` | logprobs、prompt_logprobs、R3 编码、三维形状与最后 token 缺路由 |
| 同上 | 同文件 `242–367` | 批不变、tokens-only、工具调用、DP 请求头及不存在的 router 命令 |
| 同上 | `docs/source/user_guide/configuration/additional_config.md:236–299` | 全部默认值、环境变量保留、旧键迁移、可信开发端点 |
| 同上 | `docs/source/user_guide/feature_guide/batch_invariance.md:1–59` | 源码构建须配置批不变算子；wheel 安装不能补编译 |
| GLM 教程 `0576b647` | `docs/source/tutorials/models/GLM5.3-Flash.md:248–341` | 双机实际启动命令，无 RL / sleep / 权重传输设置 |
| Ascend main `baa023ad` | `vllm_ascend/ascend_config.py:262–292` | RlConfig 四字段默认 false；apply 关闭 NZ、清 allocator 选项、启用开发端点 |
| 同上 | `vllm_ascend/worker/worker.py:296–358` | 状态机、NZ 检查、后端调用及逐字报错 |
| 同上 | `vllm_ascend/distributed/weight_transfer/hccl_engine.py:30–209` | 发送方/接收方编号、DP 偏移、普通与 packed 接收、逐层重载 |
| 同上 | `vllm_ascend/distributed/weight_transfer/npu_ipc_engine.py:153–222` | start/finish 为空操作、物理卡句柄匹配、模型装载 |
| 同上 | `vllm_ascend/platform.py:1340–1382` | expandable_segments 清理、FA3 配置守卫、MLA/SFA 拒绝、安装检查 |
| 同上 | `vllm_ascend/distributed/weight_transfer/__init__.py:24–40` | Ascend 后端及 NPU IPC trainer 工厂注册 |
| GLM `db701c1f` | `vllm_ascend/worker/worker.py:282–374,681–694` | 旧更新逻辑；提供配置才创建权重引擎 |
| v0.23 `2c59ff10` | `vllm_ascend/worker/worker.py:282–374` | is_checkpoint_format 默认 true，旧 NZ 环境变量检查、同步与后处理 |
| v0.26 `2ed6cbba` | `vllm_ascend/worker/worker.py:268–364` | 相同旧接口与检查逻辑 |
| v0.23 / v0.26 | 各自 `vllm_ascend/patch/platform/patch_weight_transfer_engine.py:18–73` | nccl / ipc 工厂映射到 HCCL / NPU IPC |
| v0.23 / v0.26 | `vllm_ascend/ascend_config.py:150–165` / `165–177` | 旧 top-level extra cleanup 默认 false |
| 上游 vLLM main `84030bbe` | `vllm/entrypoints/serve/dev/rlhf/api_router.py:29–80` | pause 是查询参数，abort 为默认值，keep 忽略 clear_cache |

补充核对：

- `git ls-tree -r --name-only` 在两个维护快照未发现 `feature_guide/rl.md`，但都存在 RL 示例与权重后端；相应 ascend_config 中没有 RlConfig / rl_config。页面明确区分“没有统一入口”和“没有 RL 能力”。
- `git diff 2c59ff10 db701c1f -- vllm_ascend/worker/worker.py` 的差异在显存日志，不在本页引用的更新方法；没有把 GLM orphan 当成维护分支。
- v0.23 创建引擎条件在 worker 第 694 行，v0.26 在第 736 行，main 在第 837 行，均按 weight_transfer_config 是否存在判断。
- RL 指南的批不变段强调 COMPILE_CUSTOM_KERNELS；专门构建指南另要求构建时设置 VLLM_BATCH_INVARIANT，正文采用完整条件。
- 逐字错误文本均放源码区，附 commit、文件和行号，没有把说明性 warning 当成异常。

## 信息清单与跨页回链建议

新页没有旧版可迁移。搜索范围包括 wiki/concepts、wiki/params、wiki/sources，并检查了 wiki/index 与 raw 命中；raw 是证据快照、index 是派生入口，不改其句子。以下是本轮找到的已有读者页内容，行号按本轮磁盘快照记录。**这些页面一律未修改，交主会话统一处理。**

| 页与行 | 已有信息 | 本页成为 RL 组合说明出处后的处理建议 |
|---|---|---|
| `concepts/ascend-patch-system.md:205` | 强化学习权重同步只有配置后才用到 | 保留一句，给“权重同步”加本页链接 |
| 同页 `277` | main 删除旧权重同步 patch | 保留 patch 变更事实，链接本页版本表解释仍有权重传输能力 |
| `concepts/attention-backend-family.md:9` | 训推一致检索别名 | 保留，不迁移别名 |
| 同页 `183` | FA3 训推场景、性能及模式限制 | 保留后端专属事实；可给训推用途加本页链接 |
| 同页 `196` | main 的 RL 训推一致开关门槛 | 保留精确后端选择条件，给统一配置加本页链接 |
| 同页 `222` | 该页证据索引中训推用途 | 保留原证据，不用跨页链接取代来源 |
| `concepts/batch-invariance.md:221` | RL 配置经 apply 设置批不变环境变量 | 保留批不变的局部行为，统一 RL 默认值说明改为链接本页 |
| 同页 `238` | RL rollout 是使用场景之一 | 保留一句，加 rollout 链接 |
| 同页 `253` | main 多一个 rl_config 入口 | 保留简表，链接本页统一配置及版本表 |
| `params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md:131` | RL 重建配置时清理缓存 | 属于参数自身的缓存生命周期，保留；不并入本页 |
| `params/enable-sleep-mode-extra-cleanup.md:7,10,38,61,73` | 摘要、别名、sources、relation 涉及 RL 配置 | 保留参数的检索与证据字段；后续可增至本页的 relation |
| 同页 `85,87,91` | 同卡训练争显存、旧键迁移、GLM 未开 | 保留 extra cleanup 的机制；RL 总体交接及 GLM 上下文可压成一句加本页链接 |
| 同页 `99,101,103,107` | 迁移、生效条件、sleep 前置和同/跨卡模式 | 参数专属守卫及前置保留；同/跨卡整体选择链接本页 |
| 同页 `114` | RL 循环、两种 sleep level | 循环改为一句加本页链接；sleep 细节归 sleep-mode 页 |
| 同页 `129` | RL 总开关三项副作用及 warning | 本页统一说明副作用，参数页可改为摘要加链接；保留对本参数生效条件的说明 |
| 同页 `137,151–157` | 两个布尔键必须同时启用、同卡配置示例 | 保留本参数最小示例，完整 RL 配置入口链接本页 |
| `wiki/index.md:122` | extra cleanup 的自动摘要 | 不手工改，后续按派生流程处理 |

并行新写的 sleep_mode、netloader、Ai_QoS 不作为已有材料覆盖或改写。当前本页对 sleep 内存只解释交接所需的边界，不重复其分配器实现。RL 权重传输与 netloader 的启动装载是不同生命周期；本页没有把二者合并。

## 逐项覆盖与自查

- [x] 官方 overview、统一开关、两类设备部署。
- [x] sleep / weight transfer / pause 的职责与顺序，level 2 先权重后 KV。
- [x] IPC 物理卡前提，HCCL 组含训练端，DP 编号偏移，参数元数据及 packed 条件。
- [x] logprobs / prompt_logprobs、R3 的编码与少一个 token 原因、tokens-only 实验性。
- [x] agentic RL 工具环境和 DP 请求路由；未虚构 serve router 或 dp-routing-config。
- [x] batch invariance 与 training consistency 分开，源码构建要求及性能取舍。
- [x] GLM 固定服务未启用的命令和引擎创建证据，改作 RL 所缺条件。
- [x] 三快照差异、GLM orphan 区分、逐字报错与文件行号。
- [x] 两张静态图、主线挂靠、正文零角标、固定五 H3、页末待核。

实际自查修正：relations 的 kind 改用 schema 允许的 builds-on；流程图避免把后端接收画在 update 调用之前；图脚注移出与下一框标题碰撞的位置；把部分否定式/模糊表述改为明确条件，保留 keep 跨版权重与模型支持边界。没有为了密度指标删除待核。

写作标准度量采用仓库 `checkStandard`，直接对本页调用，不改强制名单。字数按汉字逐字、英文单词计数，去掉链接地址和围栏代码；“全文”含源码区但不含 frontmatter。

| 项目 | 结果 |
|---|---|
| 教学正文 | 2870 字 |
| 含源码区全文 | 4871 字 |
| 教学正文行内代码 | 1 处，0.35/千字 |
| 含源码区全文行内代码 | 52 处，10.68/千字 |
| calc | 1 块，教学正文 0.35/千字；无相邻表/calc |
| 首图 | Markdown 第 50 行；图前部署数字 0、calc 0 |
| 证据标记 | 教学正文 0；全文 22，其中 C 15、S 7，C 占 68.2% |
| 免责/不确定句检测 | 教学正文 2/93，2.15% |
| 源码标题、图先行、图宽 | checkStandard 全部通过，problems=[] |

图工具针对源码流程图出现的函数名给出 advisory；该图就在“对照源码”中，且符号绑定钉住源码，保留这些名称用于读源码。脚注提示为非阻塞 advisory，画布溢出/遮挡检查为 0。不存在动画元素。

## 验证、限制与交接

在本机 PowerShell 上 `pnpm.ps1` 被执行策略拦截，实际使用 `pnpm.cmd`，未修改系统策略。每次保存页面后均运行 wiki:lint；并行编辑期间曾遇到其他页面临时重复 YAML key、图 tone、relation enum 问题，本页没有越权修这些文件。最终三检结果在本节末尾登记。

`pnpm.cmd check:content` 退出码 0，但该命令检查的是现有 registry（输出 139 页），不是本新页已进入目录的证明。本轮不运行 wiki:build，避免写 src/ 与其他派生文件。

遵照用户明确分工：未启动服务，未访问 5193/8790，未截图，未做浏览器阅读；浏览器与独立审查交给审查员。这里记录的是作者自查，不冒充独立审查结论。作者自查未发现尚未处理的本页 P1 疑点。

待核：真实 NPU 完整 RL 循环、更新耗时/显存；GLM W8A8 权重分片与量化元数据同步验收；外链网络可达性。一次 raw GitHub 联网读取返回 cache miss，正文证据实际来自本地钉住仓库，不声称外链已经通过。

**toc 建议：** serving 下新增“RL 与权重更新”分组，本页作为入口，与 sleep-mode 相邻；从 batch-invariance 和 attention-backend-family 通过 relations 引入。本轮不改 toc.ts。

**Open Questions：** 无需用户决定；上述实机与浏览器验证按分工留给后续验收。

### 最终三检

2026-10-04，正文与两张 SVG 最后一次修改后运行：

| 命令 | 退出码 | 关键输出与边界 |
|---|---|---|
| `pnpm.cmd wiki:lint` | 0 | `ok wiki:lint 通过`；4 条非阻塞 mark-flood 提示来自其他页，本页无报错 |
| `pnpm.cmd wiki:diagrams --check` | 0 | `ok wiki:diagrams 298 张图与 spec 一致`；本页两图无非法 spec、遮挡、溢出或派生差异 |
| `pnpm.cmd wiki:audit` | 0 | 全站 142 页、3719 条来源；本页 22 条引用全部行号有效，图符号校验通过；invalid commit、缺文件、行号越界、未知仓库均为 0 |

另行对本页调用 `checkStandard`，没有 skip，结果 `problems=[]`。因此“本页写作标准通过”不是依赖它尚未加入强制名单而得出的结论。wiki:audit 输出的“正文 10462 字”是包含 Markdown 标记、链接和代码的字符串长度，与上表 4871 字的可读文字统计口径不同。

## 审查（10-04）

独立审查员（Opus 5.5），只审不改页面。审查对象：`wiki/concepts/vllm-ascend-for-rl.md`（已直接发布，工作区未提交）。

**结论：8.5 / 10。P1 0 条，P2 3 条，P3 2 条。audit 通过。**

### 1. 初学者测试（只读前两屏）

一句话：RL 让训练端按评分改权重，vLLM-Ascend 负责用当前权重生成训练样本；换权重必须先暂停生成，代价是等待或丢弃在途请求，再加上传输、装载和后处理的时间。

前两屏能自足地讲清「是什么 + 为什么要暂停 + 代价在哪」，第一屏是问题式 H2 + 加粗一句话定义 + 循环图 + 解数学题的具体例子，没有一上来就演算，也没有堆 GLM 数字。学习顺序（是什么 → 为什么 → 怎么做 + 示意演算 → 细节 → GLM 双机 → 常见误解 → 对照源码）通过。GLM 数字只出现在第六节及之后，符合「GLM 不进基础节」。

### 2. 核心概念逐条核（对照钉住源码与官方文档，均本轮实读）

官方文档：`tools/repos/vllm-ascend`（main `baa023ad`）`docs/source/user_guide/feature_guide/rl.md`（367 行）、`configuration/additional_config.md`、`feature_guide/batch_invariance.md`。

| 页面处 | 结论 | 依据 |
|---|---|---|
| L62 三种暂停模式、abort 为默认、clear_cache 对 keep 无效 | 对 | rl.md:180–198；`tools/repos/vllm/vllm/entrypoints/serve/dev/rlhf/api_router.py:32–45`（`mode` 默认 `"abort"`，`clear_cache` 为 Query 且标 DEPRECATED、`Ignored when mode="keep"`） |
| L76 level 1 备份权重到 CPU / level 2 丢弃、先唤醒 weights 再 kv_cache | 对 | rl.md:56–60、66–69 |
| L78 通信组含训练端、worker 编号计入 DP 偏移 | 对 | `hccl_engine.py:150–158`（`worker_rank = dp_rank * world_size_per_dp + rank_within_dp`，`rank = worker_rank + init_info.rank_offset`） |
| L82–87 calc：1 发送 + 2 接收 = 3，接收编号 1、2 | 对，且明确标「教学示意…与 GLM 双机卡数无关」 | 同上；`rank_offset` 注释即「trainer is rank 0, workers start at rank 1」 |
| L89 普通路径逐个广播后释放临时张量、packed 减少调用 | 对 | `hccl_engine.py:194–208`（`broadcast(..., src=0)` 后 `load_weights` 再 `del weight`；packed 走 `packed_broadcast_consumer`） |
| L89 NPU IPC 按物理设备标识查句柄、「同机」不等于「同卡」 | 对 | `npu_ipc_engine.py:63–90、200–210`（UUID = `{host_ip}-{physical_chip_id}`，不匹配时报 `not co-located on the same physical NPU`） |
| L95 prompt logprobs 不支持流式 completions | 对 | rl.md:218 |
| L97 R3 形状 `(num_tokens - 1, num_layers, num_experts_per_tok)`、最后一个 token 无路由、base64 NumPy | 对，逐字一致 | rl.md:227–236 |
| L99 tokens-only 为实验接口、`/inference/v1/generate`、请求含 request_id / token_ids / sampling_params | 对 | rl.md:261–296 |
| L101 DP 指定走请求头、没有 `vllm serve router` / `--dp-routing-config` | 对 | rl.md:328–346（原文明确「does not provide」） |
| L105 训推一致 = FA3，需额外软件包，不能用于 MLA / 稀疏 | 对 | `platform.py:1357–1372`（`key != (False, False)` 时 `raise ValueError("FA3 backend does not support MLA and SFA.")`，并检查 `flash_attn_npu_v3`） |
| L107 批不变字段为 false 时保留已有环境变量 | 对 | `additional_config.md`（`When false, an existing VLLM_BATCH_INVARIANT environment setting is preserved`） |
| L113 GLM 官方启动命令无 RL / sleep / 权重传输；提供配置才建引擎 | 对 | `0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` 启动段只有 DP/TP/EP、量化、投机等参数；`db701c1f:vllm_ascend/worker/worker.py:681`（`if self.vllm_config.weight_transfer_config is not None:` 才 `create_engine`） |
| L119 打开 RL 总开关会改布局与分配器配置；GLM 的 MLA/稀疏会被 FA3 拒绝 | 对 | `ascend_config.py:274–292`（`apply()` 仅 enabled 时强制 `weight_nz_mode=0`、`_disable_expandable_segments()`、置 `VLLM_SERVER_DEV_MODE=1`）；GLM 为 KDA + 稀疏 MLA（见 glm-5-3-flash 页层型表） |
| 报错原文 5 条 + NZ 新旧两段 | 全部逐字一致 | main `worker.py:296–300、322–325、339–340、309–316`；`hccl_engine.py:184–185`；`platform.py:1365`；旧原文在 `2c59ff10` / `db701c1f` `worker.py:295–301`、`2ed6cbba` 同文件 `285–291`，三处文本确实都是 `Please set VLLM_ASCEND_ENABLE_NZ=0.` |
| 版本差异表 | 口径正确 | `2c59ff10` / `2ed6cbba` / `db701c1f` 三个快照均无 `feature_guide/rl.md`、无 `RlConfig`（`git ls-tree` + `grep` 实测）；`2c59ff10:worker.py:303` 的 `start_weight_update(is_checkpoint_format: bool = True)` 对比 main 第 318 行无参数，表述属实；`2c59ff10:ascend_config.py:163` 确有 top-level `enable_sleep_mode_extra_cleanup` 默认 false |
| GLM 提交定位 | 正确 | 页内明写 `db701c1f` 是含模型代码的独立提交、不属于 v0.23 维护分支，没有把 orphan 当维护分支 |

**没有虚构部署数字**：全页唯一的数值演算是标注为「教学示意」的 3 参与者通信组；GLM 一节只说「未启用」并给出命令与建引擎条件，没有把主线数字当成 RL 效果，待核项（真机循环耗时、W8A8 分片与量化元数据同步）明确留白。**没有把推断写成定论**：FA3 拒绝、NZ 校验、建引擎条件都带源码位置。

### 3. frontmatter 与工具链

- `origin: direct`（L43），无 `rawSources`，符合 10-04 新规；页头 chip 实测显示「直接撰写」。
- `pnpm wiki:audit` 退出码 0：审计 142 页 3827 条来源，本页 22 条引用行号全部有效，无效 commit / 文件不存在 / 行号越界 / 未知仓库均为 0；「写作标准：名单 100 页，达标 100 页」。
- 本页按名单口径单独跑 `checkStandard`（不改名单）：`2870 字 · 行内代码 0.3/千字 · 角标 0 · 对照源码 ✓ · calc 0.35/千字 · 相邻块 0 · 图先行 ✓ · 免责 2.2% · 图宽 ✓`，`problems: []`。即入达标名单后也能通过。
- `pnpm wiki:lint` 退出码 0（4 条既有非阻塞提示，均不在本页）。
- 五个 H3 齐全且顺序正确：怎么开（132）/ 会报什么错（168）/ 开销和什么时候别开（194）/ 版本差异（200）/ 源码位置（214）；版本差异节内 v0.23、v0.26、main 三个标识齐全。
- 浏览器只读实测（Playwright，桌面 1440×900，用用户已在跑的 5193，未起停服务）：首屏截图 `scratchpad/vllm-ascend-for-rl-review-first.png`，标题、定义、循环图、chip 均正常，console 无 error；图内「rollout: 用模型生成训练样本」等标注无遮挡（放大图 `rv1004-rl-zoom.png`）。页面无分镜动图。

### 4. 问题清单

**P2-1｜全库零入链，页面成孤岛（位置：全库）**
`grep -rn 'vllm-ascend-for-rl' wiki/ src/` 只命中本页自身；`src/content/wiki/toc.ts` 无本页，按 `toc.ts:221` 的兜底落入「新增教学页（待编排）」。写手在本记录「信息清单与跨页回链建议」里已列出 batch-invariance、attention-backend-family、ascend-patch-system、enable-sleep-mode-extra-cleanup 四处该回链的位置（按分工没动他人页）。
改法：本轮由主会话按该表给上述四页加一句 + 链接，并在 toc.ts 的 serving 下建「RL 与权重更新」分组（与 sleep-mode 相邻）。改标题前后跑 `pnpm wiki:lint`。

**P2-2｜「为什么需要」这一层偏薄（位置：L54–57 与第二个 H2）**
第一节讲完「是什么」后直接跳到「为什么换权重要暂停」，而官方 Overview（rl.md:12–20）列的六项 RL 对推理端的要求——不重启就换权重、让出显存、暂停生成、返回概率与路由、免重复分词、结果可复现——在正文被拆散到第三、四、五节才零散出现。初学者读完前两屏知道「为什么要暂停」，但不知道「为什么这页要同时讲这么多东西」。
改法：第一节末尾或第二节开头加 3–4 行，用一句话把「RL 循环对推理端提出哪些要求」列齐，再说明下文按这些要求逐条展开；不必加数字，不要变成链接堆（避开基础标准第 14 条）。

**P2-3｜sleep 的分工与外链（位置：L76）**
第三节用整段讲了 level 1 / level 2 与两段式唤醒，并把「更完整的内存生命周期」指向 GitHub 上的官方 `sleep_mode.md`。站内 sleep-mode 专页正在待审队列里；一旦批准发布，这里就构成两页重讲，外链也应换成站内链接。
改法：sleep-mode 页批准后，把 L76 的 level 1/2 细节压成一句（「同卡训练常让 rollout sleep 让出显存；两级的区别与唤醒顺序见 sleep-mode」），外链改为站内链接。本页保留「交接边界」这一视角即可。

**P3-1｜章节挂靠读起来不对（位置：frontmatter L7 `chapters: ["17"]`）**
页头 chip 实测显示「17 · 量化与 speculative decoding」，与 RL 无关。同章现有 lora、structured-output 也是挂靠性质，所以不算错配到孤例；但相关页（sleep-mode 草稿、netloader-guide、enable-sleep-mode-extra-cleanup）都在 19「性能与工程优化」。建议随 toc 编排一并改到 19。

**P3-2｜一处把「自动一致」写成了「要保持一致」（位置：L89）**
原文说 packed 路径「发送端和接收端的缓冲配置要一致」。源码里 `packed_buffer_size_bytes` 与 `packed_num_buffers` 随 `update_info` 由发送端下发、接收端直接取用（`hccl_engine.py:194–201`），不存在两端各自配置、需要人工对齐的情形。
改法：改为「打包参数（缓冲大小与缓冲个数）随更新信息由发送端下发」。

### 5. 跳过了什么

- 按纪律未读 frontmatter 的 sources 区（来源由 wiki:audit 校验）、HANDBOOK、docs/plans/。
- 核对 batch invariance 的 wheel / 源码构建条件时被安全分类器中断一次，该线索未继续；页面 L166 的表述与我已读到的 `batch_invariance.md:30–56`（`COMPILE_CUSTOM_KERNELS=1 VLLM_BATCH_INVARIANT=1` 源码构建、预编译 wheel 不含 csrc）一致，未发现问题，但这一条只核到这里。
- 未核外链的联网可达性（写手亦已声明）。
- 未跑 `pnpm wiki:diagrams --check`、`typecheck`、全量 test（本轮只审内容；写手记录显示上述命令退出码 0）。

## 修订记录（10-04）

本轮修订 4 条：P2-2、P2-3、P3-1、P3-2。没有判为不成立的意见；P2-1「零入链与未进 toc」按用户分工留给主会话，未改其他页或 toc。

- **P2-2：补足动机。** 第二节先沿解数学题的循环解释：新参数要及时接回推理端、反复重启有初始化代价、同卡训练需要让出显存；再解释原始 token ID、概率与专家记录、批次变化下数值可复现的用途，最后接回暂停的版本边界与代价。六项要求均保留，依据本轮重读的 `baa023ad:docs/source/user_guide/feature_guide/rl.md:12–20`；没有添加部署实测数字。
- **P2-3：明确单一出处。** 同卡段保留 IPC 的物理卡前提与句柄装载，sleep 部分压成一句，链接现有 `enable-sleep-mode-extra-cleanup.md#为什么存在`（本轮确认标题及两级解释存在）。去掉此段的 level 1/2 与分阶段唤醒详述及外链；表格、误解与源码区保留交接边界所需的简述和调用顺序。sleep-mode 批准后，应将此链接改为 `sleep-mode.md` 页面级链接；若改用节锚点，须按批准后的实际标题复核，当前不预造锚点。
- **P3-1：** frontmatter 的 chapters 从 17 改为 19，与性能和工程优化归类一致；未修改 toc。
- **P3-2：** 改为发送端随更新信息下发缓冲大小与个数，接收端直接取用。本轮对照 `baa023ad:vllm_ascend/distributed/weight_transfer/hccl_engine.py:187–201`，确认两个参数来自 update_info，无需两端人工分别配置。

**信息保留自查：** 3 种暂停模式及 keep 风险、IPC/HCCL 分工与参与者计数、packed 机制、数据接口、GLM 未启用的依据、版本表、报错与待核项均保留。重复的 sleep 细节改由现有链接承载；没有删除实机验收缺口。

**检查证据：** 页面每次保存后运行 `pnpm.cmd wiki:lint`，均退出 0（4 条既有非阻塞提示，均属其他页）；`pnpm.cmd wiki:diagrams --check` 退出 0，299 张图与 spec 一致；`pnpm.cmd wiki:audit` 退出 0，全站 142 页、3827 条来源，四类无效来源计数均为 0。本页 22 条引用无报错。针对本页直接运行 checkStandard，不依赖强制名单，最终 `skip=[] / problems=[]`：教学正文 3130 字（汉字逐字、英文按词），行内代码 1 处、0.32/千字，calc 1 块、0.32/千字，正文角标 0，免责句 2/97（2.06%），表/calc 相邻 0。首图仍为 Markdown 第 50 行，图前部署数字及 calc 均为 0，两图宽 860/880px。

按共同要求未启动服务、未访问 5193/8790、未截图；本轮为内容修订与静态自查，未重复浏览器验收。原有 NPU 实测和 GLM 训推联调待核项不变。无需用户决定的问题：无。
