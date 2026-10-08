# answer-fbdf 审查记录

对应页面：wiki/sources/answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md（文件名太长，本记录用前 4 位 fbdf 简称）。

## P5 写作记录（2026-10-02，第 30 批小修）

本页是问答归档（sources 类），小修：沿用原有 7 个 H2 和资料页体例，不套深入页骨架；本页原本无图，队列写「沿用现有图」，未新增 yaml。只改了这一页的 frontmatter 和正文，未碰其他页、图、代码，未提交 git。

### 改了什么

- 旧模型保留原语境：一句话里写明回答当时用的是 Qwen3-0.6B、单卡、37 + 200 个 token、一块 128 的旧算例（取自归档原文 raw/sha256-890a88e5… 里当时 one-request 的摘要）；被引三页已改写成 GLM 双机主线、旧数字只在本页；步数格数块号不是双机实测。「什么时候分」去掉「那条请求并入的旧算例」这一指向现版 one-request 的误导链接，199 步只借 1 次块的结论加上「只属于单卡旧算例」。
- 参数核对：借块条件补成「向上取整（token 数 ÷ 块大小）− 已有块数，≤0 不借」并核源码；块大小 128 改标「当时设定」[I]，并在末节加一条待核（见下文疑点）。
- 回收：逆序交回、v0.23 全注意力组排队尾、不清空内容、被取走时才摘哈希，全部补核源码。
- 109 格：补一句按 KV 实际写入是 108 格（37 + 199 = 236 个位置，最后一个输出 token 不回灌），109 是按序列长度 237 数的；两种都不满 128，结论不变 [D]。
- 「写满才登记」限定为 v0.23 规则：v0.26 与 main 都有 cache_partial_block，条件链到 KV 块分配页版本差异，不重讲。
- 版本差异：原表「v0.23 一律排队尾」改准为「全注意力组还块一律排队尾；插队头开关只给窗口外被跳过的块和滑动窗口组还块用」；补 main 列（前缀缓存关时一律插队头）；补「没写满能否登记」一行；删掉「本记录未核对源码」，改为说明原回答只比两列、main 列和角标是归档后补核。
- 块表侧：说明 8 字节指两次写入的两个 int32 块号格，结束时这两格写回 0、行块数计数也变；每步其他开销链 block-table。
- 新增 H2「换到 GLM 双机：哪些说法还成立」：7 行对照表（分配在哪、块大小、首步借块、decode 借块节奏、结束还块、登记与排队、块表张数），右列数字全部链接 R / D / KV 块分配 / 前缀缓存 / Block Table 的现有节，不重算；末句说明 GLM 镜像分配代码用 vLLM 0fc695fc，按 v0.23 列走。
- 末节：首条改为「三页已改写、机制已按源码补核」；新增「旧数字不是双机测量、不能推双机借块节奏」[!]；main 回收顺序缺口标为已补，抢占缺口链到 KV 块分配页「池子不够时」。
- frontmatter：summary 改写（约 110 字，含旧算例语境）；新增 14 条源码来源（C2–C15）；updated 改 2026-10-02；aliases、chapters、relations、rawSources 未动。

### 核心说法对照的源码（本轮实际读过的行）

- 借块条件：vllm@0fc695fc single_type_kv_cache_manager.py 276–282（allocate_new_blocks：ceil − 已有，≤0 返回空）。
- 取块：vllm@0fc695fc block_pool.py 333–354（popleft_n 队头取、开缓存时先 _maybe_evict_cached_block 再 ref_cnt +1）。
- 逆序回收：single_type_kv_cache_manager.py 363–378（reversed(req_blocks) 交 free_blocks）；滑动窗口组 free 751–765（未登记的 prepend）；窗口外跳过块 482–501（prepend）。
- 排队：vllm@0fc695fc block_pool.py 419–441（默认 append_n，prepend 开关）；vllm@568afb3a block_pool.py 719–740（按有无哈希分两拨）；vllm@84030bbe block_pool.py 734–758（无哈希或缓存关 → 队头）。
- 登记：vllm@0fc695fc single_type_kv_cache_manager.py 298–341（num_full_blocks = num_tokens // block_size）；cache_partial_block：568afb3a 445–460、84030bbe 446–460。
- 块表：vllm@0fc695fc v1/worker/block_table.py 102–128（append_row / add_row / clear_row，表 int32，clear_row 把用过的格写 0 并清行块数）。
- 块大小：vllm@0fc695fc config/cache.py 232–244（空的块大小在 model_validator 里填 16）；vllm-ascend@2c59ff10 utils.py 1369–1381（refresh_block_size 只在空时填 128）。
- 双机对照的数字出处（只链接不重算）：01 §A0.4（block_size 640、前缀缓存关）、§A0.5（块字节与块数，经 D 页）；R 第 2 站（15 块）、第 7 站；KV 块分配页 GLM 一节（decode 节奏、16 或 17 块）；Block Table 页 GLM 一节（5 张表、640 块展开成 5 个 kernel 块号）。

### 旧版信息清单勾选

清单在旧会话 scratchpad\p5\answer-fbdf-facts.md，共 18 条，现版改前 = p4-checkpoint。
- 1、2：一句话，保留。
- 3：改写。「依据在被引三页」已过时（三页改成 GLM 双机，旧算例不在了），换成末节首条的说法，证据：三页现文 grep 不到 37 token / 第 92 步 / 109 格。
- 4–7：什么时候分，保留，加源码角标和借块算式。
- 8：保留，加「只属于单卡旧算例」限定；链接改指 KV 块分配页一般规则节。
- 9、10：什么时候回收，保留，限定为 v0.23 全注意力组，加角标。
- 11：保留，补 108/109 两种数法说明。
- 12：保留并改准（「一律」限定到全注意力组请求结束这一路），补 main 列。
- 13：删除「未核对源码」，原因：本轮已按钉住源码核过，角标指行号。
- 14：块表侧，保留，补 8 字节口径。
- 15、16：末节，保留（15 改写，16 原样）。
- 17：两个缺口均已处理：main 列补上；抢占链到 KV 块分配页。
- 18：frontmatter 字段全在；summary 改写。
无未交代的删除项。

### 字数与校验

- 字数（measureStandard 口径）：改前 753，改后 1940。行内代码 17（8.8/千字），角标 27，calc 0。增量主要是双机对照表和版本差异补核。
- pnpm wiki:lint 通过；本页原有的 mark-flood 待留意（91% 是 [I]）已消失，本页无报错无待留意。
- pnpm wiki:diagrams --check：290 张图与 spec 一致（本页无图）。
- pnpm wiki:audit 通过；本页 15 条来源行号全部有效。
- 未起服务、未截图（浏览器验收归审查环节）。

### 取舍与疑点

- 待核（已写进页面末节）：单卡非混合模型在钉住版本上的默认块大小。vLLM 0fc695fc 构造 CacheConfig 时就把空的 block_size 填成 16，而 Ascend 2c59ff10 的 refresh_block_size 只在仍为空时改 128；两步先后本轮没核，所以 128 只标「当时设定」。对 GLM 无影响（GLM 的 640 由 mamba 配置补丁决定，见 01 §A0.4）。
- 109 与 108 的差别是算法口径问题，不影响任何结论，不算 P1。
- 双机对照只链现有节锚点（lint 通过即锚点存在），R1 块数按链接页现文写「16 或 17」，未写成定值。
- 参考图库（refs）只适用于通信原语与 TP/DP/EP 页，本页未查看。
- 跳过：frontmatter sources 区只读了原有那一条 raw 引用；HANDBOOK、docs/plans 未读。

## P5 审查（10-02）

审查员：独立审查（Opus 5.5），只审不改页面。本页是 sources 类问答归档，按资料页体例审（批次计划第 216 行：教学改版规则不覆盖 param/source 归档页），不套深入页骨架。

### 结论

- 分数：**8.5 / 10**。P1 0 条，P2 1 条，P3 2 条。
- `pnpm wiki:audit`：通过（exit 0；本页 15 条来源全部 ✓，raw 归档引用 19 行有效）。`pnpm wiki:lint`：通过（全库 4 处待留意均不在本页）。
- 任务文件要求：「旧模型记录保留原语境、不伪装成双机实测」已做到（一句话第 2 段、什么时候分末句、末节第 2 条三处明确写了单卡旧算例不是双机实测）；「双机对照链接 01 §A0 与 R」已做到（新 H2 只链接不重算；R1 块数写「16 或 17」，与 KV 块分配页现文一致，未写成定值）；「最后核参数与归档链接」：归档链接有效，块大小 128 见下文 P2。

### 块大小 128：已核清（结论：在钉住版本上，非混合模型默认就是 128）

写手的疑点是「vLLM 先把空块大小填 16，Ascend 只在仍为空时改 128，两步先后没核」。本轮核到的完整链路：
1. vLLM 0fc695fc `vllm/config/cache.py` 232–244：构造 CacheConfig 时把空的 block_size 填成默认值（16），`user_specified_block_size` 保持 False。
2. vLLM 0fc695fc `vllm/config/vllm.py` 1335：VllmConfig 初始化末尾调平台的 `check_and_update_config`，在 CacheConfig 构造之后。
3. vllm-ascend 2c59ff10 `vllm_ascend/platform.py` 671：`check_and_update_config` 里无条件调 `refresh_block_size`。
4. vllm-ascend 2c59ff10 `vllm_ascend/utils.py` 1397–1406：**非混合模型**只要块大小不等于 128，且前缀缓存或 chunked prefill 任一开着，就把块大小改成 128。页面只引了 1369–1381 的「为空才填 128」分支，漏了这一支。
5. vLLM 0fc695fc `vllm/engine/arg_utils.py` 2370–2405：用户没指定时，chunked prefill 与前缀缓存默认按模型是否支持来开，Qwen3 这类普通 decoder 模型两者都开。
6. vllm-ascend 2c59ff10 `vllm_ascend/platform.py` 312–331：Ascend 覆盖了 `update_block_size_for_backend`，只调 mamba_block_size，不改 block_size，所以后面不会再被改回去。

所以 16 是中间值，到平台钩子就被改成 128；单卡 Qwen3-0.6B 在默认参数下块大小是 128，「当时设定」的 128 与钉住版本的默认一致。

### P2

1. **末节「待核」一条对 Ascend 行为的描述不对，且该疑点其实可核清**（正文第 118 行，角标 C3 = utils.py 1369–1381）。页面写「Ascend 只在块大小仍为空时把它改成 128」，实际 `refresh_block_size` 还有第二支（utils.py 1397–1406）：非混合模型、块大小不是 128、前缀缓存或 chunked prefill 开着时强制改 128。影响：读者会以为单卡旧算例的 128 可能不成立，且一条带角标的源码说法是错的。改法：把这条「待核」改成结论句——默认参数下（前缀缓存 / chunked prefill 默认开）非混合模型在钉住版本上块大小是 128，先由 vLLM 填 16、再在平台钩子里被改成 128；角标 C3 的行号范围扩到 1369–1406（或新增一条 1397–1406），可补 vllm.py 1335 一条说明先后。第 60 行「当时设定的 128 [I]」可同步改为指向该来源的 [C]。

### P3

1. `wiki/index.md` 第 141 行本页条目的摘要还是旧 summary（「一次问答的归档。结论是…」）。index 由构建生成，待批次收尾统一重建时刷新即可，不是写手范围。
2. 新 H2 第 99 行链接文字直接显示页面 id「glm-5-3-flash-two-node「部署前提」」（审查截图 -3.png 可见），读者看到的是英文 slug；建议改成页面标题或「双机部署页的部署前提」。

### 逐项核对记录

- 核心说法抽查（全部对照钉住源码，结论一致）：借块条件 single_type_kv_cache_manager.py 276–282（cdiv − 已有，≤0 返回空）；逆序回收 363–378；v0.23 `free_blocks` 默认 append、prepend 开关 block_pool.py 419–441；全库 prepend=True 只有两处（501 窗口外跳过块、764 SlidingWindowManager.free），与页面「开关只给这两类用」一致；v0.26 568afb3a block_pool.py 719–740 按有无哈希分两拨；main 84030bbe block_pool.py 734–758 无哈希或缓存关一律插队头；块表 block_table.py 120–128 add_row / clear_row（clear_row 把用过的格写 0 并清行块数）。
- 旧算例数字手算：prefill 37 → ceil(37/128)=1；decode 第 k 步要 37+k 个位置，k=92 时首次超过 128 → 第 92 步借第二块；199 步 decode 只借 1 次；KV 实写 37+199=236 个位置，第二块 236−128=108 格，按序列长 237 数为 109 格。页面 108/109 两种数法说明正确。
- GLM 对照表 7 行：与 KV 块分配页 GLM 一节（142–176 行：DP0 / node0 池、首步 15 块、尾状态组每 1–4 步借还、结束 16 或 17 块、前缀缓存关不登记）和该页钉点行（267 行：GLM 分配控制流用 vLLM 0fc695fc，同 v0.23 列）一致；版本钉点 v0.26 = vLLM 568afb3a、main = vLLM 84030bbe 与 KV 块分配页一致。
- 链接与锚点：跨页锚点 13 个（KV 块分配 6 个、block-table 2 个、prefix-caching 1 个、D 2 个、R 2 个）和页内锚点 2 个，lint 硬校验通过，我另对 KV 块分配页标题逐个手核了 slug。入链：wiki/index.md 两处（按类型、按章节，结构如此）、log 与 patrol 记录，均为整页链接。
- 丢信息：`git diff p4-checkpoint` 删除的 18 行逐条在新版找到改写后的对应句，无丢失。旧版信息清单（旧会话 scratchpad\p5\answer-fbdf-facts.md，18 条）存在；抽查第 2、5、9、11、14、16 条，新版均在（第 54、64、72、78/80、95、117 行），写手勾选属实。
- 浏览器：Playwright 1440 宽只读打开 http://localhost:5193/#/wiki/answer-fbdf…，无控制台错误；截图存审查员 scratchpad `answer-fbdf-review-1.png`（第一屏）、`-2.png`（版本差异）、`-3.png`（双机对照表），表格与角标渲染正常。
- 跳过：frontmatter sources 区与 raw 归档原文未读（「Qwen3-0.6B、37 + 200」等旧算例原始口径按写手记录与 audit 结果采信）；HANDBOOK、docs/plans 整份未读（只 grep 了批次计划本页两行和第 216 行规则）。

## P5 修订记录（10-02）

按上方「P5 审查（10-02）」修 P2×1、P3 第 2 条；P3 第 1 条（index 摘要）属构建刷新，不在写手范围，未动。

- P2（块大小 128）：「什么时候分」里「当时设定的 128 [I]」改为已核结论：vLLM 构造配置先把空块大小填 16 [C15]，配置收尾调平台钩子 [C16]，Ascend 在钩子里调块大小刷新 [C18]，对非混合模型只要前缀缓存或 chunked prefill 任一开着且块大小不是 128 就改 128 [C3]，两项在未指定时按模型是否支持默认打开 [C17]。来源 C3 由 utils.py 1369–1381 扩为 1369–1406；新增 C16 = vllm@0fc695fc vllm/config/vllm.py 1335、C17 = vllm@0fc695fc vllm/engine/arg_utils.py 2370–2405、C18 = vllm-ascend@2c59ff10 vllm_ascend/platform.py 671。末节「待核」一条删除（已核清）。本轮自己复读了 utils.py 1393–1407（is_hybrid 直接返回、!=128 且缓存或 chunked prefill 开着改 128）、vllm.py 1333–1336（check_and_update_config 调用点）、arg_utils.py 2370–2405（两项默认按模型支持开启）。
- P3-2：双机对照一节链接文字由页面 id 改为「双机部署页的「部署前提」」，锚点不变。
- 字数 1940 → 1992；角标 29；pnpm wiki:lint 退出码 0（本页无报错无待留意）；pnpm wiki:audit 退出码 0（本页 18 条来源全部有效）。
