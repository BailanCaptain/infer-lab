# mooncake-connector 审查与写作记录

## P5 写作记录（2026-09-29，第 16 批深改，Opus 5.5）

### 接手时的状态

- 现版与 p4-checkpoint（14591fd）相同：5 个 H2、2 张图、没有「对照源码」，证据角标都写在正文里。P4 之前的三版本版 2669d4b 更全（含对照源码五节），两版都列进了信息清单。
- 字数（wiki:audit 口径，body.length）：1,834 → 16,055（含源码区）；写作标准口径的教学正文 → 5,919 字。

### 改了什么

- 按 09-29 讲法重排：是什么（一句话定义 + 直觉图：两端对表、按层搬、完成通知）→ 为什么需要（两套块池没有共同块号：管账、换地址、发通知三件事 + 三条代价）→ 连接器插在 vLLM 哪几处（代码流程图 + 八个位置在 V1 / Layerwise 各做什么）→ 块号怎样变成地址（示意 calc：起始地址 + 块号 × 块间距，段数）→ 两边 TP 不同谁拼 KV 头（示意 calc：8 头、P TP4、D TP2）→ 完成通知与押块（含「押着的块抢占碰不到」）→ 整批拉与逐层推的时间线（示意 calc：4.5 vs 3.5）→ KV 池里的 Mooncake（按名字存取，对照表）→ 三套点对点连接器（对照表 + 角色判断差异）→ GLM 双机（没开；一 P 一 D 换算）→ 常见误解 → 对照源码五节。
- 本页重点按派活要求放在「Mooncake 连接器怎样搬 KV、与 vLLM 的对接点」：PD 分离的动机、交接停在哪个位置、GLM 各组传哪些块、641 token 少传块，都只一句话 + 链接到 pd-disaggregation；KV cache 的状态种类与大小链接 kv-cache；KV 池的查询与搬回链接 kv-pool。
- 图：`mooncake-connector` 重画为直觉图（P、D 两个块池的格子 × 3 层，中间「① 对表」「② 同层对同层」「③ 最后一层到齐」）；新增 `mooncake-connector-hooks` 代码流程图（调度器 / worker / 后台线程三条泳道，按第 2、3、4、7 站从左往右，⑤ 处分 V1 空操作与 Layerwise 入队两支）；`mooncake-layerwise` 从 JSON 改写成 YAML 时间线（V1 到齐 4.5、Layerwise 到齐 3.5）。只渲染了这三张图的 SVG（用 scratchpad 脚本只处理本页的三张，没有动别页的 SVG）；本地用 Playwright 截图看过三张图，无溢出、无重叠。
- frontmatter：标题改为「Mooncake 连接器：先对好块号，再按层搬历史状态」；summary 132 字；sources 18 → 47 条（C 43、S 4）；verified 填三版本；relations 新增 kv-cache、kv-pool（alternative-to）、large-scale-ep。aliases 未动。
- 正文角标全部移到源码区：来源索引 29 处（C 23、S 4、D 1、I 1，C 占 79%）。
- index.md 里的旧标题没动（派生文件，不在本页范围）。

### 数字出处

- 01 §B3：一条约 67,000 token 的请求每卡 120–121 块、约 956–964 MiB（经 concurrent-requests 链接引用，不重算）；「约占 P 块池 1/13」= 121 ÷ 1,577 的换算 [D]，1,577 取自 pd-disaggregation 的一 P 一 D 换算（其出处为部署页单机 8 卡列）。
- 02 §1.1、§1.4：12 层 MLA（含 MTP 第 45 层）、34 层 KDA；每块号 8,355,840 B（经部署页链接）；MLA 潜向量 TP 间复制、KDA 按头切（经 kv-cache 链接）；KDA 每层每页状态 561,152 B = 36,864 + 524,288（kv-cache 表与 calc 语法文档同一组数）。
- R1 full 组 calc：⌈3 ÷ 640⌉ = 1 块；8 × 8,355,840 = 66,846,720 B ≈ 63.75 MiB，标明「按源码换算，无实测」，并注明钉住版本块大小取 4 的问题链接 pd 页。
- 传输超时：4.096 × 2^20 × 7 ÷ 1000 + 3000 = 33,064 ms（utils.py L55–L61 公式，默认值 20、7）。押块超时 480 s（vllm envs.py L1684–L1686）。
- 其余数（7/12 → 3/5 块号、64 KiB、8 头 TP4/TP2、每层 1 / 0.5 单位）全部是示意数，文中标「示意」。

### 核心概念对照了什么（全部本轮重新读源码）

- 连接器两半：vllm@0fc695fc `base.py` 的 `KVConnectorRole`（SCHEDULER/WORKER）、worker 侧与调度侧抽象方法、`request_finished` 默认 `(False, None)`；调度器只在 `kv_transfer_config` 存在时造连接器（scheduler.py L119–L130），worker 侧 `ensure_kv_transfer_initialized`（kv_transfer_state.py L65–L87）。
- 押块与完成：scheduler.py `_free_request`（L1888–L1910，delay_free 时不还块）、`_update_from_kv_xfer_finished`（L2221–L2250，finished_sending 还块、finished_recving 放行）、等待队列里 `WAITING_FOR_REMOTE_KVS` 被跳过（L576–L587）；抢占只 pop running（01 §B3 已核）→ 推出「押着的块抢占碰不到」[I]。
- V1：`MooncakeConnector` 按 role 二选一（L1506–L1590，逐层 hook 与 wait_for_save 为空）；调度侧 `get_num_new_matched_tokens` / `update_state_after_alloc` / `build_connector_meta`（L1784–L1879）；`request_finished` 只在 FINISHED_LENGTH_CAPPED 时押块并交回 remote_host / remote_port / 块号（L1880–L1926）；`register_kv_caches` 记每层每份缓存的 base、block_len（= element_size × prod(shape[1:])）、stride（= stride(0) × element_size），按 `kv_role == "kv_producer"` 起发送线程、否则接收线程，5 分钟就绪超时（L2332–L2471）；`_transfer_kv_cache_all_groups` 远端元数据按 (engine, handshake port) 缓存、地址 = base + block × stride、长度 = inner_block_len × 连续块数、`batch_transfer_sync_read`（L774–L962）；`tp_num_need_pulls`：MLA 为 1，否则 (heads/D_tp)/(heads/P_tp)（L2052–L2062）；递推状态 `_append_mamba_transfer_meta` 断言 P_tp ≥ D_tp 且整除（L1111–L1150）；`get_finished` 按角色字符串返回（L2472–L2492，kv_both 两边都返回空）。
- 传输引擎：`GlobalTE` 每进程一个、`initialize(hostname, "P2PHANDSHAKE", "ascend", device)`、`register_memory` 只做一次（mooncake_transfer_engine.py）；区间上限 `MAX_HCCL_REGISTER_REGIONS = 256` 与报错文案（utils.py L14、L428–L445）。
- Layerwise：D 侧 `update_state_after_alloc` 把块号与 host/port POST 给代理 metaserver（L928–L990）；`request_finished` / `_all_groups` 直接返回 `(False, None)`，注释「layer_wise push, not need delay_free_blocks」（L1100–L1124）；`save_kv_layer` 每层入队、`current_layer += 1`（L1690–L1840）；发送线程先等 event / resharding stream 再 `batch_transfer_sync_write`，最后一层回调 DONE（L476–L528，含 ADXL 卡住的注释）；按 `is_kv_producer` / `is_kv_consumer` 两个 if 起线程（L1340–L1400），`get_finished` 不报 sending（L1400–L1428）；端口两处公式（L809–L812 vs L1164–L1169）。
- Hybrid：`use_mamba` 时断言两边 TP 相同（L1522–L1547）；角色按字符串；P 同样押块（L1418–L1455）。
- ascend_config.py L210–L237：非 MLA 且有 kv_transfer_config 时断言 P_tp % D_tp == 0，P < D 报错。
- KV 池：mooncake_backend.py 非 fabric 分支复用 `global_te` 的引擎、`batch_put_from_multi_buffers` / `batch_get_into_multi_buffers`（L125–L150、L180–L250）；fabric 只在 A3。
- 逐层 hook 调用方：vllm-ascend 中 mla_v1、dsa_v1、sfa_v1、dsa_cp、gdn 调 `wait_for_kv_layer_from_connector` / `maybe_save_kv_layer_to_connector`；GLM 的 KDA 用上游 `kimi_gdn_linear_attn`，上游 mamba 层无 hook 调用（写进待核）。
- 版本：kv_p2p 目录与注册表在 2c59ff10 / db701c1f / 2ed6cbba / baa023ad 四处逐一列过；main 的 `MooncakeConnector = MooncakePullConnector`、`MooncakePushConnector` 抛 NotImplementedError、V2 断言 pcp_size == 1 已核；逐层池文档 v0.23/v0.26 要求 memcache、main 改为 mooncake_layerwise_adaptation_and_optimization.md 配 AscendStoreConnector + use_layerwise 已核。
- 官方参照：vllm-ascend 设计文档 disaggregated_prefill.md 的 pull / push 两张设计图（本地导出看过）与 L39–L55 流程；单机教程 V1 配置；多机教程 Layerwise 配置。参考图库看了 xzclass-09「一次性传输 vs 分批传输」，借用到时间线图的上下对照。

### 旧版信息清单勾选（清单在 scratchpad mooncake-connector-facts.md）

- A1–A15（p4-checkpoint）：全部保留。A1 控制面/数据面改写成「调度器那一半记账、worker 那一半碰显存」；A3 的 dtype 与并行切分落在「两边 TP 不同」一节；A6 保留为「一次交接不是一次网络调用」；A9 保留为「次序是这套机制的底线」；A11 的时间线图重画，数值不变；A15 的 V2/Pull/Push 只放在版本差异的 main 列。
- A16：保留（GLM 一节末尾「源码有分支 ≠ 整套 PD 跑通，量化布局、KDA、MTP、图模式需联合验证」）。
- B1、B3–B16、B18–B23、B25（2669d4b）：保留，均按钉住版本重新核过。B14 改正：旧版说 extra config「写的是对面长什么样」，源码是两段分别写 P、D 的 TP/DP，两边都要写全，按源码改写。B20 的 PCP 端口问题保留在「开销和什么时候别开」，并列入待核（只在 D 开 PCP 时触发，本轮未实测）。
- B2 删除：旧例子 Qwen3-0.6B（28 层、14 MiB、512 KiB/层）来自 pd-disaggregation 的旧版，该页现已改用 R1 与示意数；按 P5 规则基础节用示意数、GLM 节用 R1 换算，不再保留不在主线上的模型。
- B17 挪走：V1 的端口偏移公式唯一出处在 large-scale-ep「怎么开」，本页链接过去；Layerwise 两处公式不一致保留；Hybrid 端口公式和 1P1D 代入例子删去（按本批验收要点「附录只补挂靠与链接，避免复制调用链」）。
- B24：SfaRemoteD2HConnector（v0.26 起）、V2/Pull（main）、Push NotImplementedError、V2 断言 PCP=1、逐层池文档变化 保留在版本表；「main 上 Hybrid 端口基址多乘 pcp」本轮没有重新核，未写入（列为跳过）。

### 自查

- `pnpm wiki:lint`：通过，本页 0 报错；lint 输出的 8 处「待留意」都在别页。
- 本页三张图：scratchpad 脚本（与 wiki:diagrams 同一套 figureProblems / renderDiagram）检查 0 问题，`--check` 三张 SVG 与 spec 一致；`pnpm wiki:diagrams --check` 全库跑时报的是别页。
- `pnpm wiki:audit`：通过；本页 47 条来源全部 ✓（行号有效）。本页不在 standard-pages.json 名单里，另用 scratchpad 脚本把本页临时加入名单跑写作标准：行内代码 0.0/千字、对照源码之上角标 0、calc 0.68/千字、表与 calc 相邻 0、图先行、免责 1.2%、图宽合格，0 问题。
- 没有起服务、没有做浏览器验收（留给审查环节）。
- P1 疑点：无。需要审查重点看的：hooks 表里「③④」一行把 build_connector_meta 与 start_load_kv 合在一起写；「押着的块抢占碰不到」是由源码推断 [I]；R1 full 组 calc 是在「块大小按 640 对上」的假设下的换算。

### 跳过

- ~~没有重新核 main 上 Hybrid 端口基址是否多乘 pcp_size（2669d4b 旧说法），未写入。~~（10-02：审查员已核、写手复核后写入版本表，见 P5 修订记录）
- ~~上游 vLLM v0.26 分支的连接器接口没有逐项对照，版本表里写明「只核了 v0.23.0」。~~（10-02：审查员已核、写手复核后替换该条，见 P5 修订记录）

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，只审不改页面）。分数 **7.5 / 10**。

### 结论

- 初学者测试（只读前两屏）：「Mooncake 连接器是 vLLM 在昇腾上交接 P、D 两套实例历史状态的插件：先把 P 的块号对上 D 的块号，再按层把字节从 P 显存直接搬进 D 显存，最后发完成通知；代价是交接期间两边都押块、启动要登记显存和起线程、多出端口和超时类故障。」能说清，**通过**。
- 学习顺序：是什么（定义 + 三个前置词 + 直觉图 + 三件事）→ 为什么（管账 / 换地址 / 发通知 + 代价）→ 怎么做（接口位置、地址 calc、TP calc、完成通知、时间线 calc）→ 细节（KV 池、三套连接器）→ GLM → 误解 → 源码。基础节里没有 GLM 数字，第一屏不开算，**通过**。
- 核心概念：逐条对照钉住源码，**没有发现讲错**（见下「核对记录」）。
- `pnpm wiki:audit`：本页 47 条来源全部有效，**通过**（本页不在写作标准名单里，不参与名单检查）。`pnpm wiki:lint`：通过，本页 0 报错。`pnpm wiki:diagrams --check`：全库 268 张图与 spec 一致，退出码 0，mooncake-* 三张无任何提醒——写手之前的失败已不存在。
- 浏览器：Playwright 1440 宽打开 5193 预览，截图 scratchpad\mooncake-connector-review-first.png / -fig0.png / -fig2.png / -layerwise.png；页面无横向溢出、SVG 不超出容器；控制台只有问答后端 502（服务没起，与本页无关）。
- 旧版信息清单：scratchpad\mooncake-connector-facts.md 存在。抽 6 条到新版确认：A5 登记≠数据到位（L141、L289）、A9 次序底线（L190）、A12 逐层不减字节、不提前出字（L188、L196、L213）、B10 480 秒 + 错误日志 + 几类故障症状相同（L110、L186）、B11 256 段上限与 P2PHANDSHAKE（L156、L331）、B22 kv_both 的线程差异（L246、L295）。6 条都在。
- 注水 / 重复：正文没有重讲 kv-pool（只一节对照表 + 链接）、没有提 lmcache；pd-disaggregation 大多一句话 + 链接，但「完成通知」一节和 pd 页有一段实质重复（见 P2-1）。

### 两处未核项的核实结论

1. **main 上 Hybrid 的端口基址：已核实，确实多乘了 PCP。** main（baa023ad）`kv_p2p/mooncake_hybrid_connector.py` 调度侧 `MooncakeConnectorScheduler`（L1310 起）L1335–L1341、worker 侧 `MooncakeConnectorWorker`（L1638 起）L1716–L1722，都是 `kv_port + dp_rank × tp × pp × prefill_context_parallel_size`。v0.23（2c59ff10 L1202–L1206、L1552–L1556）、db701c1f（同行号）、v0.26（2ed6cbba L1205–L1209、L1555–L1559）都是 `kv_port + dp_rank × tp × pp`，不乘 PCP。main 两侧公式一致，不存在 Layerwise 那种两处对不上的问题；只有 PCP > 1 且 dp_rank > 0 时，升级到 main 后端口会变。页面目前没写这一条（见 P2-3）。
2. **上游 vLLM v0.26 的连接器接口：已核实，与 v0.23.0 一致，只多一个可选方法。** 上游 v0.26.0 = 568afb3a（tag v0.26.0）。`vllm/distributed/kv_transfer/kv_connector/v1/base.py` 与 0fc695fc 逐行 diff：`KVConnectorRole` 仍只有 SCHEDULER / WORKER；调度侧 3 个、worker 侧 4 个抽象方法，`SupportsHMA.request_finished_all_groups`，`request_finished` 的默认返回值都不变；只多出非抽象的 `has_pending_push_work()`（L577–L587，默认 False），调度器在 L2318–L2324 用它让主循环继续转；另外 `update_state_after_alloc` 只改了 docstring。调度器的相关路径在 v0.26 结构相同：只在 kv_transfer_config 存在时造连接器（L134），跳过 WAITING_FOR_REMOTE_KVS（L686），`_free_request` 的 delay_free（L2207–L2231，另加了 EC 连接器的 OR），`_update_from_kv_xfer_finished`（L2622），抢占只从 running 里 pop（L601）。vllm-ascend 的 2ed6cbba 和 baa023ad 都没有实现 `has_pending_push_work`（git grep 0 处），Layerwise 在 v0.26 上走的是默认的 False。页面的「只核了 v0.23.0」可以换成这条结论（P3-4）。

### 核对记录（核心概念，行号均为 vllm-ascend@db701c1f，另注明的除外）

- D 算远端已有位置数：`_state_prefill_token_count` 对混合模型返回 N−1（mooncake_connector.py L1751–L1756、L1807–L1813）；P 侧 `_truncate_request_for_prefill` 丢掉最后一个提示词 token（L1758 起）。Layerwise 同样（mooncake_layerwise_connector.py L819、L855–L856、L859–L923）。页面 L126、L245、L263、L267 正确。
- 押块与超时表：`request_finished` 只在 FINISHED_LENGTH_CAPPED 时押块（L1898），登记进 `_reqs_need_send`（L1909），`build_connector_meta` 打包（L1873），worker `start_load_kv` 交给发送线程的超时表（L3466–L3474），超时用 `VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT`（L229，vllm envs.py L1684–L1686 默认 480）。表格「③④」一行正确。
- 地址与长度：src = 本地基址 + 块号 × 块间距 + inner_offset × inner_block_len，dst = 远端基址 + 块号 × 远端块间距，length = inner_block_len × 连续块数（L905–L935）；inner_block_len = block_len ÷ tp_num_need_pulls（L915）。页面地址 calc、「各读半块放进前半、后半」正确。
- 单次传输超时：`(4.096 × 2^20) × 7 // 1000 + 3000` = 33,064 ms（2c59ff10 kv_transfer/utils/utils.py L55–L61），和页面一致。
- 角色：V1 按 `kv_role == "kv_producer"` 起发送、否则接收（L2427），`get_finished` 只认 producer / consumer 字符串（L2472–L2486）；Layerwise 用 `is_kv_producer` / `is_kv_consumer`（L1359、L1386、L1400–L1416，不报 sending），`request_finished` 返回 (False, None)（L1111–L1124）。端口两处公式 L809–L812 与 L1164–L1169 与页面一致。
- DP All-Reduce 跳过条件：utils.py L1258–L1286（稠密模型直接跳；MoE 只在 KV consumer 且满足 MC2 条件时跳），与页面 L253、底稿 01 L848 一致。
- KV 池复用引擎：mooncake_backend.py L126–L129、L180–L184（不开 fabric 时复用 `global_te`），页面 L222 正确。
- 数字：8,355,840 B、7.97 MiB、63.75 MiB、120–121 块、956–964 MiB（01 L25、L224、L1030、L1101）；1,577（pd-disaggregation L297）；121 ÷ 1,577 ≈ 1/13；561,152 = 36,864 + 524,288；KDA 每卡 8 头（02 L271）。四个 calc 逐行手算都对（5,448 / 1,192 / 6 段；2 / 4 / 2 张 / 32 KiB；4.5 / 3.5 / 1；3 / 1 块 / 8,355,840 / 66,846,720）。
- 变体口径：GLM 一节明确「没有开」，R1 calc 标「按源码换算，无实测」，1/13 标为拆分后的换算，没有虚构实测数，也没有把主线数字当成本特性的效果。

### P1（1 条）

- **P1-1 前置概念先用后讲：「代理」和「握手地址 / 握手端口」。** 位置：「代理」第一次出现在 L127 的表格，之后 L183、L212、L228 反复用，本页从头到尾没说它是什么；「握手地址」第一次出现在 L93（第一节），直到 L142 才间接提到「握手」。V1 和 Layerwise 的根本区别（谁先分块、谁先被挑）全靠代理，初学者读到这里不知道第三方是谁。改法：在第一节「P、D 与交接」一条里补一句话——代理（proxy）是 PD 部署最前面的转发服务，负责先后挑 P、D 并在两边之间转交块号和地址；握手端口是每张卡开的一个小端口，对端先连它交换地址簿（详见 [PD 分离页](pd-disaggregation.md#状态交接怎样一步步完成)）。

### P2（4 条）

- **P2-1 「完成通知」和 pd-disaggregation 重复。** 位置：L183、L185、L186。代理把生成数设成 1、按长度上限结束、读失败也照样通知、480 秒强制释放，pd-disaggregation「状态交接怎样一步步完成」第 2、5 步和「抢占、失败和超时怎么处理」第 3 段已经讲过，用的是同一组 7/12→3/5 块号。改法：这两条压成一句话 + 链接；保留本页独有的「P 数着几张 D 卡收完」「单次传输 33 秒超时」「Layerwise 不押块」「押着的块抢占碰不到」。
- **P2-2 KDA 组「是不是每块都读」源码能回答，页面还挂成待核。** 位置：L276、源码区待核第 3 条（文件 L370）。db701c1f mooncake_connector.py L864–L869：递推状态组（MambaSpec）只取 P 的第 `len − num_speculative_tokens − 1` 块，对 D 的第 0 块；L872–L888 每层调 `_append_mamba_transfer_meta`，L1131–L1154 只搬卷积、递推两段，长度按张量本身的字节数（不含补齐）。所以按 V1、两边 TP8，每张 D 卡每层 KDA 只读 1 块、2 段、561,152 B，34 层合计 19,079,168 B ≈ 18.2 MiB（按源码换算，无实测）。改法：L276 改写成这条结论并标「按源码换算」，删掉对应待核，只留「缺 D 端日志实测」。**跨页提醒**：pd-disaggregation L352 写的是「KDA 组每请求 4 块含 MTP 候选槽，按源码原样全读」，与上述源码不符，需另派复查那一页。
- **P2-3 版本表漏了已核实的 main Hybrid 端口变化。** 位置：版本差异表（文件 L340 一带）。结论与行号见上「两处未核项」第 1 条。改法：在表里加一行「Hybrid 握手端口基址」：v0.23 / db701c1f / v0.26 为 `kv_port + dp_rank × tp × pp`，main 另乘 PCP；并在写作记录里把「跳过」一条划掉。
- **P2-4 外部 Mooncake 包决定的行为没有标出处口径。** 位置：L73「它就把这段字节从对面读过来，或写过去」、L141「登记的意思是这段显存允许对端按地址访问」、L220 / L227 Mooncake Store「存储自己知道放在哪」、源码区 L331「两端直接握手，不需要另起元数据服务」。这些是 Mooncake 传输引擎和 Mooncake Store 自己的行为，本仓只能核到调用方式（`initialize(..., "P2PHANDSHAKE", "ascend", ...)`、`batch_transfer_sync_read/write`、`register_buffer`），页面没有一处写「按 Mooncake 官方文档 / 未在本仓核实」。改法：在来源索引或待核里加一句口径说明，正文第一次讲传输引擎、Mooncake Store 时各补半句「按 Mooncake 官方文档」。

### P3（5 条）

- P3-1 L151、L290：「两边块号都连着就并成一段」有两个前提源码里写着——块间距等于块字节数（`split_if_not_byte_contiguous`，L925–L931），以及不需要从多张 P 卡拼（`tp_num_need_pulls == 1`，L851–L857）。calc 里 64 = 64 没问题，但 L143 刚说过两者可以不等，建议在注释里补上这个前提。
- P3-2 直觉图的图注（渲染后在图内）和紧接着的 L85–L89 三条列表几乎逐句重复；图注里「P 才放源块」没区分 V1 / Layerwise（Layerwise 不押）。建议图注只留一句，把「V1」加上。
- P3-3 hooks 代码流程图：两条泳道标题「worker 进程（每张卡一个）」「worker 里的后台线程与传输引擎」压在上一条泳道的下边框上，看起来挤（见 -fig2.png）。建议把泳道标题放进框内，或把泳道间距拉开 16–20px。
- P3-4 源码区版本差异下的「上游连接器接口本页只核了 v0.23.0」可以换成上面第 2 条结论（v0.26.0 接口一致，另多 `has_pending_push_work`，昇腾两版都没实现）。
- P3-5 GLM 一节的「MC2」（L253）、「indexer 缓存」（L259）第一次出现时没有一句话解释。在 GLM 节不算基础概念，补半句或链到对应页即可。

### 跳过

- 按规则没读 frontmatter 的来源清单、源码区正文（只 grep 了 H3 顺序、版本列、待核和来源索引里的 S 类来源）、代码块。
- 没有重新核 Hybrid 在 main 上其他改动、SfaRemoteD2HConnector 的实现细节，也没有核 Layerwise 在 GLM 的 KDA 层上能不能逐层推（页面已列为待核）。

## P5 修订记录（10-02）

执笔：Fable 5（写手，只改本页正文与本页两张图的 spec）。审查给的源码行号全部自行 git show 复核，与审查记录一致，无一处不采纳。

### P1（1 条，已修）

- P1-1：第一节改为「先认四个前置词」，新增「代理与握手端口」一条：代理（proxy）= PD 部署最前面的转发服务，先后挑出 P、D 并转交块号与地址（链 PD 分离页「状态交接怎样一步步完成」）；握手端口 = 每张卡为对地址开的小端口，对端先连它换地址簿。

### P2（4 条，已修）

- P2-1：「完成通知」三条里与 pd-disaggregation 重复的内容（代理改生成数、按长度上限结束、读失败照样通知、480 秒强制释放）各压成一句话 + 链接；保留本页独有的「P 数着几张 D 卡收完」「33 秒单次传输超时」「押着的块抢占碰不到」。
- P2-2：GLM 节 KDA 段按源码改写：递推状态组每层只搬一块两段（按「组内块数 − 推测 token 数 − 1」挑 P 的块，搬进 D 为该组分的第一块），每层 561,152 B、34 层合计 19,079,168 B ≈ 18.2 MiB，标「按源码换算，无实测，缺 D 端传输日志对数」；删掉对应待核。自核行号：mooncake_connector.py（db701c1f）L867–L869 选块、L871–L888 逐层、L1111–L1194 两段与长度。新增来源第 48 条。
- P2-3：版本表新增「Hybrid 的握手端口基址」一行：三个钉住版本 `kv_port + dp_rank × tp × pp`，main 另乘 PCP、调度侧与 worker 侧一致。自核行号：baa023ad L1335–L1341 / L1716–L1722；2c59ff10、db701c1f L1201–L1206 / L1551–L1556；2ed6cbba L1204–L1209 / L1554–L1559。新增来源第 49–51 条；写作记录「跳过」第 1 条已划掉。
- P2-4：第一节传输引擎、KV 池节 Mooncake Store 各补半句「按 Mooncake 官方文档为准」；来源索引末尾加口径说明（引擎与 Store 自身行为本站只核到昇腾侧调用方式）。

### P3（5 条，已修 4，1 条部分采纳）

- P3-1：地址 calc 注释补并段两个前提（块间距正好等于块字节数、不用跨 P 卡拼）。常见误解「一次交接就是一次网络调用」一条未另加——该条讲的是「拆成多段」，并段前提在 calc 注释里已经覆盖，再写一遍就是第三处重复。
- P3-2：直觉图图注压成一句，并写明「V1 的 P 也到这时才放源块」；三件事的展开只留正文列表。
- P3-3：hooks 图第二、三泳道整体下移 16 / 32px（泳道间距 20px → 36px，画布 900×734 → 900×766），泳道标题不再压上一条泳道的下边框。截图：scratchpadmooncake-connector-hooks-after.png。
- P3-4：「只核了 v0.23.0」一条替换为 v0.26.0（568afb3a）结论：接口一致，仅多非抽象 `has_pending_push_work`（base.py L577–L587 默认 False，调度器 L2313–L2324 用它续转主循环），昇腾 2ed6cbba、baa023ad 均未实现（git grep 0 处，自核）。新增来源第 52–53 条；写作记录「跳过」第 2 条已划掉。
- P3-5：GLM 节 MC2 补一句话解释并链一条请求的 MoE 通信一节；indexer 缓存补「稀疏注意力挑位置用的池化 K」并链稀疏注意力页。

### 检查（全部本轮实跑）

- `pnpm wiki:lint`：通过，本页 0 报错、0 待留意。新引用只加 [C48] 一个行内标记：先按审查行号加满 6 个标记时本页总数到 36、触发 mark-flood 待留意，故 Hybrid 端口与 v0.26 接口两组来源在索引里改为「行号在来源第 49–53 条」的文字指引，总标记回到 30（阈值内）。
- `pnpm wiki:audit`：通过，本页 53 条来源行号全部有效（含新加 6 条；vllm@568afb3a 为本页新引入的上游 commit，tools/repos/vllm 里可解析）。
- `pnpm wiki:diagrams --check`：271 张图与 spec 一致，mooncake-* 三张无提醒。
- 两张改过的图用 Playwright 对 file:// SVG 截图核对：hooks 泳道标题落在空档里，直觉图版面正常（scratchpadmooncake-connector-*-after.png）。
- frontmatter `updated` 改为 2026-10-02。

### 跨页提醒（未在本页处理）

- pd-disaggregation.md L352 待核仍写「KDA 组每请求 4 块按源码原样全读」，与上面 P2-2 的源码结论冲突；审查记录已说明需另派复查那一页，本页按分工未动它。

## P5 复审（10-02）

复审员：Opus 5.5（独立复审，只审不改页面，未开子代理）。分数 **8.5 / 10**（上一轮 7.5）。

### 结论

- **P1-1 已修好。** 代理、握手端口在第一节「先认四个前置词」第 4 条（L86）定义；两词在正文里第一次出现就是这一行，之后 L100、L134、L190 等处再用时都已有交代。代理的说法与 pd-disaggregation L136 一致。
- **P2-1 已修。** 完成通知 L190、L192、L193 都压成一句 + 链接；本页独有的「P 数着几张 D 卡收完」（L191）、33 秒单次超时（L193）、Layerwise 不押块（L195）、押着的块抢占碰不到（L199）都还在。
- **P2-2 已修，改对了。** 独立复核 db701c1f `kv_p2p/mooncake_connector.py`：L867–L869 选块（P 取第「块数 − 推测 token 数 − 1」块，D 取本组第 0 块），L871–L888 逐层调 `_append_mamba_transfer_meta`，L1141–L1154（TP 比为 1 的分支）只放卷积、递推两段；段长来自 L2376 的「元素字节 × 去掉块维后的形状乘积」，不含补齐，块间距另由 L2377 的 stride 给。34 × 561,152 = 19,079,168 B ≈ 18.2 MiB，手算一致；已标「按源码换算，无实测」，对应待核已删。
- **P2-3 公式写对了，后果那半句写错了**，见下「新 P2-1」。
- **P2-4 已修。** L79、L227 各补了口径半句，来源索引末尾（L372）加了 Mooncake 引擎与 Store 自身行为的口径说明。
- **P3-1～P3-5** 按修订记录处理。看了写手截图 scratchpad\mooncake-connector-hooks-after.png，hooks 图泳道标题落在空档里，不再压框；直觉图图注压成一句并点明 V1（mooncake-connector.yaml L3）。

### 首审两处结论写进页面后的独立复核

1. **Hybrid 握手端口基址（L350）：公式对，后果错。** 端口基址：2c59ff10、db701c1f L1201–L1206 / L1551–L1556，2ed6cbba L1204–L1209 / L1554–L1559，都是 `kv_port + dp_rank × tp × pp`；baa023ad 调度侧 L1335–L1341、worker 侧 L1716–L1722 另乘 `prefill_context_parallel_size`，两侧一致。这一部分页面写对了。但三个钉住版本的 Hybrid 在调度侧、worker 侧初始化时都断言 PCP × DCP = 1（2c59ff10 / db701c1f L1193、L1505；2ed6cbba L1196、L1508）：钉住版本上的 Hybrid 根本开不了 PCP，所以「开了 PCP 且 dp_rank > 0 时升级后端口会变」这种情况不会出现。首审只核了端口公式，漏看这条断言，写手照着写进了页面。上面「两处未核项」第 1 条的结论也要按这条更正。
2. **上游 v0.26 接口（L353）：写对了。** vllm 568afb3a 就是 tag v0.26.0；base.py 与 0fc695fc 的 diff 只有两处：`update_state_after_alloc` 的 docstring，以及新增的非抽象方法 `has_pending_push_work`（L577–L587，默认 False）。scheduler.py `has_requests`（L2313–L2324，调用在 L2323）靠它在推送还没发完时让主循环继续转。vllm-ascend 2c59ff10 / db701c1f / 2ed6cbba / baa023ad 里 `git grep has_pending_push_work` 都是 0 处。页面表述与源码一致，来源第 52、53 条行号准确。

### 删改是否丢信息

- 页面整页还没提交，HEAD 和 p4-checkpoint 上都是旧版，`git diff` 分不出本轮的改动。所以改用写手的编辑脚本 scratchpad\edit-mooncake.mjs，把 17 处「原文 → 新文」逐条对照。
- 只有 P2-1 的三处删了内容，删掉的东西都在别处找到了：代理把生成数改成 1 → pd-disaggregation L136；失败的块标成无效、默认让请求报错结束 → pd L174；480 秒强制还块时打的错误日志 → 本页 L333、pd L176 / L290。两个链接锚点都对应 pd 现有标题（L128、L168）。其余各处是新增或替换，**没有丢信息**。

### 检查（本轮实跑）

- `pnpm wiki:audit`：退出 0，本页 53 条来源全部有效（含新加的第 48–53 条），**通过**。
- `pnpm wiki:lint`：退出 0，本页无报错、无待留意。
- `pnpm wiki:diagrams --check`：271 张图与 spec 一致，mooncake-* 三张无提醒。

### 新 P1（0 条）

### 新 P2（1 条）

- **P2-1 版本表 Hybrid 端口一行说错了升级后果，也漏了 main 真正的变化。** 位置：L350 main 列。问题：页面说开了 PCP 且 dp_rank > 0 时，升级后端口会变。但钉住版本的 Hybrid 一启动就断言 PCP × DCP = 1（行号见上），能在钉住版本上跑起来的 Hybrid 部署 PCP 一定是 1，乘进公式也不变，升级后端口不会变。main 真正的变化是放开了 PCP：调度侧只断言 DCP = 1（baa023ad L1327），worker 侧另断言 PP 与 PCP 不能同时大于 1（L1664–L1665）；端口基址乘 PCP，每张卡的偏移改成 `(pp_rank × pcp + pcp_rank) × tp + tp_rank`（L1723），各 PCP rank 的端口因此错开。影响：照这张表升级 Hybrid 的读者会去防一个不会发生的端口变化，也不知道要到 main 才能给 Hybrid 开 PCP。复现：`git -C tools/repos/vllm-ascend show 2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py | sed -n '1194,1196p'`。改法：三个钉住版本的格子补一句「Hybrid 启动时断言 PCP × DCP = 1，不支持上下文并行」；main 那格改成「放开 PCP（只要求 DCP = 1，PP 与 PCP 不同时开）；端口基址另乘 PCP，每卡偏移也按 PCP rank 错开；PCP = 1 的旧配置升级后端口不变」。来源加一条断言行（如 2ed6cbba L1194–L1196）。

### 新 P3（4 条）

- P3-1 L86 说握手端口是「每张卡」开的，太笼统了。V1 里只有 P 的发送线程绑定监听端口（db701c1f mooncake_connector.py L308，只在 `KVCacheSendingThread` 里起 ROUTER），D 的接收线程只拿自己的端口号当键（L436、L760）。L266「P 机 8 个 worker 各开一个握手端口，D 机只起接收线程」才是准确的；L116 也有同样的笼统说法。建议改成「卡上为对地址开的小端口（V1 里由 P 这边开）」。
- P3-2 L79 第一屏「本站核到的是昇腾侧怎样调用它」讲的是本站自己核到哪一步，偏向站内说明。L372 来源索引已有同一口径，正文留「按 Mooncake 官方文档为准」就够了。
- P3-3 L283 末尾的「34 层合计」没写明是每张 D 卡的量。建议补上「每张 D 卡」，并和 full 组每卡 7.97 MiB 放在一起比，读者能直接看出 KDA 比 full 组多一倍多。
- P3-4 L193 写「也在那一节讲过」，指的是上一条里的链接，读者得回头找。直接带上 `#抢占失败和超时怎么处理` 的链接更清楚。

### 跳过

- 按规则没读 frontmatter 的来源清单，只 grep 了 kv_p2p 两个文件和 568afb3a 的来源行；源码区「源码位置」表和代码块没有重读。
- 没起 5193 预览重新截图（不占端口），图只看了写手的截图和 diagrams 检查结果。
- 本轮没改的节（hooks、地址、TP 拼头、逐层推、三套连接器）只扫了一遍，没有再逐条核源码。
- pd-disaggregation L352 与本页 KDA 结论冲突，属于跨页问题，仍待另派人处理，不计入本页。

## P5 复审后修订（10-02 第二轮，Fable 5）

- 新 P2-1 已修：版本表 Hybrid 行改为「握手端口基址与上下文并行」——钉住版本格补「启动即断言 PCP × DCP = 1，开不了上下文并行」，main 格改为「放开 PCP（只要求 DCP = 1，PP 与 PCP 不同时开）：端口基址另乘 PCP，每卡偏移也按 PCP rank 错开；PCP = 1 的旧配置升级后端口不变」，删掉原「开了 PCP 升级后端口会变」的错误后果。复审行号全部自核一致：断言 2c59ff10 / db701c1f L1193、L1505，2ed6cbba L1196、L1508；main L1327（只限 DCP）、L1664–L1665（PP 与 PCP 互斥）、L1723（偏移含 pcp_rank）。新增来源第 54–56 条，来源索引指引改为 49–56。
- 新 P3-1～P3-4 顺手修：L86、L116 握手端口改为「答地址簿的那边开」（V1 是 P、Layerwise 是 D；自核 ROUTER bind：mooncake_connector.py L308 在发送线程、mooncake_layerwise_connector.py L610 在接收线程）；L79 删「本站核到的是昇腾侧怎样调用它」半句，口径留在来源索引；L283 补「每张 D 卡」并与 full 组 7.97 MiB 对比；L193 的 480 秒一句补 PD 分离页直链。
- 三项检查重跑：pnpm wiki:lint、wiki:audit（本页 56 条来源全部有效）、wiki:diagrams --check 均通过，本页 0 报错、0 待留意。
