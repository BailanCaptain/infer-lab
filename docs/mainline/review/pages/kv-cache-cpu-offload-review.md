# kv-cache-cpu-offload 页审查记录

## P5 写作记录（2026-09-29，深改，第 14 批）

**改了什么。** 全页重写（中途网络断线一次，断点前尚未落盘，续写时从头写）。按新讲法排序：问题式开篇 + 一句话定义 + A/C/B 三步例子 + 直觉图 → 为什么需要（前缀被挤掉、请求被抢占两种来路；四项代价）→ 搬回和重算各花多少（示意数 calc + 时间轴图 + 持平带宽算法与三处修正）→ 什么时候存、什么时候搬回（五步、状态、完整/完成、源页与目标页保护）→ 页和段（calc、取舍、LRU/ARC）→ 异步传输何时要等 → GLM 双机（主线未启用，最多搬多少 calc，快照上卡在哪三处，待核清单）→ 常见误解 6 条 → 对照源码五个 H3。标题改为「KV cache CPU offload：缓存在主机内存多存一份，用到时搬回显存」；证据角标全部移到对照源码内；verified 补为 v0.23/v0.26/main 三版。字数（standard.ts 口径，对照源码之上）1,309 → 3,620。

**直觉图。**
- `wiki/diagrams/kv-cache-cpu-offload.yaml` 重画（900×410）：三帧「① A 算完开头：复制一份到主机 → ② 显存紧张：A 的页让给 C（显存里 A 没了、主机那份还在）→ ③ B 用同一开头：分空页、从主机搬回，不用重算」，每帧上排显存四格、下排主机四格，借了参照笔记「前 → 操作 → 后」的状态对照画法。
- 新增 `wiki/diagrams/kv-cache-cpu-offload-cost.yaml`（900×250）：时间轴三条泳道，16 GiB/s 搬回 31 ms、2 GiB/s 搬回 250 ms、重算 250 ms，直观给出持平点。
- 两张图只用本脚本单独渲染了自己的 SVG（没跑会重写全库 SVG 的 `pnpm wiki:diagrams`，以免碰别人正在改的图）；`figureProblems` 无越界/重叠。按派发说明未截图，版面观感待浏览器验收。

**数字取自哪。**
- 基础节全部是示意数：每位置 128 KiB、4,096 位置 = 512 MiB 沿用 kv-cache 页示意模型（kv-cache.md L150–L151）；16 GiB/s 沿用旧版假设；16,384 位置/s 为本页新设示意数；页 16 位置/2 MiB、4 页一段、1 GiB → 128 段、70 位置 → 1 段 + 6 与旧版算例一致。
- GLM 节：120–121 块 ≈ 956–964 MiB/卡、约 67,000 位置、重算 9 步取自 docs/mainline/01-deploy-entry-schedule.md §B3（经 concurrent-requests.md「KV 块」一节链接，不重算）；13,056 B/位置/卡、7.969 MiB/块取自 02-forward.md §1.4（经部署页链接）；3,855 块取自部署页。新推导只有一处：8 × (956~964) MiB ≈ 7.47~7.53 GiB（一个 DP 执行组 8 卡同在一台机器，见部署页「16 张卡怎样分组」）。
- 未启用、无实测：主线无 kv_transfer_config（01 L848、02 L685）；prefix caching 因混合模型默认关（部署页）。换出/搬回带宽、单步耗时底稿都没有，均写「待核」，没有给 GLM 时间数字。

**核了哪些源码（钉点）。**
- 上游保存计划：vllm@0fc695fc `offloading/scheduler.py` L721–L806（num_computed + num_scheduled，夹到 num_tokens、max_offload_tokens；offload_prompt_only 夹到提示词长；每组 `// offloaded_block_size` 只取整段；块号 0 的 SWA/SSM 跳过；prepare_store）。
- 外部命中：同文件 L537–L567（get_num_new_matched_tokens，返回异步标志）；请求结束时仍在拷的页：L1017–L1027（块照常释放，登记 pending job，复用前 flush）。
- 调度器：`v1/core/sched/scheduler.py` L605–L630（只对 num_computed_tokens == 0 的请求查本地再查连接器 —— 被抢占后清零的请求也走这里）、L800–L812（WAITING_FOR_REMOTE_KVS）。
- 块哈希：`v1/engine/core.py` L206–L215（prefix caching 开或有 connector 即计算）。
- spec 基类：`v1/kv_offload/base.py` L378–L442（gpu_block_size 每个 kv_cache_group 一项；offload_prompt_only 默认 True；extra_config block_size → 段倍数）；旧基类（c42981d034^ `v1/kv_offload/spec.py` L90–L115）同样按组，确认「只接受一个缓存组」的说法。
- 上游 CPU spec：`v1/kv_offload/cpu/spec.py` L30–L71（cpu_bytes_to_use 为全部 worker 合计，每块字节 × world_size × 倍数，对齐值 1，eviction_policy 默认 lru）；`cpu/manager.py` L39–L46（lru/arc；构造函数无 block_size 参数）。
- 昇腾（db701c1f，与 2c59ff10、2ed6cbba 的 `vllm_ascend/kv_offload/` 逐字相同，git diff 为空）：`npu.py` L1–L13（导入 kv_offload.abstract/spec/mediums —— 上游 c42981d034 已删，0fc695fc 与 v0.26 均不存在）、L16–L63（num_cpu_blocks 必填、两处 `assert len(self.gpu_block_size) == 1`、给 CPUOffloadingManager 传 block_size）；`cpu_npu.py` L63–L68（两条流）、L77–L133（每层按 (key, value) 一对开锁页主机缓冲）、L180–L261（D2H 等计算流、同向等前一笔 end_event、swap_blocks_batch、get_finished 按序查询事件并带字节与用时、wait）。
- 昇腾另一连接器：db701c1f `kv_pool/cpu_offload/cpu_offload_connector.py` L66–L78（enable_prefix_caching 为假时两侧都不建）。
- main baa023ad：`distributed/kv_transfer/kv_pool/kv_offload/native/npu.py` L42–L60（继承上游 CPUOffloadingSpec，另有 NPUTieringOffloadingSpec）、`distributed/kv_transfer/__init__.py` L21–L37（顶替上游 CPUOffloadingSpec / TieringOffloadingSpec 注册名）；上游 factory 默认 spec_name = CPUOffloadingSpec；重构 PR #13389 提交说明写明修了原生 offload 的兼容问题。
- 上游 v0.26（tools/repos/vllm@releases-v0.26.0）：`offloading/config.py` L59–L88（blocks_per_chunk 与 block_size 二选一，同给 ValueError）；base.py 仍默认 offload_prompt_only=True。
- 官方指南 db701c1f `docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md`：配置写法与示例值（num_cpu_blocks 1000、block_size 128）；其「显存满了才拷到 CPU」的描述与上游调度代码不符，已写入常见误解。
- GLM 侧：kv-cache-spec 页（5 个组、GLM 不拆 K/V、一个块号跨 24 片显存）、prefix-caching 页（混合状态同一边界）、部署页（分组、prefix caching 关）。

**旧版信息清单勾选**（清单：scratchpad `p5/kv-cache-cpu-offload-facts.md`，旧版 = p4-checkpoint，与改前现版一致，16 条）。
- F1 前缀被回收要重算 → 「为什么需要它」第一条 ✓
- F2 主机副本、扩展存储层级、与抢占卸载触发点不同 → 首节 + 「为什么需要它」+ 常见误解第 4 条 ✓
- F3 两份钉住源码只解释职责、未作配套验证 → 会报什么错「两份钉住源码接口不配套」+ 版本差异「和上游接口」行，补了具体证据（导入的模块已删、构造函数签名不同）✓
- F4 段的四个状态、完整与完成 → 「什么时候存」第二段 ✓
- F5 五步 → 「什么时候存」五步 ✓
- F6 已算 + 本步、token 已知、先规划后等数据、不以淘汰为触发、外部匹配在连接器调度侧 → 第 1、4 步 + 常见误解第 1 条 + 怎么开「保存计划」「查找与挂起」 ✓
- F7 源页保持有效、目标页拷完才能用 → 「什么时候存」倒数第二段，补了请求提前结束时 pending job 的处理 ✓
- F8 页与段、段大小取舍、尾巴不存 → 「页和段」 ✓
- F9 16 位置/2 MiB、4 页一段 8 MiB、1 GiB 128 段、70 → 1 段余 6、要对全部缓存张量求和 → 「页和段」calc 与倒数第二段 ✓
- F10 两条流、D2H 等计算流、同向串行与事件 → 「搬运在后台进行」 ✓
- F11 CPU 可做别的、传输与计算重叠但抢带宽、回填未完成要等 → 同节 ✓
- F12 64 MiB ÷ 16 GiB/s ≈ 3.91 ms 算例 → 改为同一算法的 512 MiB ÷ 16 GiB/s = 31.25 ms（与 kv-cache 页示意模型对齐，并补上重算一侧和持平带宽）；「排队、同步另加」「要在相同配置下比较」→ 「有效带宽要实测」「搬回至少等一步」 ✓（数字替换，方法保留）
- F13 NPUOffloadingSpec 要 num_cpu_blocks、单组断言；上游 CPUOffloadingSpec 按字节换算、LRU；单位不同不可互抄 → 怎么开前两条 + 会报什么错；把旧版「只有一个 block-size group」更正为「只有一个缓存组」（gpu_block_size 按 kv_cache_group 各一项，见 base.py）✓
- F14 不会缩小 NPU 池、主机与缓冲另需、可重选池大小但要评估回填频率和延迟 → GLM 节「就算这些都解决了」+ 常见误解第 2 条 + 首节末段 ✓
- F15 KDA 与稀疏注意力状态不同、单 group spec 不支持、不拿上游别的实现覆盖、不给 GLM 可运行配置 → GLM 节三处卡点 + 首段「起不来」+ 版本差异「缓存组」行（main 待核）✓
- F16 aliases → 保留全部，新增 KV cache CPU 卸载、cpu_bytes_to_use、offload_prompt_only ✓

**本批验收要点。** 换出变体保留条件：GLM 节只摆字节与步数，时间写待核，未把任何估算当实测；专家负载与迁移（E/C）与本页无关，未涉及。

**参照。** 看了 scratchpad/refs/INDEX.md 与 HOW-THEY-TEACH.md 的「可借的做法」：图库只有通信原语与 TP/DP/EP，没有卸载类参照；借了「前 → 操作 → 后」状态对照画法（直觉图三帧）和「限制讲成具体报错或数字」（GLM 卡点、会报什么错）。

**留下的待核。**
1. 主机与 NPU 之间的有效带宽、主线单步耗时（决定 GLM 上搬回与重算谁快）。
2. 两台机器能划给 offload 的主机内存。
3. 01 §B3 场景中请求的提示词长度（默认只存提示词，决定能存多少）。
4. main 改用上游多组实现后 GLM 混合缓存能否走通。
5. 「导入失败」「单组断言失败」均为按代码推断，未实跑。

**自查疑点。** 无已知 P1。可再看：「短开头更偏向重算」是成本判断，不是实现里的自动选择（实现只要主机有完整段命中就走搬回）。

**验证。** pnpm wiki:lint：本页 0 报错、0 留意（全库当前失败 1 处为 kv-pool-intuition.svg 缺失，非本页；过程中还见过 eplb.md 锚点报错，随后消失）；pnpm wiki:diagrams --check：本页两图与 SVG 一致、无越界重叠（全库不一致的是 kv-pool-intuition、kvpp-broadcast，非本页）；pnpm wiki:audit：本页 20 条来源全部 ✓（全库失败 1 处为 kv-pool.md summary 超长，非本页）；standard.ts 单页检查：行内代码 0.0/千字、角标 0、对照源码 ✓、calc 0.83/千字、相邻块 0、图先行 ✓、免责 1.6%、图宽 ✓。未截图、未起服务。

## P5 审查（09-29）

审查员：独立审查（只审不改）。基线：现版 wiki/concepts/kv-cache-cpu-offload.md（253 行）对照 p4-checkpoint 旧版；源码 vllm@0fc695fc、vllm-ascend@db701c1f/2c59ff10/2ed6cbba。

**分数：8.0 / 10。** P1 0 条，P2 5 条（其中 1 条改在 kv-cache 页），P3 7 条。

### 学习顺序与初学者测试（通过）
- 顺序：问题式 H2 + 加粗一句话定义 + A/C/B 三步例子 + 直觉图（是什么）→ 没有它只能重算、两种来路、四项代价（为什么）→ 示意数 calc + 时间轴图（怎么算）→ 何时存/取、页与段、异步等待（细节）→ GLM 双机 → 常见误解 → 对照源码。基础节没有 GLM 数字（「为什么」一节只放链接），第一节末尾没有堆链接，符合总原则与第 11–14 条。
- 我的一句话（只读前两屏）：CPU offload 是在主机内存给算好的 KV cache 多存一份，显存那份被回收后同一开头再用时搬回来、不用重算；代价是每段都额外拷一趟、要预留主机内存、搬回时请求要等，而显存池并不会变大。

### 示意演算逐项手算（全部正确，量级合理）
- 4,096 × 128 KiB = 524,288 KiB = 512 MiB ✓（与 kv-cache.md L150–L151 示意模型一致；128 KiB/位置 = 32 层 × 2 × 8 头 × 128 维 × 2 B，是常见 8B 级 GQA 模型的量级）。
- 512 MiB ÷ 16 GiB/s = 0.5/16 s = 31.25 ms ✓；4,096 ÷ 16,384 /s = 250 ms ✓；持平 128 KiB × 16,384 /s = 2,097,152 KiB/s = 2 GiB/s ✓；250 ÷ 31.25 = 8 倍 ✓。图 2 条长 31.25/250 = 12.5% 与截图一致 ✓。
- 量级：16 GiB/s 低于 PCIe 4.0/5.0 x16 标称值，作「有效带宽」示意合理；16,384 位置/s 对 8B 级模型约需 2 × 8e9 × 16,384 ≈ 2.6e14 FLOP/s，单卡偏乐观但同一数量级，且正文未绑定具体卡型，可接受。
- 16 × 128 KiB = 2 MiB ✓；4 × 2 = 8 MiB/64 位置 ✓；1,024 ÷ 8 = 128 段 = 8,192 位置 ✓ = 两条 4,096 ✓；70 = 64 + 6 ✓；128 − 70 = 58 ✓；100 个相同只命中前 64、余 36 ✓。
- GLM calc：120~121 块、956~964 MiB、约 67,000 位置、9 步与 concurrent-requests.md L243–L250 一致（引用不重算 ✓）；8 × 956 = 7,648 MiB = 7.47 GiB、8 × 964 = 7,712 MiB = 7.53 GiB ✓；13,056 B/位置/卡与部署页 L212 一致 ✓；3,855 块与部署页 L227 一致 ✓。带宽、单步耗时均写「待核」，没有虚构部署实测数，没有把 GLM 主线数字当成本特性效果 ✓。

### 核心机制对照源码（均正确）
- 凑满一段就存、与显存满不满无关；已算 + 本步、夹到 num_tokens；offload_prompt_only 夹到提示词：vllm@0fc695fc offloading/scheduler.py L733–L748 ✓；默认 True：v1/kv_offload/base.py L397–L398 ✓。
- 只对已算位置为 0 的请求先查本地再查连接器（被抢占清零后也走这里）：v1/core/sched/scheduler.py L608–L630 ✓。
- 有连接器即算块哈希、不靠 prefix caching 开关：v1/engine/core.py L207 ✓；混合模型块大小对不齐时断言提示打开 prefix caching：base.py L418–L425 ✓。
- 请求结束时仍在拷的页照常释放、登记 pending job、复用前 flush：scheduler.py L1017–L1027 ✓。
- 昇腾两条流、D2H 等计算流、同向等前一笔 end_event、按序 query 并带字节与用时：db701c1f cpu_npu.py L67–L68、L204–L211、L238–L251 ✓；每层按 (key, value) 开锁页缓冲：L77–L133 ✓。
- num_cpu_blocks 必填、两处 `len(gpu_block_size) == 1` 断言：npu.py L20–L22、L35、L51 ✓；三个钉点 `vllm_ascend/kv_offload/` 逐字相同（git diff 为空）✓。
- 昇腾 CPUOffloadingConnector 在 prefix caching 关时两侧都不建：kv_pool/cpu_offload/cpu_offload_connector.py L69–L71 ✓。官方指南 L76 确有「NPU memory is full」的说法，常见误解第 1 条的更正成立 ✓。
- 主线无 kv_transfer_config：01 L848、02 L685 ✓。GLM 五个组、34 层 KDA、不拆 K/V 与 kv-cache-spec.md L168–L189 一致 ✓；prefix caching 默认关与 prefix-caching.md L79 一致 ✓；recompute-scheduler 页「主线不拆 P/D、抢占走本机重算」与本页一致 ✓。

### 丢信息核对（通过）
- 旧版 5 个 H2 的内容逐条在新版找到；写手 F1–F16 勾选抽查全部属实（F13「单位不同不可互抄」在版本差异表 L231「单位不同，从旧写法换到 main 要重算」保留；F16 aliases 旧 7 项全在、另加 3 项）。旧 64 MiB→3.91 ms 算例换成同一算法的 512 MiB→31.25 ms，方法保留。

### 结构、链接与校验
- 对照源码五个 H3 齐全且顺序正确；版本差异出现 v0.23、v0.26、main 及 2c59ff10/db701c1f/2ed6cbba/baa023ad ✓。对照源码之上无证据角标 ✓；每节 ≤1 个 calc，无表格与 calc 相邻 ✓；正文无 meta 文本 ✓；无新增分镜 ✓。
- 入链锚点：kv-cache.md#存一份要多少从一个位置一层往上乘、concurrent-requests.md#kv-块一组的请求…、glm-5-3-flash-two-node.md#部署前提 / #这套部署给后面各章留下的后果 / #占住一个块号要用多少显存、kv-cache-spec.md 两处、prefix-caching.md#哪些块能被共享，标题均存在 ✓。全库入链（device-memory、kv-cache、kv-pool、kvpp、recompute-cpu-offload、TERMS）均指向页面本身，无锚点 ✓。
- `pnpm wiki:lint`：本页 0 报错；全库失败 8 处全在别页（kv-pool.md summary 超长连带 5 处 relation-missing、kv-pool-glm-cards.svg 缺失、large-scale-ep.md 锚点）。
- `pnpm wiki:audit`：**本页 20 条来源全部 ✓，通过**；全库失败 1 处为 kv-pool.md summary 超长，非本页。
- 截图：用户预览 http://localhost:5193/#/wiki/kv-cache-cpu-offload 本轮先是 500「知识库页面不合法」（由 kv-pool.md 不合法引起），重试时 502，**整页第一屏未能截到**（未起停服务）。改用 Playwright 直接渲染两张 SVG（桌面宽 1440）：scratchpad\kv-cache-cpu-offload-review-fig1.png（直觉图 900×410）、kv-cache-cpu-offload-review-fig2.png（时间轴 900×250）。页面整体版面待预览恢复后复看。

### P2
1. **GLM 节「会先后卡在几处」漏了第一道、顺序不对**（L167–L171）。在钉住的快照上，昇腾 spec 先从 `vllm.v1.kv_offload.abstract/.spec/.mediums` 导入（npu.py L7–L10），这几个模块在 vllm@0fc695fc 已不存在（`git ls-tree 0fc695fc vllm/v1/kv_offload/` 只有 base/factory/file_mapper/cpu/tiering/worker），所以第一道是导入失败，轮不到「缓存组」断言；本页对照源码「会报什么错」L214 自己也这么写。另外第三条「混合状态要停在同一位置」是正确性要求，不是启动检查，和前两条不是同一类「卡住」。改法：列表改为「先是导入失败（接口不配套，见会报什么错）；补齐接口后，启动时卡在单组断言；再往下，张量布局和混合状态对齐是要重写的部分」。
2. **「连接器」「上游 / 昇腾这版实现」先用后讲**（L150 首次出现「这套连接器」，L169「昇腾这版实现」，常见误解 L179/L183/L184「上游调度代码」「上游这套」「CPUOffloadingConnector」）。正文从没交代这套机制在 vLLM 里叫 OffloadingConnector（KV connector 的一种，调度侧和 worker 侧各一半），保存计划和查找用上游代码、拷贝由昇腾的 spec/handler 做。改法：在「什么时候存」一节开头或末尾加一两句这层分工，后文的「上游 / 昇腾」「连接器」就有着落。
3. **直觉图第 ③ 帧箭头从空格出发**（wiki/diagrams/kv-cache-cpu-offload.yaml，见 fig1 截图）。箭头从主机第 4 格（空）指向显存第 4 格，读起来像把一格空页搬上去；A 的两份在主机第 1、2 格。这是全页核心直觉图，搬回的来源要一眼看对。改法：箭头从主机 A（第 2 格）斜指显存第 3、4 格，或让主机 A 的两格与显存目标格上下对齐。
4. **与 recompute-scheduler 口径不齐**（常见误解第 4 条 L182）。本页说「PD 分离的 D 节点上，RecomputeScheduler 用的是后一种」；recompute-scheduler.md L77–L81、L178 写明它在「存走（要另配能存 KV 的连接器）」和「退回 P」之间选，只开它不配连接器时 KV 全还掉、重算落在 P。照现写法读者会把 RecomputeScheduler 等同于抢占卸载。改法：「RecomputeScheduler 配上能存 KV 的连接器时走后一种；存不走就退回 P 重算」。
5. **跨页口径冲突，改在 kv-cache 页**（kv-cache.md L162）。那里把「挪到 CPU 内存（KV cache CPU 卸载）」列为「让缓存少占一点显存」的办法；本页（L70、L173、常见误解第 2 条）按源码写明显存池大小不变、省的是重算不是显存，本页是对的。改法：kv-cache.md 那半句改成「被收回后在主机留一份、再用时搬回省重算（KV cache CPU 卸载）」，不放进「少占显存」的列举里。

### P3
1. 术语：ARC 未解释（L136，可写「按访问频率与新近程度自适应淘汰」）；「传输流 / 计算流」「Worker」首次出现（L102、L105、L140）各补半句（stream = 设备上按顺序执行的一条任务队列；worker = 每张卡上跑模型的进程）。
2. 页 / 块混用：基础节用「页」（L115 说明 vLLM 叫 block），但 L60「共用已经算好的块」、GLM 节「120–121 块」「3,855 块」又用「块」。在「页和段」一节补一句「页就是站内其他页说的 KV 块」。
3. 成本一节（L91–L95）补半句「实现本身不做这笔比较：主机里有整段命中就搬回；这笔账用来决定开不开、段设多大」，避免读者以为运行时会自动在搬回和重算之间选（写手自报疑点属实）。
4. 常见误解第 2 条可点明官方指南 L5 也写了「能处理更多并发」，含义是被挤掉后找回更便宜，不是池子变大。
5. 直觉图底部约 60 px 空白（画布 410 高，内容止于约 345），可把画布收矮。
6. L152「GLM 是混合模型，vLLM 默认判它不支持」链接到部署页后果清单，但那里（部署页 L286）只写「关着」，原因在 prefix-caching.md L79；链接改指 prefix-caching 页或并列两处。
7. relations 只有 prefix-caching、kv-cache-spec、kv-cache；可补 recompute-cpu-offload（alternative-to）与 device-memory。另：wiki/index.md 仍是旧标题「CPU 前缀备份…」，属派生物，下次 build 自动更新。

### 跳过
- frontmatter 来源清单与「## 对照源码」正文按规则只 grep 未通读（仅为核对 F13 读了 L186–L202、L231 的单行）；代码块跳过。
- 整页第一屏截图未取得（预览 500/502，原因在别页），只截了两张图的 SVG。

## P5 修订记录（09-29）

**P2（5 条全修）。**
1. GLM 节卡点顺序：改为「先是导入失败（链到会报什么错）→ 补齐接口后启动卡在单组检查 → 过了检查还有两处要重写（张量布局、混合状态对齐）」，把正确性要求和启动检查分开写。
2. 先用后讲：「什么时候存」开头补一段分工——这套机制在 vLLM 里叫 OffloadingConnector，是 KV connector 的一种；调度侧（存哪些段、查能接上多少）用上游代码，worker 侧（拷字节）昇腾换成自己的 spec + handler；五步标明哪几步在哪一侧。后文「上游 / 昇腾」「连接器」「spec」都有了着落。
3. 直觉图第 ③ 帧：改成两支箭头分别从主机的两格 A 斜指显存新分的第 3、4 格；原先放在显存格下方的「显存（NPU）」标签会压到斜箭头，改为每排左侧的行标签「显存」「主机」（格子收窄为 50 px，间距 6 px，仍在帧内）。`figureProblems` 无越界/重叠，未截图。
4. 常见误解第 4 条改为：RecomputeScheduler 配上能存 KV 的连接器时走抢占卸载；存不走就退回 P 重算。与 recompute-scheduler.md 口径一致。
5. kv-cache.md L162（只改这一处）：把 CPU 卸载移出「让它少占一点」的列举，改为单独一句「被收回的缓存还可以在主机内存留一份、再用时搬回，省的是重算而不是显存」。核实依据：本页对照源码——主机缓冲另开、缓存池块数不变（NPUOffloadingSpec / CPUOffloadingSpec 只换算主机段数）。kv-cache.md 原有的他人未提交改动未触碰。

**P3（7 条，修 6 条，1 条部分修）。**
1. ARC 补半句解释；传输流在第 2 步首次出现处补「stream：设备上按顺序执行的一条任务队列」；worker 在分工段首次出现处补「每张卡上跑模型的进程」，五步里的 Worker 统一为小写 worker。
2. 「页和段」补「页也就是站内其他页说的 KV 块」。
3. 成本一节末尾补「实现本身不做这笔比较：主机里有整段能接上就搬回；这笔账用来决定开不开、段设多大」。
4. 常见误解第 2 条补官方指南「更长上下文、更多并发」的含义：被挤掉、被抢占后找回更便宜，不是池子变大。
5. 直觉图画布 410 → 360 高。
6. prefix caching 默认关的原因改链 prefix-caching.md#glm-双机上它开着吗，后果仍链部署页。
7. relations 补 recompute-cpu-offload（alternative-to）；device-memory 不补——device-memory.md 已有 builds-on 指向本页，再写一条 lint 报 relation-duplicate（写作阶段实测过）。wiki/index.md 旧标题属派生物，未动。

**验证。** 每次保存后都跑了 pnpm wiki:lint。最终：pnpm wiki:lint「ok 通过」（本页、kv-cache 均无待留意）；pnpm wiki:diagrams --check「254 张图与 spec 一致」；pnpm wiki:audit「ok」，kv-cache 写作标准全绿（免责 0.9%），本页单页标准检查全绿（4,019 字，免责 1.5%）。本页两张 SVG 仍只用单页脚本渲染。
