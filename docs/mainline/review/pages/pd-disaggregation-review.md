# pd-disaggregation 审查记录

## P5 写作记录（2026-09-29，第 10 批，Opus 写手）

### 改了什么

- 深改 `wiki/concepts/pd-disaggregation.md`。正文非空白字符 3,143 → 13,829（其中「对照源码」之前 7,963；写作标准口径 5,559 字）。
- 按六步骨架重排：第一屏（问题式 H2 + 一句话定义 + 直觉图 + 「本站主线没开，变体」声明）→ 第二屏（官方两条动机、本部署 128 token 图尺寸这个真实数、四项代价、≤4 行相邻做法表）→ 交接六步（流程图）→ 交接点（R1 截断图）→ GLM 状态分组 → 一 P 一 D 换算 → 抢占/失败/超时 → EPD → 常见误解 → 对照源码五个 H3。
- 图：新增 `pd-disaggregation-intuition`（直觉图：上半混部，生成中的请求陪 prefill 同步算；下半 P 实例把提示词算成历史状态，经紫色「交接历史状态」箭头交给 D 实例，D 一步一个 token 生成）；重画 `pd-disaggregation`（P / 代理 / D 三栏时序，编号 1–6 与正文步骤一致，pins 指向 request_finished 与 batch_transfer_sync_read）；重画 `pd-state-boundary`（R1 的 4 个 token：GLM 行 P 只算 p₀–p₂ 交 S₃、D 只算 p₃；纯注意力行 P 算满、D 退回 1 格，P 采出的 token 没人读）。三张图宽 900。
- frontmatter：标题、summary、aliases（加 P/D 实例、kv_producer/kv_consumer、Prefill-decode Disaggregation；kv_transfer_config 与 mooncake-connector 重复，未加）、sources 换成 44 条钉住来源、verified 三版、relations（prefill / kv-cache / glm-5-3-flash-two-node / block-table 为 builds-on，chunked-prefill 为 alternative-to；mooncake-connector 已由对方写 builds-on 指回，不重复）、updated。
- 删掉 EPD 一节开头的搬运说明（meta 文本）；正文角标全部移到「源码位置」。

### 数字出处

- 128 token / 7 个图尺寸 / 每条每步 4 个 token：底稿 01 §A0.6（页内链接部署页「启动时发生了什么」）。
- 两台机器是两个 DP 执行组、EP16、每卡 18 个专家、没有 kv_transfer_config：01 §A0（A0.1–A0.2）与 §B1 第 848 行附近；页内链接部署页「部署前提」。
- 一 P 一 D 的每卡 38.72 / 20.58 GiB、1,577 / 3,908 块、MC2 条件：只引用部署页「为什么是两台机器，不是一台」的结论并链接，不重算（该表数字源自 01 §A0.3/§A0.5）。
- 抢占：约 67,000 个位置、每步 8,192、重算 9 步、KDA 状态一起丢：01 §B3；页内链接并发页 KV 块一节。
- R1 = 4 个 token：链接 one-request「示例请求 R1 与官方双机部署」；R1 块数未写。
- 本页没有任何 PD 实测数、加速比或 GLM 交接字节数；字节数列入待核。

### 核心概念对照

- 交棒条件（do_remote_decode 且 FINISHED_LENGTH_CAPPED）、delay_free、last_token_id、MTP 块裁剪：vllm-ascend@db701c1f `mooncake_connector.py#L1666-L1749`、`#L1880-L1926`。
- 混合模型截断（need_truncate = 配置有 compress_ratios 或任一组是 MambaSpec；P 去掉最后一个 prompt token、max_tokens=1、防抢占后重复截断；D 命中记 N−1；首次分配后关掉 do_remote_prefill）：同文件 `#L1751-L1849`。GLM 的 KDA 组是 MambaSpec：vllm@0fc695fc `mamba/abstract.py#L44-L48`，`GatedDeltaNetAttention` 继承 `MambaBase`（`gdn/base.py#L22`）。
- D 拉取：同文件 `#L774-L990`（`batch_transfer_sync_read`）；发送线程只答 GET_META / 记 DONE_RECVING：`#L245-L390`；失败也发完成信号：`#L705-L756`；角色字符串判断：`#L2424-L2492`；押块超时：`#L166-L243` + vllm envs 默认 480。
- 上游：WAITING_FOR_REMOTE_KVS（scheduler.py#L798-L824）、整段命中退回 1 格与失败后保留已读（#L2154-L2186）、kv_load_failure_policy 默认 "fail"（config/kv_transfer.py#L66-L73，v0.26 分支同）、MinTokens 屏蔽含 EOS 的停止 token（builtin.py#L191-L238，sampling_params.py#L593-L614）。
- 官方文档：设计文档动机/流程/规格/限制（db701c1f）；支持矩阵 GLM-5.3-Flash 行（baa023ad 与 0576b647 第 45 行：模型 🔵，PD ✅；v0.23、v0.26 没有这一行）；GLM 教程 0576b647 无 kv-transfer 配置（grep 0 次）。
- 版本：注册表逐版核对（2c59ff10 与 db701c1f 相同；2ed6cbba 多 SfaRemoteD2H；baa023ad 多 V2/Pull/Offloading/PreemptOffload、少 LMCache/RecomputeCPUOffload）；V1 截断与交棒门四版都在；main V2 `base_scheduler.py#L46-L51` 拒绝 kv_both；max_num_partial_prefills 文档限制只在 2c59ff10，平台重置四版都在。

### 旧版信息清单勾选

清单：scratchpad `p5/pd-disaggregation-facts.md`（P = p4-checkpoint 现版，O = 2669d4b 重写前版）。

- P1–P17：全部保留。P2 的「不能凭偏计算/偏访存决定」写进第二屏；P16 纠正：接收失败默认是请求报错结束，「重算」策略才保留已读部分并重排（依据 kv_load_failure_policy 默认值）。
- P18–P23（EPD）：全部保留在「带图像的请求」一节，角标移到页末索引；删掉「由原页并入、未重写文风」这句搬运说明。
- P24：两张旧图按新内容重画，另加直觉图。
- O1、O3、O5、O20 的 Qwen 算例（37/200 token、Qwen3-0.6B 字节 14 MiB / 4.05 MiB、Qwen3.6 矩阵 ❌）：删除。理由：主线已换 GLM，示例改用 R1；数字只能取自主线底稿，Qwen 配置不在钉住来源里；GLM 的交接字节列入待核，不另造算例。
- O2、O4、O6–O9、O11、O12、O14–O19、O21–O24：全部保留（交接六步、D 拉、register_buffer、DONE_RECVING、get_finished、双份占用、主循环不堵、交棒门与 MTP 裁剪、点对点/池两类、四条误解、kv_role、kv_port、extra_config、prefix caching 说明、四类报错、版本表、源码位置、两进程各一份）。
- O6 扩展：纯注意力「多一次前向、首 token 位置算两次」保留，并对照 GLM 截断路径（不重复算位置）。
- O10 纠正：示例代理同时设 min_tokens=1，EOS 被屏蔽，这一步抽不到结束符；只有自定义代理漏设时才会出现空交接、D 整段重算（代理行为见 proxy#L925-L927）。
- O13：Qwen 的 1P1D 命令块删除，配置键改成「怎么开」表格；不给 GLM 的 PD 启动命令，避免虚构部署。
- O21 纠正：旧版说 v0.23 「只有 V1 一套」，实际 v0.23 同时注册了 Hybrid 与 Layerwise。

### 自查

- 首图在第 1 个 H2；图前无 calc、无部署数字。calc 0；正文行内代码 0；对照源码之上角标 0；全页角标 29 处（C 15 / S 9 / D 2 / I 2 / ! 1，C 占 52%）；免责句 0%。
- 表与 calc 不相邻；对照源码 H3 顺序为五项；其后无 H2。
- 本页跨页链接 16 条，锚点全部解析（scratchpad anchor-check-page）。

### 验证

- `pnpm wiki:lint`：通过，本页 0 报错（15 处待留意均为别页 mark-flood）。
- `pnpm wiki:diagrams --check`：198 张图与 spec 一致，本页三张图无报错、无待留意。
- `pnpm wiki:audit`：通过；本页 44 条来源行号全部有效，0 条 ✗。
- `pnpm check:content`：通过。
- 本页不在 standard-pages.json 名单里，用同一个 checkStandard 单独测：全部 ✓。
- 未起服务、未做浏览器验收（按派发要求留给审查环节）。

### 疑点（留给审查）

- 连接器 `_get_group_transfer_info` 对一个组只取一个 compress_ratio 算 tokens_per_block；GLM 的 full 组里 MLA（压缩比 1）与 indexer（压缩比 4）混在一起，取到哪个值、长提示词会不会少传，没有逐行核完，已写进页末待核，正文只说「按提示词长度算出要传几块」。
- MinTokens 屏蔽 EOS 依据上游 logits processor；Ascend 采样路径是否同样应用这一处理器，沿用 p4 版结论，未单独追到 Ascend sampler。
- 跳过：没有读 HANDBOOK、docs/plans/、TERMS 全文（只 grep 了 PD、all-gather 两行）；没有读 codex-p5-common.md。

## P5 审查（09-29）

审查员：Opus 5.5 独立审查（只审未改页面）。页面行号指 `wiki/concepts/pd-disaggregation.md` 当前工作区版本。

### 结论

- 得分 **7.0 / 10**。P1 共 1 条，P2 共 2 条，P3 共 7 条。
- `pnpm wiki:audit`：整体 `ok`，本页 44 条来源全部 ✓，0 条 ✗。
- 变体口径合格：82 行明确写了「主线没开，本页讲部署变体」；163 行把一 P 一 D 写成「配置换算，不是 PD 实测」；全页没有虚构 PD 实测数或加速比，也没有把 GLM 主线数字当成 PD 的效果。第 5 行验收要点（换掉「预算 6、上限 2」）：全页 grep 为 0 处，合格。

### 初学者测试（只读前两屏，70–108 行）

我的一句话：PD 分离把一条请求拆成两段，交给两套各自启动的推理服务：P 一次算完提示词，把留下的历史状态交给 D，D 接着逐个生成 token。好处是 decode 不再被新来的 prefill 打断，两边也能分别选并行方式；代价是多一次跨实例搬运，两边都要先押住一批块，出错的地方也更多。本站主线没开 PD。
「是什么、为什么」本身讲得出来。但 88–90 行这段「在本部署里具体怎么插进来」里有一串前置概念没讲就用了，见 P1-1。

### 核心概念逐条核对（全部对，附行号）

- 交棒条件是 do_remote_decode 且 FINISHED_LENGTH_CAPPED，页面 112、119 行写对了：`vllm-ascend@db701c1f:…/kv_p2p/mooncake_connector.py#L1895-L1900`。
- 块先不放（delay_free）、打包块号/地址/握手端口、last_token_id，页面 119 行写对了：同文件 `#L1902-L1926`。
- 代理把 max/min 生成数都设成 1，页面 118 行写对了：`db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L801-L802`。
- P 截掉最后一个提示词 token、max_tokens=1、只截一次，D 远端命中记 N−1，首次分配后关掉 do_remote_prefill，页面 141、143、175 行写对了：`mooncake_connector.py#L1751-L1782`、`#L1802-L1849`。
- 纯注意力模型整段命中时退回 1 格，页面 139 行写对了：`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2183-L2184`。
- 默认失败策略是 "fail"，页面 173、177 行写对了：`vllm@0fc695fc:vllm/config/kv_transfer.py#L70-L73`。
- 超时默认 480 s，并打 error 日志，页面 122、179 行写对了：`vllm@0fc695fc:vllm/envs.py#L1684-L1685`、`mooncake_connector.py#L229-L238`。
- KDA 状态组要求 P 的 TP ≥ D 的 TP 且能被 D 的 TP 整除，页面 157 行写对了：`mooncake_connector.py#L1128-L1129`。
- main 的新连接器在初始化时拒绝 kv_both，页面 205 行写对了：`vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L48-L51`。
- 设计文档的两条动机和规格表只列 MLA/GQA，页面 88、159 行写对了：`db701c1f:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L5-L11`、`#L66-L75`。
- 5 个缓存组、12 层 MLA（含 MTP 第 45 层）、34 层 KDA 分 3 组，页面 143、149 行与底稿 01 §A0.5（01 第 186–216 行）一致。

### 数字核对

- 7 个图尺寸、最大 128 = 32 × 4、MC2 条件（EP ≥ 16、每卡专家 ≤ 24）、每卡 36/18 个专家、38.72/20.58 GiB、1,577/3,908 块，与 D 页 63、82、85、109–113、121 行一致；页面只引用加链接，没有自己重算，符合单一出处。
- 约 67,000 个位置、重算 9 步，与底稿 01 第 1031 行、C 页 250 行结论一致（推导口径略有出入，见 P3-4）。
- R1 只用「4 个 token」这一教学设定，没有写 R1 块数，符合口径。

### 两处待核的追查结果

**(a) GLM 长提示词交接时，连接器算出的块数是否偏少：已核实（静态读源码），会偏少，约少到四分之一。**

1. GLM 的 full 组是一个 UniformTypeKVCacheSpecs：MLA 主 cache（compress_ratio=1）和 indexer 压缩 cache（compress_ratio=4）交错排列，主 cache 在前。两者逻辑块大小相同，拿同一套块号。
   出处：`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L167-L173`、`#L200-L210`；主 cache 的 spec 在 `vllm_ascend/ops/indexer_kpool_mla.py#L121-L134`。
   上游约定 block_size 表示「一块多少个 token」，压缩只改变块内存储：storage_block_size = block_size // compress_ratio。出处：`vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L101-L102`、`#L353-L367`。
   所以这个组一块就是 640 个位置（底稿 01 第 24、40、209–210 行）。
2. 连接器的 `_get_group_transfer_info`（`mooncake_connector.py#L1680-L1697`）逐个遍历组里去重后的 spec（`#L1699-L1708`，按首次出现的顺序排，得到的是「主 cache、indexer」），每次把 compress_ratio 覆盖成当前 spec 的值。最后留下的是 indexer 的 4，于是 tokens_per_block = 640 × 4 = 2,560。
3. `_get_transfer_block_ids`（`#L1710-L1733`）按 cdiv(提示词长度, tokens_per_block) 截取 full 组的块。`request_finished` 传进来的提示词长度是截断后的 N−1（`#L1902-L1903`）。实际发出的块数是 ceil((N−1)/2560)，应发的是 ceil((N−1)/640)。N−1 ≤ 640 时两者都是 1 块；超过 640 就偏少，长提示词大约只发四分之一。
4. D 端 `_get_kernel_block_ids` 把本地块和远端块截成两者中较短的长度（`#L2585-L2616`，关键在 `#L2615`），不报错。D 的调度器仍按「N−1 个位置已算好」往下走，full 组后面那部分目的块没被写过。这是静默的错误状态，不会报出传输失败。
5. 其他版本：同一段代码在 2c59ff10 `#L1693-L1696`、2ed6cbba `#L1737-L1740`、baa023ad `#L1795-L1798` 都有；main 的 GLM 分组方式也一样（`baa023ad:vllm_ascend/models/glm5next/cache_config.py#L173-L176`）。main 的 V2 连接器（`kv_p2p/mooncake/`）不走这段，没有核。
6. 待核里的 KDA 部分也能落实。状态组在 P 端原样全传（`#L1725-L1726`），SWA 裁剪跳过状态组（`#L1744-L1745`），D 端 MambaSpec 分支也原样对齐（`#L2594-L2595`）。每请求 4 块这个数取自底稿 01 第 657 行。
7. 另有一处风险，只做了静态阅读，没有跑过，页面上只能写成风险：
   - EngineCore 在 KV 初始化之后，会把 cache_config.block_size 改成各组块大小的最小值（`vllm@0fc695fc:vllm/v1/engine/core.py#L279-L284`；GLM 取到 4，见底稿 01 第 46 行）。调度器是在这之后才创建的（`core.py#L132`、`#L149`）。
   - 连接器调度器端的 block_size 取自同一个字段（`mooncake_connector.py#L1632`），会以 remote_block_size=4 发给 D（`#L1925`）。
   - D worker 会断言 remote_block_size 能被 kernel 块大小整除（`#L2602-L2604`），GLM 的 kernel 块是 128。这条断言可能先报错。
   - 无论哪种结果，GLM 在钉住版本上走 PD 都不能当成「能正常交接」。

**(b) Ascend 采样路径是否同样屏蔽 EOS：已核实，会屏蔽，页面 204 行的结论成立。**

- 非投机路径：Ascend runner 的 `_sample` 调 `self.sampler`（`db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2598`）。AscendSampler 没有重写 forward 和 apply_logits_processors（`vllm_ascend/sample/sampler.py#L46-L125` 只重写了 apply_penalties、greedy_sample 等），所以走的是上游 forward。上游 forward 先调 apply_logits_processors（`vllm@0fc695fc:vllm/v1/sample/sampler.py#L96-L100`），再对 non_argmax_invariant 逐个 apply（`#L404-L405`）。MinTokens 是 non_argmax_invariant（`vllm/v1/sample/logits_processor/builtin.py#L186-L189`），屏蔽的是 all_stop_token_ids，其中包含 EOS（`vllm/sampling_params.py#L596-L602`）。Ascend runner 用上游的 build_logitsprocs 建处理器（`model_runner_v1.py#L574-L580`）。
- 投机（MTP）路径：没有草稿的请求走 bonus 采样，仍然调 `self.sampler`（`vllm_ascend/sample/rejection_sampler.py#L186-L196`）。target logits 那边单独调 MinTokens 的 apply_with_spec_decode（`#L140-L142`、`#L212`）。
- 页面改法：204 行正文不用改。在「源码位置」补上 Ascend 这几处行号，在写作记录里把这条疑点关掉。

### 丢信息核对（基线 p4-checkpoint + 写手清单）

- 按旧版 7 个 H2 和写手清单 P1–P24、O1–O24 逐条抽查：交接六步、D 拉、截断、状态分组、代理 min/max、失败策略、超时、kv_role、kv_port、extra_config、prefix caching、Layerwise、LMCache、SfaRemoteD2H、EPD 六条都还在。O10、O16、O21 的纠正有源码依据，已抽查 O10 与 O16 相关行。
- 写手说「P1–P17 全部保留」不完全属实：旧版「成本与失败恢复」末段有一句读法建议（没有设备时先跟踪一个请求在 P、网络、D 三处各归谁），新版里没有，见 P3-5。
- 删掉 Qwen 算例（O1/O3/O5/O20）的理由成立：主线已换 GLM，Qwen 配置不在钉住来源里。

### 链接与锚点

- 正文 14 条跨页链接全部能解析，含 6 个带锚点的链接：glm-5-3-flash-two-node 的 3 个、kv-cache、one-request、prefill、concurrent-requests。
- 全库指向本页的有 16 个文件，都没带锚点，不受改标题影响。

### 问题清单

**P1-1｜88–90 行｜第二屏「为什么要拆」里前置概念先用后讲（基础标准第 2、7 条）。**
- 88 行先用了 chunked prefill，105 行的表格里才解释。
- 90 行一连用了 decode 图、回放、eager、MoE 通信、MC2、AllGather，本页都没有一句话解释，只给了链接。初学者读完讲不出「prefill 插进来，在本部署里到底拖慢了什么」。
- 改法：在第一次出现的地方各补一句（可取 TERMS 第 63、68、70、105、108 行的定义）。例如：graph mode 是启动时把固定大小的一步录下来，之后同样大小的 decode 步直接回放，省掉逐个下发算子的开销；eager 是不回放、逐个下发；MC2 和 AllGather 是 MoE 把 token 送到专家所在卡的两种通信方式，MC2 是小批量 decode 的快路径。
- 另一种改法：把 90 行整段挪到「如果把这两台机器拆成一 P 一 D」一节，符合「先讲基础、后落 GLM」的顺序；第二屏只保留 86–88 行的通用理由。

**P2-1｜153 行、290 行｜待核 (a) 已经可以落实，页面必须改写，不能继续挂成待核。**
- 153 行现在写 full 组「按提示词长度算出要传几块」，没有说钉住版本的实现把块数算少了。
- 改法：153 行在「按提示词长度算块数」之后补一段，大意如下，标「按源码静态阅读，本站未实测」：
  - 这个组里同时有压缩比 1 的 MLA 和压缩比 4 的 indexer，连接器取了 4，把一块当成 2,560 个位置，而调度器里一块只有 640 个位置（链 D 页的逻辑块一节，不重算 640）。
  - 提示词超过 641 个位置时，发出的块数只有应发的约四分之一；D 端按较短的一边对齐，不报错。
  - 可以附一个标「示意」的小例子：N = 2,000，应传 ceil(1,999/640) = 4 块，实现算成 ceil(1,999/2,560) = 1 块。不要用 R1 举例，R1 的块数按口径不写。
- 290 行的待核改成已核结论，只留「D 端断言是否先报错、main 的 V2 连接器是否同样有问题」两项未核。
- 159 行支持矩阵那一段加半句：矩阵标了支持，但按钉住版本的源码，GLM 长提示词的交接块数有问题。
- 「源码位置」补上 (a) 列出的行号。

**P2-2｜72、74、82、94 行｜第一屏的前置词没讲。**
- 调度器、块和块池、DP 执行组、路由专家（82 行）、All-Reduce（94 行）都是第一次出现，本页没有一句话说明。第二屏的核心代价「押块」（95 行）要靠「块」这个词才看得懂。
- 改法：74 行补一句，说明块是 KV cache 按固定位置数切出的分配单位、块池是一个实例能分出的全部块、调度器每一步决定哪些请求算几个 token 并分块。82 行给 DP 执行组补半句：一台机器上一套各自接请求、各自调度的执行单元。All-Reduce 可以直接删掉，只说「不是集合通信」。

**P3**
1. 112、201 行说 Mooncake V1 是「vllm-ascend 默认的」连接器。配置里没有默认值，kv_connector 必须显式写；设计文档只是拿它举例（`disaggregated_prefill.md#L58`）。改成「设计文档用作示例的」。
2. 145 行和 206 行几乎是同一句话；122 行和 179 行重复写了 480 秒超时。各保留一处，另一处改成链接或缩短。
3. 157 行的「没凑满的池」没有解释（指 indexer 压缩器尾部还没凑满 4 个位置的那段状态）。改成直白说法，或加半句说明。
4. 175 行写「按每步 8,192 个 token 的预算要重算 9 步」，链接到的 C 页 250 行却按 8,192 − 124 = 8,068 推导。结论都是 9 步，但口径不一致。改成「约 9 步，推导见并发页」，不在本页复述算式。
5. 旧版的读法建议（没有设备时先跟踪一个请求在 P、网络、D 的状态归属）丢了，写手清单却标成保留。建议在 181 行评估段落前补回一句，或在写作记录里注明是有意删除。
6. 版本表（约 248 行）的 db701c1f 列只标了「含 GLM 代码」，建议注明它是 orphan commit，不在任何发布分支上。
7. 直觉图 pd-disaggregation-intuition 只有方框和箭头，混部那一步没有标 token 数（基础标准第 4 条，本轮不强制）。可以在「同一步一起算」框里标上「示意：2 条 decode 各 1 个 + 提示词 N 个」。

### 本次跳过/未做

- frontmatter 的来源清单没读（由 audit 校验）。「对照源码」正文（209–294 行）只 grep 了五个 H3 的顺序和版本口径，另外读了 223–224、288–294 行这几处 grep 命中。
- 三张图用 headless Playwright 把 SVG 渲染成 PNG：直觉图和交接点图看过渲染图；流程图 pd-disaggregation 只核了文字标签，没看渲染图。没有起服务，也没有在知识库前端里验收。
- 写手旧版清单 facts.md 只读到第 60 行（「本轮新核」N1 之后的 9 行没读）。
- 待核 (a) 第 7 点的 D 端断言只做了静态阅读，没有运行。

## P5 修订记录（09-29）

写手：Opus 写手（同一人，按「P5 审查（09-29）」修订）。正文非空白字符 13,829 → 16,996（对照源码之前 9,925；写作标准口径 6,851 字）。

### 结构调整（基础标准第 1–3、11–13 条）

- 按第 12、13 条重排：通用节在前（是什么 → 为什么/代价 → 交接六步 → 交接点 → 抢占、失败和超时 → EPD），GLM 内容集中到一个 H2「放到 GLM 双机：拆开会怎样？」，下分四个 H3（混部时 prefill 拖慢了什么 / GLM 要一起交接哪些状态 / 长提示词 full 组少传块 / 拆成一 P 一 D，末段接 D 上抢占）；其后只有常见误解和对照源码。
- 第一、二屏去掉 GLM 部署数字：288 个专家、7 个图尺寸 / 128 / 32×4 都挪进 GLM 一节；第二屏改用示意数（A、B 各 1 个位置 + 4 个 token 提示词 = 6 个位置），与直觉图一致。
- 第 3、11 条：交接一节加块号小例子（示意：一块 2 个位置，R1 的 p₀–p₃ 占 P#7、P#12，D 分到 #3、#5，逐块读、完成后放块）；少传块一节加 1 个 calc（示意 N = 2,000：应传 4 块，实现算 1 块）。每节开头保留加粗的「是什么」结论。

### P1

- **P1-1 已修。** chunked prefill 在第二屏首次出现处给出一句定义；decode 图 / 回放 / eager / MoE 通信 / MC2 / AllGather 所在的那段整体挪进 GLM 一节的第一个 H3，并在该 H3 开头逐个用一句话讲清（取审查员建议的两种改法之二 + 补定义）。

### P2

- **P2-1 已修，待核 (a) 改成确定说法。** 自己复核：full 组由 MLA 主缓存与 indexer 交错组成、主缓存在前、共用块号（`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L167-L210`；main 同样见 `models/glm5next/cache_config.py#L169-L176`）；上游 `block_size` 是「一块多少个 token」（`vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L96-L102`）；连接器 `_get_group_transfer_info` 逐个 spec 覆盖 compress_ratio、最后取到 4（`mooncake_connector.py#L1680-L1697`，四版同码：2c59ff10 #L1693、2ed6cbba #L1737、baa023ad #L1795 附近）；D 端 `_get_kernel_block_ids` 截成较短一边（`#L2585-L2616`）。页面新增 H3「钉住版本里，长提示词交接时 full 组会少传块」（标明静态阅读、无实测，不用 R1 块数，链接部署页 640 一节不重算），并同步改了支持矩阵那段、常见误解、会报什么错、开销、版本表（新增一行）、源码位置、来源索引。待核只留两项：D 端 remote_block_size 断言会不会先失败（`core.py#L279-L284` 已核 block_size 改为最小值，断言未运行），main 的 V2 是否同样有问题。
- **P2-2 已修。** 第一屏改成一个定义列表：prefill 与 decode、历史状态（含 KDA 一句）、块与块池与块号、调度器、实例；「DP 执行组」补半句定义；「路由专家」移出第一屏，到拆成一 P 一 D 的 H3 里先定义再用；All-Reduce 删掉，改说「不是多张卡一起参与的集合通信」；「源块 / 目的块」在代价列表里首次出现时说明。

### P3（7 条全修）

1. 「vllm-ascend 默认的」改为「设计文档里作示例的」；怎么开补一句「连接器没有默认值，kv_connector 必须显式写」；流程图 caption 同步改；误解里的「默认的 Mooncake V1」改为「Mooncake V1」。依据：`disaggregated_prefill.md#L58`（Taking MooncakeConnector as an example）。
2. 删掉交接点一节末尾与误解重复的那句；480 秒只留在「抢占、失败和超时」，第 5 步改成指向该节。
3. 「没凑满的池」改为解释 indexer 每 4 个位置压成一条、最近没凑满 4 个的单独存成尾状态。
4. 抢占重算改成「约 9 步，推导见并发页」，不复述 8,192 的口径。
5. 补回读法建议（先拿一条请求跟一遍：状态此刻在 P、网络还是 D，哪边的块还押着）。更正写作记录：P17 那句读法建议初稿确实丢了，本轮已补。
6. 版本表 db701c1f 列注明「orphan commit，含 GLM 代码，不在任何发布分支上」（`git branch -a --contains db701c1f` 为空）。
7. 直觉图 `pd-disaggregation-intuition` 标上示意数：提示词「示意 4 个 token」，混合步「1 + 1 + 4 = 6 个位置」，caption 同步。

### 待核 (b)

- 按审查员给的行号复核：Ascend `_sample` 调 `self.sampler`（`model_runner_v1.py#L2585-L2598`），`AscendSampler` 不重写 `forward`（`sample/sampler.py#L46-L125`），上游 `Sampler.forward` 先调 `apply_logits_processors`（`vllm/v1/sample/sampler.py#L96-L100`）。结论成立；误解条目补「Ascend 的采样路径也经过这一步」，源码位置加一行，关掉这条疑点。

### 不同意的地方

- 无。审查员的四处关键行号都已自己打开源码确认。

### 来源与角标

- sources 44 → 52 条（新增 patch_kv_cache_utils、D 端截齐、kv_cache_interface、Ascend sampler、runner `_sample`、上游 sampler、core.py、main cache_config）。角标仍 29 处：C 15 / S 9 / D 2 / I 2 / ! 1（去掉了发送线程、第二个超时、注册表三个 C 角标，换成少传块的 [C45][C9][C46]）。

### 验证

- `pnpm wiki:lint`：通过，本页 0 报错。
- `pnpm wiki:diagrams --check`：201 张图与 spec 一致，本页三张图无报错、无待留意。
- `pnpm wiki:audit`：通过，本页 52 条来源 0 条 ✗。
- `pnpm check:content`：通过。
- checkStandard 单测本页：行内代码 0、正文角标 0、calc 0.15/千字、相邻块 0、图先行、免责 0%、图宽，全部 ✓；跨页链接 17 条锚点全部解析；calc 块用 `parseCalcFence` 解析为 3 行，结构正确。
- 未起服务、未做浏览器验收。

## P5 复审（09-29）

复审员：Opus 5.5 独立复审（只审，未改页面）。页面行号指 `wiki/concepts/pd-disaggregation.md` 当前工作区版本（frontmatter 结束于 76 行，对照源码从 258 行起）。源码在 `tools/repos/vllm`、`tools/repos/vllm-ascend` 里用 `git show <commit>:<path>` 读。

### 结论

- 得分 **8.0 / 10**（首审 7.0）。首审 P1-1、P2-1、P2-2 都已真正修好；本轮新增 P1 **0** 条、P2 **2** 条、P3 4 条。
- `pnpm wiki:audit`：整体 `ok`（133 页，无效 commit / 文件不存在 / 行号越界均为 0）；本页 52 条来源 52 ✓、0 ✗；名单页写作标准 48/48 达标。
- 两项未落定：待核区（343–346 行）两条都写成了「待核：缺什么」，属实；但正文 218、230 行把「D 端不报错」写成了定论，和待核第一条冲突，见新 P2-2。main V2 这一项我读到了源码，结论见下文「main V2 核实」。

### 首审问题逐条复核

- **P1-1（前置概念先用后讲）：已修。** chunked prefill 在第二屏首次出现处（102 行）有一句定义。decode 图、回放、eager、MoE 通信、MC2、AllGather 整段挪进 GLM 一节的第一个 H3，198 行逐个用一句话讲清，后面 200 行才用。第二屏（98–122 行）已经不再出现这些词。
- **P2-1（待核 (a) 落实）：已修，技术内容自己核过，全部对。**
  - full 组把 MLA 主 cache 和 indexer 交错放、主 cache 在前、共用一个逻辑块大小：`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L167-L173`、`#L200-L210`。main 分组方式相同：`baa023ad:vllm_ascend/models/glm5next/cache_config.py#L169-L176`。
  - 上游 `block_size` 表示一块多少个 token（`vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L101-L102`）。MLAAttentionSpec 的 compress_ratio 默认是 1，压缩只影响 storage_block_size（`#L353-L367`）。UniformTypeKVCacheSpecs 的 block_size 取组内共同值（`#L764-L765`）。
  - 连接器逐个 spec 覆盖 compress_ratio，最后得到 tokens_per_block = block_size × 4（`mooncake_connector.py#L1680-L1697`），按 cdiv(prompt_len, tokens_per_block) 截块（`#L1731-L1732`），prompt_len 是截断后的长度（`#L1902-L1903`）。四个版本都是同一段代码：2c59ff10 #L1693/#L1696、2ed6cbba #L1737/#L1740、baa023ad #L1795/#L1798。
  - D 端 `_get_kernel_block_ids` 用 min 截齐（`#L2615-L2616`）。
  - 页面 216–232 行的新 H3 讲法正确：标了静态阅读、无实测，没有用 R1 块数，640 链到部署页没有重算，calc 算式也对。版本表 303 行新增的那一行，v0.26 列写「没有 GLM」也对（2ed6cbba 的 models 下只有 kimi_k3，没有 glm5_next）。
- **P2-2（第一屏前置词）：已修。** 84–88 行给出定义列表（prefill 与 decode、历史状态、块和块池和块号、调度器、实例）；96 行补了 DP 执行组的定义；All-Reduce 已删，108 行改成「不是多张卡一起参与的集合通信」；路由专家挪到 238 行才定义。
- **首审 7 条 P3：** 抽查了 1（262 行写明连接器没有默认值，全页已没有「默认的」）、2（480 秒在正文里只剩 172 行一处）、4（244 行只说约 9 步，推导靠链接）、5（174 行补回了读法建议）、6（300 行表头注明 orphan commit）、7（直觉图 yaml 的 caption 标了示意数），都已落实。

### 两处原待核的复核

- **(a) 少传块：** 页面现在的确定说法和源码一致，行号见上文。只有措辞上的阈值和比例有问题，见新 P2-1。
- **(b) Ascend 采样也屏蔽 EOS：** 253 行说法成立。
  - Ascend runner 的 `_sample` 调用 `self.sampler(...)`（`db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2598`）。
  - AscendSampler 只重写了 apply_penalties、greedy_sample 等方法，没有重写 forward（`vllm_ascend/sample/sampler.py#L46-L125`）。
  - 上游 forward 先调 apply_logits_processors（`vllm@0fc695fc:vllm/v1/sample/sampler.py#L98-L100`），再逐个执行 non_argmax_invariant 处理器（`#L404-L405`）。MinTokens 属于这一类（`logits_processor/builtin.py#L186-L189`）。
  - EOS 会被加进 all_stop_token_ids（`vllm/sampling_params.py#L599-L602`）。

### 写手留下的两项未落定

1. **D 端 remote_block_size 断言会不会先失败（345 行）：** 待核条目写得如实。我补读了以下几处，读完仍然不能在不运行的情况下定论，维持待核：
   - EngineCore 在 KV 初始化后把 cache_config.block_size 改成各组块大小的最小值（`vllm@0fc695fc:vllm/v1/engine/core.py#L279-L284`），调度器在这之后才创建（`#L149-L154`）。所以 P 端连接器调度侧的 block_size（`mooncake_connector.py#L1632`）会以 remote_block_size 发给 D（`#L1925`）。
   - D 端 worker 的 block_size 取自 worker 进程里自己那份 cache_config（`#L2054`），kernel_size = block_size ÷ local_scale（`#L2600-L2601`），local_scale 由缓存张量块数 ÷ 逻辑块数算出（`#L2374`），断言在 `#L2602-L2604`。
   - worker 进程里的 block_size 是多少，要看平台和混合模型改配置的补丁（`vllm_ascend/patch/platform/patch_mamba_config.py#L159-L164`），还要看执行器是否多进程。这些只能跑一次才能确定。
   - **问题在正文**：这条断言和 min 截齐在同一个函数里，而且断言在前。断言一旦失败，就不会走到「不报错、静默错位」这一步。正文 218、230 行却把「不报错」写成了定论，见新 P2-2。
2. **main V2 是否同样少传（346 行、版本表 303 行）：已按源码核掉，V2 没有这处少传。**
   - 注册名 MooncakeConnectorV2 指向 `kv_p2p/mooncake/connector.py` 的 MooncakeConnector（`baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L49-L53`）；它就是 MooncakePullConnector 的别名（`connector.py#L260`），调度侧用 MooncakePullConnectorScheduler（`#L228-L240`）。
   - 这个调度器的 request_finished 用截断后的提示词长度调用 `_get_transfer_block_ids`（`pull_scheduler.py#L614-L616`）。
   - 基类按每组自己的逻辑块大小算块数：`group_block_size = group.kv_cache_spec.block_size`（`base_scheduler.py#L85`），`num_prompt_blocks = cdiv(prompt_len, block_size * cp_size)`（`#L137`），**不乘压缩比**。对 GLM 的 full 组就是 cdiv(N−1, 640)，块数正确。
   - V2 的 D 端 pull_worker 和整条链路在 GLM 上能不能跑通，我没有读完，也没有运行。
   - 建议写手把 346 行改成已核结论（V2 调度侧按逻辑块算，不少传；整条链路未运行），把版本表 303 行 main 列的「V2 未核」改成「V2 不少传」，并在源码位置补上以上行号（见 P3-4）。

### 本轮新问题

**P2-1｜218、230、249 行｜少传块的阈值前后不一致，「约四分之一」说过头了。**
- 218 行加粗结论说：提示词超过一块（640 个位置）就会少传，并且只有应传的约四分之一。230、249 行说的却是：超过 641 个 token 才受影响。按源码，受影响的条件是截断后的长度 N−1 > 640，也就是提示词 ≥ 642 个 token，所以 218 行差了一个。
- 实际发出的块数是 ⌈(N−1)/2,560⌉，应发 ⌈(N−1)/640⌉。N−1 在 641–1,280 时是 1 块对 2 块，只少一半；要到很长的提示词，比例才趋近四分之一。
- 影响：加粗结论是问答最容易直接引用的一句，读者会以为「刚过一块就只剩四分之一」。
- 改法：218 行改成「提示词超过 641 个 token 时就开始少传，越长越接近只传四分之一」，与 230、249 行统一。

**P2-2｜218、230 行｜「D 端不报错」写成了定论，和 345 行待核冲突。**
- 218 行说「D 端按较短的一边对齐，不报错」，230 行说「这是一种不报错的错误状态」。可是同一函数里更早一步的 remote_block_size 断言（`#L2602-L2604`）会不会先失败，345 行明确写着待核。断言先失败的话，结果是启动后第一次交接就报 AssertionError，而不是静默错位。
- 影响：有人问「GLM 走 PD 长提示词会报错吗」，正文给出的是一个未经验证的确定答案。
- 改法：230 行改成条件句，例如「如果 D 端更早的块大小断言没有先报错（见『源码位置』的待核），D 会截成较短的一边……」；218 行的「不报错」同步改成「即使走到截齐这一步也不报错」，或者删掉。232 行「不能当成能正常交接」的结论在两种情况下都成立，可以保留。

**P3**
1. 94 行「同一个执行组」先用，96 行才定义 DP 执行组。可以把 96 行的定义句前移，或者 94 行先写「同一组机器」。
2. 84 行的 MTP、102 行的 TP 和 EP 都在前两屏首次出现，没有一句话解释。可补半句，或加链接到 [MTP] 页和 tensor-parallel、expert-parallel 页。
3. 139–146 行的块号小例子用 R1 的名字，配的却是假设的「一块 2 个位置、纯注意力模型」。前提已经写明，不算写 R1 块数，但问答容易把「R1 占 P#7、P#12 两块」当成事实。建议去掉 R1 的名字，只说「一条 4 个 token 的提示词」。
4. 按上文「main V2 核实」，更新 346 行的待核、303 行版本表的 main 列，在源码位置补上 V2 的行号。

### 丢信息核对（本轮）

- 当前版对照 p4-checkpoint（`git diff --stat`：+284/−53），删掉的都是旧版正文，首审已逐条核过。
- 本轮修订声明的几处删改：480 秒重复、交接点末尾与误解重复的那句、All-Reduce、8,192 的重推导、第一、二屏的 GLM 数字。逐项 grep 核对，信息都还在，只是换了位置：480（172 行）、288 个专家（238 行）、7 个图尺寸和 128 = 32 × 4（200 行）、38.72 GiB 和 1,577 块（236、238 行）、约 67,000 个位置和约 9 步（244 行）、kv_port、extra_config、Layerwise、LMCache、SfaRemoteD2H、MooncakeHybrid、last_token_id 都还在。
- 首审 P3-5 提到的读法建议已补回（174 行）。本轮没有新丢的信息。

### 其他核对

- 新增链接的锚点都能解析：`glm-5-3-flash-two-node.md` 的「为什么一个逻辑块是 640 个 token」（D 页 191 行）、「为什么是两台机器，不是一台」（101 行）、「启动时发生了什么」（245 行）；`kv-cache.md` 137 行；`prefill.md` 167 行；`concurrent-requests.md` 227 行。
- 对照源码之上没有证据角标（77–257 行 grep 为 0）。本节只有 1 个 calc（222–228 行），不和表格相邻。页面上没有 meta 文本。
- 版本口径：表头 v0.23（2c59ff10）、db701c1f（已注明 orphan commit）、v0.26（2ed6cbba）、main（baa023ad），合格。

### 本次跳过/未做

- frontmatter 的来源清单没读，由 audit 校验。「对照源码」正文只 grep 了版本表表头、303–305 行和 343–351 行的待核，其余没读。
- 三张图没有重新渲染看图，只 grep 了直觉图 yaml 的 caption 和 label。没有起服务，也没有做浏览器验收。
- 写手的 facts.md 清单没有重新逐条勾，只 grep 核了关键数字和术语是否还在。
- D 端断言和 V2 整条链路都只做了静态阅读，没有运行。
- 没有跑 `wiki:lint` 和 `wiki:diagrams --check`，这两项依据写手的验证记录。

## P5 复审后修订（09-29）

写手：Opus 写手，按「P5 复审（09-29）」修订。正文非空白字符 16,996 → 18,017（写作标准口径 7,096 字）。

### P2（2 条已修）

- **P2-1 阈值与比例统一。** 少传块一节的加粗结论改为「提示词超过 641 个 token 时开始少传，刚过时只传一半，越长越接近只传四分之一」，与该节后文和常见误解里的 641 一致。依据：截取块数 ⌈(N−1)/2,560⌉ 对应应传 ⌈(N−1)/640⌉（`mooncake_connector.py#L1680-L1697`、`#L1731-L1732`、`#L1902-L1903`）。
- **P2-2 「不报错」改成条件说法。** 加粗结论不再说「不报错」，改为「传少以后是先报错还是静默错位，见后文」；后文先讲同一函数里先做的块大小断言（`#L2602-L2604`），写明会不会先报 AssertionError 取决于 D 的 worker 进程里块大小被改成多少，缺一次双机实际运行；再说如果检查通过，截齐这一步不报错、成了静默错误状态。calc 旁注改为「若走到截齐这一步」。「会报什么错」里那条同步改成先断言、后截齐。

### main V2（已改成确定结论）

- 自己复核：注册名 `MooncakeConnectorV2` 指向 `kv_p2p/mooncake/connector.py` 的 `MooncakeConnector`（`vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L49-L53`），即 `MooncakePullConnector` 的别名（`connector.py#L260`），调度侧是 `MooncakePullConnectorScheduler`（`#L228-L240`）；`request_finished` 用截断后的提示词长度调 `_get_transfer_block_ids`（`pull_scheduler.py#L610-L618`）；基类按 `group.kv_cache_spec.block_size` 逐组算 `cdiv(prompt_len, block_size * cp_size)`，不乘压缩比（`base_scheduler.py#L84-L85`、`#L118-L140`）。
- 页面：待核区这一项改成「已核：V2 不少传」，只留「V2 的 D 端与整条链路能否跑通，缺源码通读和一次运行」；版本表 main 列改成「V1 会少传，V2 按每组逻辑块大小算、不少传」；源码位置新增一行 V2；sources 52 → 56 条。

### P3（4 条已修）

1. 第一屏图注「同一个执行组」改成「同一组机器」，DP 执行组的定义仍在下一段首次出现处。
2. MTP 在第一屏首次出现处补一句（小的草稿层先猜后面几个 token，decode 步一起验证）并链接 speculative-decoding；第二屏 DP、TP、EP 各补一句并链接各自页面。
3. 块号小例子去掉 R1 的名字，改说「一条 4 个 token 的提示词」，并注明块号是编的；R1 挪到下一节交接点图处首次介绍。
4. 同上「main V2」。

### 验证

- `pnpm wiki:lint`：通过，本页 0 报错。
- `pnpm wiki:diagrams --check`：210 张图与 spec 一致，本页无报错。
- `pnpm wiki:audit`：通过，本页 56 条来源 0 条 ✗。
- checkStandard 单测本页：全部 ✓（免责 0.5%，那一句是指向页末待核的说明）；跨页链接 21 条锚点全部解析。
- 未起服务、未做浏览器验收；D 端断言与 V2 整条链路仍只做了静态阅读。
