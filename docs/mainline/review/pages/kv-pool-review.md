# kv-pool 审查记录

## P5 写作记录（2026-09-29，第 15 批深改，Opus 5.5）

### 接手时的状态

- 现版与 p4-checkpoint 相同；p4-checkpoint 已是 GPT 重写版（6 个 H2、1 张图、无「对照源码」、正文 1,826 字）。重写前最后一版是 0f97c8b（含对照源码五节，数字属于旧示例模型 Qwen3.6-35B-A3B、两颗 NPU、块 2048）。两版的信息清单都列在 scratchpad `13898c74…/scratchpad/p5/kv-pool-facts.md`（F1–F34、P1–P13，另列本轮新核 N1–N12）。
- 字数（wiki:audit 口径，body.length）：1,826 → 16,747；教学正文（「对照源码」之前）1,826 → 约 9,100。

### 改了什么

- 按 09-29 讲法重排：是什么（一句话定义 + 直觉图）→ 为什么需要与四条代价 → 一次查询怎样算（取整、相减、全中留一，1 个 calc + 范围图）→ 查到以后（查询、分配、搬运、使用、写回；失败、逐层、PD）→ 池里一条记录的名字 → 和抢占换出、CPU 备份的区别（对象、粒度、存取时机、恢复条件对照表）→ GLM 双机（未开，推演）→ 常见误解 → 对照源码五节 + 来源与结论对应 + 待核。
- 标题改为「KV Pool：把算过的开头存进外部池，别的实例也能取回」；summary（162 字，≤200）、aliases 更新；updated 改 09-29。index.md 里的旧标题没动（不属本页范围）。
- relations：保留 prefix-caching、block-table；新增 vllm-kv-block-allocation（builds-on）、recompute-cpu-offload 与 kv-cache-cpu-offload（alternative-to）。kv-cache-cpu-offload 只链接、只写它的标题级描述，没有改那一页。
- sources：原 4 条行号更新并扩到 42 条（db701c1f 源码与文档、vLLM 0fc695fc、v0.23 2c59ff10、v0.26 2ed6cbba、main baa023ad），wiki:audit 42 条全部 ✓。
- 图：新增直觉图 `kv-pool-intuition`（实例 1 → 外部池 → 实例 2，①写进池 ②查询 ③搬回 ④只算尾巴）；原图 `kv-pool` 改标注（本地命中 8、从池里搬 12、自己算 4，每格一段 4 个位置示意）；新增 GLM 图 `kv-pool-glm-cards`（8 卡 full 组同一份 → 池里每块 1 条；KDA 64 头按卡切 → 每块 8 条；名字里无 DP 编号）。借参考图库 amd-06 「把状态直接写在每张卡上」的讲法，用本站图元重画。分镜动图按 09-29 暂停令未加。
- 正文角标全部移到对照源码末尾「来源与结论对应」：24 处，C 19（79%）、A 1、D 2、I 2。正文（对照源码之上）行内代码 0 处。每节 calc ≤1（第 3 节 1 个、GLM 节 1 个），表格与 calc 不相邻。

### 数字取自哪里

- 基础节全用示意数：请求 A 24 / 8 / 20 个位置、一段 4 个位置（沿用 p4 版 P4），长度 10、35 配一段 16（沿用 P8），全中例 19 − 8 = 11（沿用 P5）。KV cache 页示意模型「4,096 token 占 512 MiB」只引用并链接 kv-cache「存一份要多少」。
- GLM 数字只在 GLM 一节：块长 640 / 4 / 133,120 与五个组引自 kv-cache-spec 与 01 §A2.3（L689 的 lcm(640, 4, 133120)）；每块号 8,355,840 B 引自 D「占住一个块号要用多少显存」；KDA 每卡 8 个头引自 02 §4.3。部署无 KV connector、prefix caching 关，引自 01 L628 与 D「怎么开」。
- 本页唯一新推的数：把 patch_mamba_config 与段长规则代入 GLM 块长，得到「只加 KV Pool 段长 133,120、再开 prefix caching 段长 640、R1 可查长度 0」，calc 标题写明「照镜像源码推演，不是部署状态」，来源对应标 [D]。
- 变体收益：无任何外部池实测数；GLM 主线数字没有当成 KV Pool 的效果；吞吐、TTFT、命中率、带宽写入页末待核。01 §B3 的抢占算例只链接，没有拿来算池能省多少。

### 核心概念对照了什么（db701c1f，另注明的除外）

- 查询：pool_scheduler.py 491–591（consumer 门槛、retention 间隔、取整、本地已覆盖即跳过、LookupKeyClient 带 hbm_hit_tokens、全中减 1、池不多于本地即 0、逐层强制加载、返回 load_async 且非逐层）。
- 段长：同文件 104–121、417–429（lcm(各组块大小 × CP)，再与本 rank 各组 family 粒度取 lcm）；config_data.py 126–143（family 压缩比）；写入取整 654–657。
- 调度侧也有后端客户端：同文件 155–159（create_scheduler_client），逐层查询 247–262 直接 batch_is_exist，故正文把「调度器不自己查池」限定为非逐层。
- 名字：config_data.py 26–77（KeyMetadata、PoolKey.to_string）；各版格式 2c59ff10 66–76、2ed6cbba 114–124、baa023ad metadata.py 116–126。
- 卡号取法与写入分摊：pool_worker.py 174–194（MLA 时 num_kv_head = 1，put_step = tp_size，head_or_tp_rank = 0）、219–237（align 状态组用 tp_rank）；kv_transfer.py 734–745（非 align 组按 candidate_index % put_step 预分片；candidate_index 是本批通过过滤的块序号，正文据此写「一批要存的块依次轮流」）；config_data.py 422–484 核过 candidate_index 语义。
- 搬运：pool_worker.py 722–732（register_buffer）、776–790（load_async 分派）、838–866（get 失败记 _invalid_block_ids）；config_data.py 359–387（地址 = base + block_id × stride，一条记录列出本组每层地址）。
- 写回：pool_worker.py 1432–1450（录 NPU Event、add_request、request_queue.join）；kv_transfer.py 836–839（synchronize 后 put）；main pool_worker.py 2595–2639 与 connector 248–255（save batch、下一步 handle_preemptions 再等）。
- 查询服务：ascend_store_connector.py 109–123（角色分派、rank 0 且非逐层起 LookupKeyServer）、293–339（ZMQ REP 线程，4 字节大端）；pool_scheduler.py 1146–1161（IPC 路径带 dp_rank，mooncake_rpc_port 旧名告警）。
- 混合模型：patch_mamba_config.py 26–41（_using_kv_store 认 MultiConnector）、60–73、205–226（none → align；开 prefix caching 且 align 时 mamba_block_size = block_size，否则 max_model_len）；三版 2c59ff10 / 2ed6cbba / baa023ad 都有同样逻辑（git grep 核对）。pool_worker.py _infer_group_uses_align_state（MambaSpec 且 align）。
- GLM 指纹粒度：patch_kv_cache_utils.py 358–392（prefix caching 或 connector 开时取 gcd，不整除报 ValueError）。
- 上游 vLLM 0fc695fc：scheduler.py 609–620（num_computed_tokens == 0 的等待请求才问 connector，含被抢占清零者）；2286–2293（无效块处理按单组解包，留 hybrid TODO → 写入待核）；config/kv_transfer.py 70–73（kv_load_failure_policy 默认 fail）；kv_cache_utils.py 98–113（未设 PYTHONHASHSEED 时 NONE_HASH 随机）；config/vllm.py 1479–1500（connector 不支持 HMA 时自动关混合缓存管理；AscendStoreConnector 继承 SupportsHMA）。
- main 报错：mooncake_layerwise.py 55–75（纯 TP、递推状态、TP 不一致）；pool_worker.py 298–312（混合布局 TP 不一致 NotImplementedError）；backend/base.py 20–30（qos_priority）。
- 官方文档（db701c1f）：kv_pool.md 21–50（失败策略、混合注意力模型不支持 recompute、参数表、PYTHONHASHSEED）、108–120（global_segment_size 每卡、1GB 对齐、环境变量优先）、297–307（MLA 模型 D 可写池）；设计文档 5–15、31–52（动机、只取多出来的块、不走 LMCache）。main 文档参数表仍写 use_layerwise 需 memcache（baa023ad kv_pool.md 33 行）。
- 版本表逐项：v0.23 save_kv_layer consumer 一律 return（2c59ff10 connector 234–242），v0.26 看 consumer_is_to_put（2ed6cbba 245–257）；v0.26 backend 目录无 mooncake_layerwise（ls-tree）。db701c1f 与 2c59ff10 在键格式、逐层 D 不写池、join 位置三项一致。

### 旧版信息清单勾选

- F1 定义与「接在 prefix caching 后面」：第 1 节、第 3 节。✓
- F2 动机（换机器、被挤出）：第 2 节两条；旧版 4096 token 文档例改成通用描述 + kv-cache 示意数。✓
- F3 相减、设计文档「只取多出来的块」：第 3 节 calc；来源对应第 28、29 项。✓
- F4 「关掉前缀缓存，池就没有起点」：**删除并改正**。源码 491–591 本地命中为 0 照样查询（p4 版 P10 也指出）；正文第 3 节「本地命中是 0 也照样查」与误解第 1 条改写为：一般不要求本地命中，但 GLM 上不开 prefix caching 时 KDA 块长 133,120 使池不被查询（N2）。
- F5 指纹与「只知道在不在」：第 5 节指纹；第 4 节第 1 步「问在不在」。✓
- F6 短请求不查：GLM 节 R1 可查长度 0（旧 37 token / 2048 属旧模型，不再引用）。✓
- F7 块长由线性注意力状态倒推：GLM 节，链接 D「为什么一个逻辑块是 640」经 kv-cache-spec。✓
- F8 旧模型 4096 token 算账表（20 MiB、40 MiB、约 50 块）：**删除**，理由：旧示例模型已不是本站主线，数字不适用 GLM；GLM 对应量为每块号 8,355,840 B（D）；global_segment_size 1GB 每卡保留在「怎么开」「开销」。
- F9 线性注意力状态字节未核：GLM KDA 每块字节写入页末待核。✓
- F10 容量重估：开销「容量」一条；TP1 翻倍属旧模型，改为「按布局算、只存一份的不乘卡数」。✓
- F11 调度器托 Worker 后台线程代查：第 4 节第 1 步；源码限定为非逐层。✓
- F12 裸地址、登记显存、无中转、贴合昇腾：第 4 节第 3 步。✓
- F13 三种后端：怎么开。✓
- F14 换模型 / 换 TP 对不上：第 5 节。✓
- F15 升级等于清池：第 5 节 + 版本差异。✓
- F16 层不进键、一条记录覆盖全部层：第 5 节。✓
- F17 PD 下 D 不碰池：第 4 节末段。✓
- F18 读同步：第 4 节第 3 步 + 开销。✓
- F19 写有栅栏、join 位置三版差异：第 4 节第 5 步 + 开销 + 版本差异。✓
- F20 lookup_rpc_port 不是 TCP 端口：误解第 6 条 + 怎么开。✓
- F21 不替代 prefix caching：误解第 1 条（改正措辞，见 F4）。✓
- F22 查到不一定能用、fail 默认、混合不支持 recompute：第 4 节 + 误解第 2 条。✓
- F23 混合模型能用、自动 align：误解第 7 条 + GLM 节 + 怎么开。✓
- F24 配置示例、PYTHONHASHSEED：怎么开 + 第 5 节（种子为何必须一致，新核 N12）。✓
- F25 global_segment_size 每卡：怎么开 + 开销。✓
- F26 角色开关与默认值：怎么开。✓
- F27 discard_partial_chunks、粒度 lcm：第 3 节 + 怎么开。✓
- F28 _using_kv_store、align、mamba_block_size、每组 KeyMetadata：怎么开 + GLM 节。✓
- F29 各报错：会报什么错全部保留（NotImplementedError 在 baa023ad pool_worker 298–312 重新核到）；新增 GLM hash_block_size 报错与 PYTHONHASHSEED 告警。✓
- F30 开销各条：开销节。✓（「每 token 字节只对 K、V 分张量成立」改写为「按实际布局算」）
- F31 版本表：版本差异 6 行全保留并加文件名行。✓
- F32 源码位置：源码位置表 + 怎么开；「main 调度器也有存储客户端」经核 db701c1f 同样有（create_scheduler_client），写进怎么开并据此限定第 4 节第 1 步。✓
- F33 main 改名：版本差异「文件名」行。✓
- F34 文档仍写逐层需 memcache：版本差异。✓
- P1 后端决定跨机 / 持久化：第 1 节。✓
- P2 恢复前需本地块与映射：第 1 节末 + 第 4 节第 2、4 步。✓
- P3–P5 相减、24 位置例、全中留一、逻辑位置 ≠ 字节：第 3 节。✓
- P6 五步生命周期、命中 ≠ 驻留：第 4 节。✓
- P7 键字段、不同状态不可互换：第 5 节。✓
- P8 粒度取整与例子：第 3 节。✓
- P9 逐层强制加载：第 4 节。✓
- P10 本地命中 0 也能查：第 3 节 + 误解。✓
- P11 选型前先明确粒度、身份、完成信号、失败：分散到第 3、4、5 节与「什么时候别开」。✓
- P12 GLM 需覆盖全部缓存组、未做设备验证：GLM 节开头声明 + 页末待核。✓
- P13 LMCache、UCM：第 4 节第 3 步（LMCache）+ 第 6 节末段。✓

### 自查

- 首图位置：第 1 节一句话定义与前置词之后，图前无数字、无 calc。
- 前置概念：KV cache、prefix caching、KV connector、block table、DP 组、TP、缓存组、抢占、KDA、R1 均在首次出现处一句话解释并链接。
- GLM 数字只在 GLM 一节；通用节无 GLM 部署数。
- P1 疑点：无。需审查重点看两处推断：(1) 段长 133,120 使「只加 KV Pool」时不发查询——依据 patch_mamba_config 205–226 与 pool_scheduler 104–121、417–429、491–530，静态推演未实跑；(2) GLM full 组「每块 1 条」——依据 head_or_tp_rank = 0，但 full 组的 MLA 与 indexer 是否拆成多段地址、一条记录多少字节列入待核。

### 验证

- `pnpm wiki:lint`：通过，本页 0 报错（中途一次全库失败在 concepts/large-scale-ep.md，非本页，最终复跑已通过）。
- `pnpm wiki:diagrams --check`：253 张图与 spec 一致；本页三张图无提醒。
- `pnpm wiki:audit`：本页 42 条来源全部 ✓。
- 三张图用 Playwright 渲染成 PNG 目视检查过布局（未起服务）；浏览器页面验收留给审查环节。
- 途中主会话通知 summary 超过 200 字导致 schema 失败，已缩到 162 字并重跑 lint 确认 relation-missing 为 0。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，未开子代理，只审未改页）。分数 **7.5 / 10**。学习顺序通过；`pnpm wiki:audit` 本页 42 条来源全部 ✓；`pnpm wiki:lint` 通过（本页 0 报错、0 提醒）。

### 初学者测试（只读前两屏）

KV Pool 是显存之外、多台实例共用的一块存储：算过的整段开头存进去，别的实例遇到相同开头就搬回显存、省掉这段 prefill；代价是搬运要等、写回占时间和容量、只认写满的整段、名字（模型 / 切分 / 版本 / 种子）要对得上。——前两屏能说清。

### 学习顺序与讲法

- 顺序：是什么（一句话 + 前置词各一句 + 直觉图）→ 为什么需要与四条代价 → 一次查询怎样算（calc + 范围图）→ 查到以后 → 名字 → 与换出 / CPU 备份的区别 → GLM（未开，推演）→ 常见误解 → 对照源码。基础节只用示意数，GLM 数字只在 GLM 一节。**通过。**
- 重讲检查：kv-cache、prefix caching（L68 各一句 + 链接；L86 预算规则只链接）、PD 分离（L148 一句 + 链接）、kv-cache-cpu-offload（L168 一句 + 对照表一列，与该页 summary 一致）、抢占（L168 一句 + 链接）。**无重讲。**
- 注水 / 重复：教学正文约 9,100 字，各节都引入新机制，**无大段注水**；有小重复（见 P3-4）。
- 无 meta 文本；正文行内代码 0、角标 0；每节 calc ≤ 1，calc 与表格不相邻；未新增分镜。
- 对照源码五个 H3 齐全、顺序正确（L224 / L248 / L257 / L267 / L280）；版本差异里 v0.23、v0.26、main 均出现，db701c1f 单独注明为含 GLM 代码的镜像提交。

### 浏览器实测（Playwright 1440 宽，用户预览 5193）

- 截图：scratchpad `580bfd6e…/scratchpad/kv-pool-review-1.png`（第一屏）、`kv-pool-review-fig1…fig5.png`（直觉图、请求 A calc、范围图、GLM calc、8 卡图）。9 个 H2 与源文件一致，3 张图 + 2 个 calc 正常渲染，文字不重叠。控制台 4 条 502 资源错误（未定位 URL，页面渲染不受影响）。

### 示意演算逐个手算

| 位置 | 算式 | 结果 |
|---|---|---|
| L114–118 | floor(24÷4)×4 = 24；20−8 = 12（第 8–19）；24−20 = 4（第 20–23） | ✓ |
| L127 | 段 16：10 → 0；35 → 32，剩 3 | ✓ |
| L129 | 全中 20 → 报 19，19−8 = 11 | ✓（pool_scheduler.py L548–555） |
| L86 | 128 KiB × 4,096 = 512 MiB | ✓（kv-cache.md L151） |
| L191–193 | lcm(640,4,133,120) = 133,120（=640×208）；lcm(640,4,640) = 640；floor(4÷640)×640 = 0 | ✓ |
| L206 | 8,355,840 = 12×655,360 + 12×40,960；655,360 = 640×512×2；40,960 = 160×128×2 | ✓（01 L220–225）；该块号开销恰等于 full 组数据量，引用成立 |
| L162/L206 | 8 卡轮流：第 9 块 → 8 mod 8 = 卡 0；64 头 ÷ 8 = 8 头/卡 | ✓（kv_transfer.py L734–745；02 L271） |
| L198 | gcd(640, 4, …) = 4 | ✓（patch_kv_cache_utils.py L356–392） |

### 核心机制对照（db701c1f，另注明者除外）

- 查询：consumer 门槛、retention 间隔、取整、不足一段不查、本地已覆盖跳过、LookupKeyClient 带本地命中、全中减 1、池不多于本地即 0、逐层强制加载、返回 `load_async and not use_layerwise`——pool_scheduler.py L508–589 逐条 ✓。查询只看 `len(request.prompt_token_ids)`（L511），故「被抢占的请求最多补回 prompt 整段」✓；vLLM 只对 `num_computed_tokens == 0` 的等待请求问 connector（vllm 0fc695fc scheduler.py L609–620）✓。
- 段长：`lcm(各组块大小×CP)` 再与各组 family 粒度取 lcm（L108–121、L417–429）✓，但正文只写了前半，见 P3-1。
- 查询服务：非逐层且 `parallel_config.rank == 0` 起 LookupKeyServer（ascend_store_connector.py L109–123）；IPC 路径 `lookup_rpc_port_{port}_dp_rank{dp}`（pool_scheduler.py L1146–1161）✓，误解第 6 条成立。
- 默认值：`consumer_is_to_load` / `consumer_is_to_put` / `load_async` 默认 False（L87–93）✓；vLLM `kv_load_failure_policy` 默认 `fail`（config/kv_transfer.py L70）✓；官方文档写混合注意力模型不支持 recompute（kv_pool.md L25）✓；未设 PYTHONHASHSEED 时 NONE_HASH 取 `os.urandom`（kv_cache_utils.py L108–111）✓。
- 写回：`wait_for_save` 录 NPU Event、入发送队列、`request_queue.join()`（pool_worker.py L1432–1450）✓。
- 逐层从第 0 块查（pool_scheduler.py L253–256）✓；AscendStore 继承 SupportsHMA（connector L76），vLLM 只在 connector 不支持 HMA 时自动关（config/vllm.py L1479–1500）✓。
- 名字：PoolKey 字段与 to_string（config_data.py L26–77、L110–123）✓；层号不进非逐层名字 ✓；无 DP 编号 ✓；**但「换 TP 就对不上」的推论错，见 P1-1。**

### 写手两处「静态推演」的核对

1. **只加 KV Pool 时段长 133,120、查询不发出**：用源码 grep 串起整条链——patch_mamba_config.py L215–225（接 AscendStore 且 HMA 开 → none 改 align；未开 prefix caching → `mamba_block_size = max_model_len`）→ vllm mamba/abstract.py L44–51（KDA 未覆写 `get_kv_cache_spec`，组块长 = `mamba_block_size`）→ pool_scheduler.py L117（lcm）与 L528–529（`token_len < granularity` 直接返回 0）；`max_model_len = 133120` 见 01 L43、L640。family 因子：full 组是 MLA（无压缩）+ indexer（`compress_ratio = 4`，glm5_next.py L1301–1313）→ 按 config_data.py L171–186 判为 mixed，倍数 1；尾状态组至多 c4 → 16，能整除 640 与 133,120，不改结论。**静态结论成立，只差实跑。** 页面标注：GLM 节导语 L183、calc 标题 L190 已标「推演」；但 H3 标题 L185、L196 与误解第 1 条 L214 是肯定句，且页末待核只写「确认段长 640」，没写 133,120 这一支，见 P3-2。
2. **full 组每块 1 条**：patch_glm5_next_config.py L17–20 让 GLM 的 `use_mla` 为真 → pool_worker.py L178–185 `num_kv_head = 1`、`put_step = 8`、`head_or_tp_rank = 0` → L219–221 非 align 组用 `head_or_tp_rank`、KDA（align）组用 `tp_rank`。**卡号取法与「每块 1 条 / KDA 每块每组 8 条」由源码核掉**；一条记录登记几段地址、多少字节仍待核，页末已列。图 3 说明文字标了「照镜像源码推演」✓。

### 丢信息

对照 p4-checkpoint（6 个 H2）与 0f97c8b（含对照源码五节）的 H2 逐条查，并抽查写手 F4、F8、F14、F20、F22、F23、F26、F29 勾选：F4 改正属实（本地命中为 0 照样查，L535–544）；F8 删旧模型算账理由成立。未发现丢失信息。未打开 p5\kv-pool-facts.md 逐条复核全部 47 项。

### 链接

正文 22 个链接目标（含 7 个锚点）经 lint 跨页锚点硬校验通过；全库 40 个文件链到 kv-pool.md，均无锚点，不受标题改动影响。

### 问题清单

**P1（1）**

- **P1-1 换 TP 的后果讲反了**（L98「换并行切分…一条也找不到」、L158「TP 从 8 改成 4…旧记录一条也用不上」、L218「换了 TP…就一条也对不上」）。名字里只有本卡的卡号 / 头号（`head_or_tp_rank`）和 pcp/dcp/pp 编号，**没有 TP 大小**（config_data.py L26–77）。于是：(a) MLA 这类只有一个 KV 头的缓存，所有卡都取 0（pool_worker.py L178–185），TP 8 改 4 后名字照样对得上、内容也相同，可以正确复用——这和本页 L162、L206 自己的讲法矛盾；(b) 按卡切开的状态（KDA align 组用 `tp_rank`，L221；KV 头数 ≥ TP 的普通 attention 也用 `tp_rank`），换 TP 后卡号 0–3 的名字仍能撞上旧记录，但每卡切到的头变了，结果是「名字撞上、内容或大小不对」，不是「找不到」。main 甚至专门按头号支持 P/D 两侧 TP 不同（baa023ad metadata.py L40–75，MLA 与混合布局除外）。**改法**：L158 改成「名字里有卡号，没有 TP 大小：只有一个 KV 头的缓存各卡相同，换 TP 后照样能对上、也能正确复用；按卡切开的状态换 TP 后名字还可能撞上，但每卡的切片已经变了，所以要换一个池或清空」；L98、L218 同步改；版本差异里补一句 main 按头号支持 P/D TP 不同。

**P2（1）**

- **P2-1 写回范围缺默认条件**（L96「每写满一段都要往池里存一份」、L174 表格「每写满一段就存」）。默认只存 prompt（含 chunked prefill）写满的段；decode 阶段新写满的段要开 `save_decode_cache` 才存，默认 False（pool_scheduler.py L96–97、L817–822）。**改法**：L96 与表格改为「prompt 部分每写满一段就存；decode 生成的部分默认不存」，「怎么开」补 `save_decode_cache`；L177「生成部分仍要重算」可顺带点出这也是原因之一。

**P3（5）**

- **P3-1 段长规则不完整**（L128）：实际是 `lcm(各组块大小 × CP)` 再与各组「块大小 × 压缩比」取 lcm（pool_scheduler.py L108–121、L417–426）。GLM 数不受影响（见上），但作为通用规则应补一句「带压缩的缓存组按块大小 × 压缩比算」，或在对照源码里说明。
- **P3-2 推演句式**：L185 H3 标题、L196、误解第 1 条 L214 用肯定句；建议 L214 加「（照镜像源码推演）」，页末待核第 1 条补「以及只加 KV Pool 时段长为 133,120、一次查询都不发出」。
- **P3-3 术语先用后讲**：「缓存组」L78 先用、L128 才解释（有「下文细讲」指引）；「indexer」L187 未解释。建议 L78 顺带加半句括注，L187 给 indexer 一个短括注或链接。
- **P3-4 小重复**：「被抢占的请求最多补回 prompt 整段」出现 3 次（L177、L210、L217），「名字对不上」4 次（L98、L154–159、L218），「一个 KV 头只存一份」3 次（L162、L206、L216）。误解节可只留一句结论 + 回指。
- **P3-5 图 `kv-pool-glm-cards`**：GLM 有 3 个 KDA 组，图中「KDA 组：每块 8 条」是每组每块 8 条，建议标签改「每个 KDA 组」。

### 跳过

frontmatter 来源区（由 audit 校验）、「对照源码」正文（只 grep 了五个 H3 顺序、版本号、TP 与 db701c1f 相关行）、代码块；p5\kv-pool-facts.md 未逐条复核，只抽查 8 项。

## P5 修订记录（09-29）

### P1

- **P1-1 换 TP 的后果（已改）。** 按 db701c1f config_data.py 26–77（名字字段无 TP 大小）与 pool_worker.py 174–194（KV 头 < TP 时 `head_or_tp_rank = tp_rank // put_step` 为头号，否则为卡号；MLA 全取 0）重写第 5 节第 2 条：换模型才「找不到」；换 TP 时按头号起名的缓存名字对得上、内容也对，按卡号起名的（KV 头不少于卡数的 attention、线性 attention 状态）名字撞上但内容和大小不对，所以改切分要换池或清空。第 2 节代价第 4 条、误解「接到同一个池」改为一句话 + 页内链接 `#池里一条记录叫什么名字`。版本差异新增一行「P/D 两端 TP 不同」：v0.26 `2ed6cbba` config_data.py 36–71 与 main metadata.py 40–75 的 `infer_tp_mismatch_info`（MLA、混合布局除外），v0.23 维护分支与 db701c1f 没有；「怎么开」补头号 / 卡号两种取法。新增来源第 44、45 项。

### P2

- **P2-1 decode 部分默认不写回（已改）。** 依据 db701c1f pool_scheduler.py 96–97（`save_decode_cache` 默认 False）与 817–822（prompt 未算完的 chunked prefill 增量总是存，decode 增量受开关约束）。改了第 2 节代价第 2 条、第 4 节第 5 步、第 6 节对照表「什么时候存」和恢复条件一段（补「decode 写满的段默认也不进池」）；「怎么开」新增 `save_decode_cache` 一条。新增来源第 43 项（pool_scheduler.py 814–822）。

### P3（5 条全改）

- P3-1 段长规则补「带压缩的组按块大小 × 压缩比算」（第 3 节）。
- P3-2 GLM 第一个 H3 改为「推演下来一次查询都不会发出」，正文句首加「按这条推演」，误解第 1 条加「（照镜像源码推演）」，页末待核第 1 条补 133,120 这一支。
- P3-3 「缓存组」在第 1 节首次出现处加括注；GLM 节给 indexer 加一句解释并链接 sparse-attention。
- P3-4 去重：抢占补回只在第 6 节讲，GLM 节「抢占时能省多少」与误解改成一句话 + `#和抢占换出cpu-备份有什么不同`；「名字对不上」只在第 5 节讲；「一个 KV 头只存一份」只在第 5 节讲，GLM 节改为「套用上文的起名规则」+ GLM 数，误解改成一句话 + 链接。
- P3-5 图 `kv-pool-glm-cards`：标签改「每个 KDA 组：每块 8 条」，说明改「3 个 KDA 组每组每块存 8 条」；两处 sub 的「卡号」统一成「编号」，与正文一致。

### 验证

- `pnpm wiki:lint`：每次保存后都跑，最终「通过（另有 10 处待留意）」，本页 0 报错。
- `pnpm wiki:diagrams --check`：257 张图与 spec 一致，本页无提醒；GLM 图重新渲染成 PNG 目视检查过。
- `pnpm wiki:audit`：本页 45 条来源全部 ✓；正文 17,926 字。
- 角标：新增三项来源在「来源与结论对应」里只写「对照第 43–45 项来源」、不加角标，保持 24 处、C 占 79%。

## P5 复审（09-29）

复审员：Opus 5.5（独立复审，未开子代理，只审未改页）。范围：上一轮 P1-1、P2-1 与三处重复；未重审整页。分数 **8.5 / 10**（上一轮 7.5）。`pnpm wiki:audit` 退出 0，本页 45 条来源全部 ✓（新增的第 43–45 项都在）；`pnpm wiki:lint` 通过，本页 0 报错、0 提醒。

### P1-1 换 TP 的后果：已修好

独立到各钉住版本的源码核对：
- db701c1f config_data.py L26–43（KeyMetadata）与 L66–76（to_string）：名字字段是 model_name、head_or_tp_rank、pcp/dcp/pp 编号、group、cache_role、cache_family、chunk_hash，**没有 TP 大小**。
- db701c1f pool_worker.py L178–188：MLA 时 `num_kv_head = 1`；KV 头 < TP 时 `put_step = tp_size // num_kv_head`、`head_or_tp_rank = tp_rank // put_step`（头号），否则取 `tp_rank`（卡号）。L221–223：`group_uses_align_state` 为真的组（L480–496：MambaSpec 且 align，即 KDA）一律取 `tp_rank`。
- 用 8→4 逐例推：KV 头 1/2/4 个时，TP 8 下按头号起名、TP 4 下每个编号仍只含同一个头，名字与内容都一致；KV 头 8 个时 TP 8 与 TP 4 都按卡号起名，卡 0–3 名字撞上旧记录，但每卡从 1 个头变成 2 个头，内容与字节数都变。页面 L161 的说法与此一致，L165「各卡相同只存一份」、L209 GLM「full 组编号取 0、KDA 取卡号」、尾状态组取 0（尾状态是昇腾滑窗 MLA 规格，非 MambaSpec）也都与源码一致，上一轮指出的自相矛盾已消除。
- 版本差异新增行：v0.26 2ed6cbba config_data.py L36–69 与 main baa023ad metadata.py L41–74 的 `infer_tp_mismatch_info` 属实（需声明 `prefill_tp_size` / `decode_tp_size`，排除 MLA 与混合布局）；v0.26 kv_transfer.py L681–684、L934–937 走 `_store_kv_tp_mismatch` / `_load_kv_tp_mismatch`，「按头拆出子名字」成立；2c59ff10 与 db701c1f 里 grep 不到这些名字，「v0.23 没有」属实。
- 「怎么开」新增的 `candidate_index % put_step == tp_rank % put_step` 分摊规则：db701c1f config_data.py L454–481 与 kv_transfer.py L734–743 ✓。

### P2-1 decode 默认不写回：已补上，有出处

db701c1f pool_scheduler.py L96–98（`save_decode_cache` 默认 False，落在来源 L86–L160 内）与 L817–822（chunked prefill 增量总是存，decode 增量受开关约束，来源第 43 项 L814–L822）✓。页面 L99 代价、L145 第 5 步、L177 对照表、L180 恢复条件、「怎么开」`save_decode_cache` 条目都已改，口径一致。

### 三处重复：已合并

- 抢占补回 prompt 整段：只在 L180 讲全；L213 GLM 与 L220 误解改为一句 + 页内链接。
- 名字对不上：只在 L161 讲全；L101 代价与 L221 误解改为一句 + 链接。
- 一个 KV 头只存一份：只在 L165 讲全；L209 GLM 改「套用上文的起名规则」+ GLM 数；L219 误解一句 + 链接。
- 另查上一轮 P3-1/2/3/5：段长规则补压缩比（L131）、推演句式与待核 133,120（L188、L199、L217、待核第 1 条）、缓存组 / indexer 括注（L81、L190）、图标签「每个 KDA 组：每块 8 条」（yaml L37）均已落实。

### 丢信息

本轮没有修订前快照（页面相对 HEAD 未提交，`git diff` 混着整轮 P5 重写；scratchpad 与 file-history 里都没有修订前副本），所以没法只看本轮 diff。改用上一轮审查记录里逐行描述的旧内容（L96/98/158/162/174/177/206/210/214/216/217/218）对照现文，并 grep 关键事实（第 9 块轮回、8,355,840、64 头、PYTHONHASHSEED、DP 编号、prompt 里整 640 的段、133,120、层号不进名字）：均仍在，合并处改成链接指向讲全的那一节。未发现丢信息，但这一条的证据强度低于真正的 diff。

### 新问题

**P1（0）**

**P2（1）**

- **P2-1 「换模型就找不到」说过头**（L161「模型名在名字里，换了模型，旧数据一条也找不到」；L101、L221 同义）。名字里的「模型名」是 `model_config.model.rstrip("/").split("/")[-1]`，只是模型路径最后一级目录名（db701c1f pool_worker.py L226；main pool_worker.py L361 相同），不含权重版本；块指纹也不含模型信息。所以同名目录里换了权重（如新 checkpoint 放在同名目录、或两处路径末级同名）时，名字照样对上、内容却是旧权重算的，和本节刚讲的「换 TP 名字撞上、内容不对」是同一类后果，且是静默错误。**改法**：L161 第一句改成「模型名其实只取模型路径的最后一级目录名：目录名变了就找不到旧数据；目录名不变而换了权重，名字照样对上、内容却不对，同样要换池或清空」；L101、L221 的「换模型就找不到」相应改成「换了模型目录名」或加半句；来源补 pool_worker.py L220–232（现有来源 L219–L237 已覆盖，可直接引用）。

**P3（2）**

- **P3-1 页内指引错位**（L161「只有一个 KV 头时全取 0，见下一条」）：下一条（L162）是「升级版本也对不上」，讲 MLA 只存一份的是本节最后一条（L165）。改「见本节最后一条」。
- **P3-2 版本差异表口径略宽**（「P/D 两端 TP 不同」行「普通 attention 可跨 TP 取用」）：源码另要求 KV 头数 ≥ 两端较大的 TP 且能整除（v0.26 config_data.py L56–57）。建议补「且 KV 头数不少于两端较大的 TP、能整除」。

### 跳过

frontmatter 来源区（由 audit 校验）；「一次查询怎样算」「查到以后」两节未重审（上一轮已核，本轮只看改动处）；「会报什么错」「开销」「源码位置」只扫读，未逐条核源码；未开浏览器复查（本轮只有文字与一张图标签改动，图标签在 yaml / svg 里核过）；p5\kv-pool-facts.md 未逐条复核。

### 复审后补修（09-29）

- **复审 P2-1 模型名只取目录名（已改）。** 核 db701c1f pool_worker.py 226 行与 main pool_worker.py 361 行：名字里的模型名是 `model_config.model.rstrip("/").split("/")[-1]`。第 5 节第 2 条改写为「模型只认目录名，TP 只认编号」：目录名变了才找不到；同名目录换了权重或两处路径末级同名，名字照样对上、取回另一份权重算的 KV 且不报错，要换池或清空。第 2 节代价、误解「接到同一个池」同步改；「怎么开」补模型名取法；来源与结论对应引第 11 项来源（L219–L237 已覆盖 226 行）。
- 复审 P3-1「见下一条」改「见本节最后一条」；P3-2 版本表补「KV 头数不少于两端较大的 TP、能被它整除」。
- 验证：`pnpm wiki:lint` 通过（本页 0 报错）；`pnpm wiki:diagrams --check` 257 张一致；`pnpm wiki:audit` 本页 45 条来源全部 ✓。

### 达标名单补修：hedge-ratio（09-29）

- `wiki:audit` 报正文免责句 7 / 160 = 4.4%。逐句看，6 处「可能」都是已按源码核实的结论写成了含糊语气（名字撞上内容不对、缓存组个数、各组块长差距、R1 以外哪些请求会发查询），改成确定说法；其中 R1 一句顺带讲准「prompt 不短于 640 才发查询、共享开头达 640 才取得回」。误解节 1 处「见页末待核」改为「GLM 还没有实跑，缺什么集中列在页末」。真实的不确定性没有删：仍集中在对照源码末尾「待核」5 条（实跑日志、GLM 五组上的失败处理、KDA 与 full 组每条记录字节、实测性能、main 镜像行为）。
- 验证：`pnpm wiki:audit` 本页不再报 hedge-ratio，45 条来源全部 ✓；`pnpm wiki:lint` 通过；`pnpm wiki:diagrams --check` 257 张一致。
