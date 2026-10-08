# rfork 审查记录

## P5 写作记录（2026-10-02，第 20 批深改）

**改了什么**

- 字数：对照源码之前的正文 2,956 → 5,679 字；全页（不含 frontmatter、不计空白）8,797 → 16,446 字。写作标准自测全过：行内代码 0/千字、正文角标 0、calc 0.35/千字、相邻块 0、图先行、免责 2.6%、图宽。改前正文有 2 个角标、免责 3.1%，两项不达标，已改掉。
- 结构按「是什么 → 为什么/代价 → 怎么做 → 细节 → GLM 双机 → 常见误解 → 对照源码」重排：
  - 第一屏换成新直觉图 rfork-two-paths：B 先建空位 → ① 向 Planner 借（A 登记过）→ ② 按地址直接读 A 显存里的权重字节 → ③ 借不到或出错就清理后改从存储加载（A 当初也走这条）。不标字节、不画 GLM 形状，格子数示意。
  - 新增「为什么要借，代价又在哪」：省的是哪几步、不省的是哪几步，四行小表（仍要做的事 / 必须同身份 / 得先有 seed / 多两个依赖）；原「请求还没进来」一节并入这里。
  - 新增「借一次权重分哪几步」：八步各挂子页链接，配一个装批 calc（示意数 1.5/0.3/0.6/0.2 GiB → 3 批，换顺序 → 4 批），说明「总字节 ÷ 1 GiB」只是下限，补 512 段上限例子（600 个 1 MiB → 两批）。
  - 原「固定社区快照与独立工作版的差异」一节挪进「排错先问三件事」的「哪个版本」段，只保留三条要点，明细链到 #版本差异。
  - 原「读 RFork 前先分清谁在哪一层（原 rfork-terms 页）」去掉「搬运、未重写文风」这句 meta 文本，类名改成中文说明；ImportError 原文挪到「会报什么错」。
  - 新增 GLM 双机一节（四个 H3）：前提（推演不是实测、工作版无 GLM 模型、官方测试表无 GLM-5.3-Flash W8A8）；32 次借用；**读的字节和常驻权重分两本账**（每卡读 ≈21,416 MiB ≈ 20.91 GiB，常驻 21,078 MiB ≈ 20.58 GiB，差约 339 MiB 的来源）；W8A8 为何省不掉后处理；能否受益（单实例首启必回退、EPLB 绕过、约 38 个 KV 块的推断）。
  - 常见误解加两条：「读的字节就是常驻权重」「归还租约 400 = 租约过期」。
  - 对照源码：怎么开补全三项必填与默认值、Planner 四条路由、示例 Planner 的 TTL；会报什么错改成 11 行日志表（含状态码分支）；版本差异在原补丁表外**新增行为对照表**（v0.23=固定镜像 / v0.26 / main / 工作版，11 行），并写明「这一节是全章唯一的版本对照」；源码位置改成三栏表 + 来源与结论对应 + 页末待核 6 条。
- frontmatter：summary 改写（112 字），updated → 2026-10-02，sources 末尾追加第 14–22 条（原 1–13 编号不变）。
- 图：新增 wiki/diagrams/rfork-two-paths.yaml/.svg；rfork-architecture 原样保留，挪到「三条通道」一节（rfork-transfer 也在用，没改）。

**数字出处**

- 每卡读 20,572 + 844 ≈ 21,416 MiB、整实例 ≈ 335 GiB、主模型 ≥ 21 批、草稿 1 批、32 次借用、约 38 块（3,855 → 约 3,817）：01 §A0.8「在我们部署下的具体数字」与「待核 6」。
- 常驻 21,078 MiB = 20.58 GiB、主干 20,537 MiB、MTP 540.75 MiB、草稿词表每份 151.25 MiB：02 §1.3、§7.5；页内链到 D 页「每张卡上放了什么」。
- 每块 8,355,840 B、示例 3,855 块：D 页「两种块数各在什么时候用」。
- 每台机器从存储读约 305 GiB：npu-worker-lifecycle 第③步的 calc。
- 装批 calc、6 亿 BF16 例、600 × 1 MiB 例：示意数，规则对照 transfer_backend.py 121–152 行。

**核心概念对照了什么（本轮实际读过的源码）**

- 工作版 rfork@3284850b（tools/repos/rfork 的 HEAD 即此提交）：rfork_loader.py 373–383（EPLB 绕过）、610–627（先搭后借、transfer failed）、645–672（回退与拒绝回退）；transfer_backend.py 33–35（1 GiB / 512 / 4096）、121–152（先切段再按序装批）、216（YuanRong 导入报错）；tensor_layout.py 21（只排除 topk_indices_buffer）；config.py 11–15（心跳 30 s、归还 3 次 × 30 s）；session.py 38–44（三项必填）、196–213（归还被拒或用尽 → 不发布 seed）、324（start_seed_service 内登记内存）；identity.py（指纹含 DP 大小，seed key 含 tp/pp/ep 与 is_draft_worker，不含全局 rank）；planner_client.py 76–109（借：404 → 无 seed，其他错误 → None）、132–155（还：200/404 → RELEASED 且日志注明 404 不代表按时归还；408/429/5xx → 可重试；其余 → 被拒）；examples/rfork/rfork_planner.py 192–230、345–410、469–484（示例 Planner：400 只来自头信息缺失/非整数/越界；归还前先清过期租约，过期或身份不符回 404 "lease not found"；默认租约 TTL 60 s）。
- **「400 本身不能证明 TTL 过期」按源码核实成立**：示例 Planner 中过期租约在 put_seed 里先被 gc 掉再返回 404，400 只由请求头解析失败产生；客户端把 404 记成已收回、把 400 记成被拒并放弃发布 seed。生产 Planner 无代码，列待核。
- 社区版：vllm-ascend 2c59ff10 / 2ed6cbba / baa023ad / db701c1f 四个钉点的 rfork 目录——db701c1f 与 2c59ff10 diff 为空；2c59ff10→2ed6cbba 只删了 layer_sharding 绕过；三版都在搭模型前 is_seed_available()，都先 start_seed_service 再做非量化后处理；只有 main 在后处理后 torch.npu.synchronize()（0001）、按地址区间排除草稿（0003）、登记期间持有张量引用（0002）；三版 seed key 都是含 node_rank 的明文拼接；三版装批都不切段；main 清单核 numel 与 element_size（另传形状）、收集按 data_ptr 去重。bc5a79ede、a59dea592 对 main 祖先检查 yes、对 v0.23/v0.26 no，#7392 为 RFork 引入提交。

**旧版信息清单勾选**（清单在 scratchpad\p5\rfork-facts.md，共 F1–F36、G1–G10）

- F1–F21、F23–F34、F36：全部保留在新版对应节（是什么 / 代价 / 八步 / 三通道 / 四种成功 / 分层 / 排错三问 / 阅读顺序 / 对照源码）。
- F22：状态与三种结果的类名（RForkLifecycleState、LeaseReleaseResult、RForkSeedServiceStartResult、RForkFallbackCleanupResult）在正文改成中文说明，类名本身留给 [rfork-lifecycle](../../../wiki/concepts/rfork-lifecycle.md) 展开（原文就是指向该页）。
- F35：核对方法与日期保留；「verified 只有 rfork:main 一个」是 frontmatter 的事实，正文删去这句（frontmatter 未改）。
- F36：transfer_from_seed / fetch_seed_transfer_info 等函数名不在正文出现，源码位置表按文件 + 行号给出（session.py 103–213）。
- G1–G10（01 §A0.8、02 §1.3/§7.5 新增）：全部写进 GLM 双机一节和版本差异的行为对照表。

**疑点 / 未做**

- 无 P1 疑点。约 38 块是推断（页内已标「按源码推断，未实测」并列待核）。
- `pnpm wiki:diagrams` 全量生成被别页（op-to-ai-core-intuition.yaml 缺 pins.symbols）卡住，本页图用同一 renderDiagram 单独生成；随后 `pnpm wiki:diagrams --check` 全库一致、本页无提示。
- 验证：`pnpm wiki:lint` 本页 0 报错（全库仅剩 npugraph-ex 的断链，非本页）；`pnpm wiki:audit` 本页 22 条来源全部有效（全库 2 处越界在 api-server-entry、streaming-output）。未截图、未起服务，浏览器验收留给审查。

## P5 审查（09-29）

审查日期 2026-10-02，独立审查员（Opus 5.5），只审未改页面。

**结论：8.5 / 10。学习顺序通过；`pnpm wiki:audit` 本页通过（22 条来源全部有效，2 条 PR URL 未联网属常态）；`pnpm wiki:lint` 全库通过、本页 0 提示。P1 0 条，P2 1 条，P3 5 条。**

### 初学者测试（只读前两屏）

我的一句话：新实例 B 不再从存储读 checkpoint，而是先搭好空模型，向 Planner 借一个身份完全相同、正在服务的实例 A，按地址把 A 显存里已处理好的权重字节直接读进自己的空位，借不到就清理后走默认加载；代价是搭模型（量化还有后处理）照付、身份必须一致、集群首个实例必然借不到反而更慢、多依赖 Planner 和 YuanRong。——能说清，通过。

### 学习顺序

是什么（两条路的直觉图，无数字）→ 为什么 / 代价（省哪几步、不省哪几步）→ 怎么做（八步 + 示意数装批 calc）→ 细节（三通道、四种成功、分层、排错三问、章节导读）→ GLM 双机 → 常见误解 → 对照源码。GLM 数字只出现在 GLM 双机一节；第一节末尾没有堆链接；GLM 之后只有误解和对照源码。通过。

### 400 与 TTL 过期（专项核实）

页面第 255 行（常见误解）、第 275 行（报错表）、第 347、357、365 行（源码位置与待核）都写成「400 证明不了过期」，没有把推断写成定论。逐项对照工作版源码 rfork@3284850b：

- examples/rfork/rfork_planner.py 469–484：/put_seed 只在请求头解析抛 HeaderError 时回 400；215–229 的 put_seed 先 gc_expired_leases_locked() 清掉过期租约，再找不到就回 404 "lease not found"；默认租约 TTL 60 s（第 39 行）。
- planner_client.py 132–150：200 与 404 都记 RELEASED，日志注明「404 means absent, not verified timely release」；408/429/5xx 记 RETRYABLE；其余（含 400）记 REJECTED。
- session.py 197–213：REJECTED 或重试用完即放弃延期的 seed 发布，模型照常可用。
- 生产 Planner 无代码，页面已列为待核。结论：页面说法与源码一致，不记问题。

### 核心概念对照（均为本轮实际读过的行）

- 先搭后借：rfork_loader.py 573–612，initialize_model → 处理后布局时跑后处理并 torch.npu.synchronize() → acquire_seed。页面第 90、101 行正确。
- 回退与拒绝回退：rfork_loader.py 657–670，清理结果 can_schedule_seed 为假即抛错拒绝回退。第 110 行正确。
- EPLB 绕过：rfork_loader.py 373–382、540–548，enable_eplb、dynamic_eplb 或 expert_map_record_path 任一即改走默认加载并打一条 warning。第 246 行正确。
- 装批：transfer_backend.py 33–35（1 GiB / 512 / 4096），121–152 先切段、再按「加入后超过 1 GiB 或本批已满 512 段」封批。页面两个装批演算手算复核：3 批与 4 批都对；6 亿 BF16 = 1.2e9 B ≈ 1.12 GiB；600 × 1 MiB → 512 + 88。
- 登记早于取元数据：session.py 103–148（第 118 行登记、第 122 行 fetch）。第 104–105 行顺序正确。
- seed 先上报再记启动日志：session.py 388（report_seed_once）早于 410（started 日志）。第 151 行「完成第一次登记」正确。
- seed key 字段：identity.py 254–287，含指纹、model_url、策略名、tp/pp/ep rank、is_draft_worker，不含全局 rank；指纹含 data_world_size（第 236 行）。第 102、163、215 行正确。
- 清单核对：manifest.py 225–237（numel、element_size、dtype）、260/264（条数、总字节）、300（形状，可选清单）。第 106 行基本正确。
- 默认值与端口：config.py 11–15（心跳 30 s、归还 3 次 × 30 s）；session.py 365–378（基数 > 0 时 + 全局 rank，超 65535 或基数 0 由系统分配）。第 261 行正确。
- 社区版：vllm-ascend 2c59ff10 与 db701c1f 的 rfork 目录 diff 为空；2c59ff10→2ed6cbba 只删了 layer_sharding 绕过；bc5a79ede（#12995）、a59dea592（#15439）是 baa023ad 的祖先，不是 2ed6cbba、2c59ff10 的祖先；三个钉点都在 initialize_model 之前调 is_seed_available()，只有 baa023ad 有 synchronize()。版本差异表与行为对照表的这几处说法都成立。

### 数字（对照底稿）

- 01 §A0.8（474–496 行）：20,537 + 42 × 864 KiB ≈ 20,572 MiB；540.75 + 864 KiB + 2 × 151.25 ≈ 844 MiB；合计 ≈ 21,416 MiB ≈ 20.91 GiB；16 × 21,416 MiB ≈ 335 GiB；⌈20,572 / 1,024⌉ = 21；最大张量 w13_weight 288 MiB。全部一致，手算复核 864 KiB = 18 × 4096 × 12 B。
- 02 §1.3（119–130 行）：常驻 21,078 MiB = 20.58 GiB、每份词表 19,360 × 4,096 × 2 B = 151.25 MiB。一致。差额 302.5 + 43 × 864 KiB ≈ 338.8 MiB，页面写约 339 MiB，对。
- 01 待核 6（545 行）：302.5 MiB ÷ 8,355,840 B ≈ 37.96 → 约 38 块，3,855 → 约 3,817，页面已标「按源码推断，未实测」。一致。
- 01 第 513 行：官方测试表有 GLM5-W4A8、无 GLM-5.3-Flash W8A8。一致。

### 丢信息核对

旧版信息清单 scratchpad\p5\rfork-facts.md 存在（F1–F36、G1–G10）。抽查 F10、F11、F12、F14、F17、F20、F28、G2、G3、G8、G9 在新版都在；旧版出现过的提交号与 PR 号（2c59ff10、2ed6cbba、baa023ad、bc5a79ede、a59dea592、#7392、#12995、#15439）新版全部保留。问题见 P2-1。

### 链接与锚点

`pnpm wiki:lint` 全库通过（含跨页锚点硬校验），本页无提示。全库没有页面链接到本页的旧锚点。术语表「五、RFork 工作版」（wiki/TERMS.md 第 115 行）存在。

### 截图

5193 预览服务没在运行（curl 连不上），按纪律不起服务，所以没截整页。改用 Playwright 直接渲染直觉图 SVG，存为本会话 scratchpad\rfork-review-diagram.png：A 的就绪权重、B 的空位、① 借、② 按地址读、③ 回退到 checkpoint 三条路清楚，没有 meta 文字。整页在桌面宽度下的效果尚未验证。

### P1（0 条）

无。

### P2（1 条）

- **P2-1 源码标识符从全章消失，写手勾选说明不属实。** 位置：第 159、167 行与「源码位置」表。旧版第 129 行写有 RForkLifecycleState、LeaseReleaseResult、RForkSeedServiceStartResult、RForkFallbackCleanupResult，源码位置写有 transfer_from_seed、fetch_seed_transfer_info；新版正文改成中文说明，源码位置只给「session.py 103–213」。写手记录说类名「留给 rfork-lifecycle 展开」，但 grep wiki/concepts/rfork-lifecycle.md 这四个类名一个都没有（只有 DEFERRED），全库 concepts 下也只剩 raw 摘录里有。另外第 159 行说导入失败「原文见会报什么错」，报错表给了消息原文，但没写异常类型 ImportError（源码 transfer_backend.py 214–217）。影响：问答按类名、函数名或 ImportError 检索会找不到。改法：在「源码位置」表补 types.py 一行，写上四个类名，在 session.py 行写上两个函数名；报错表那一行注明是 ImportError。正文不用加行内代码。

### P3（5 条）

- P3-1 第 209 行「每台机器要从存储读约 305 GiB」丢了出处页的前提：npu-worker-lifecycle 第 137 行写的是「主机内存装得下整份文件时」，01 待核 1 也注明这是按 02 还原的数、未计视觉塔与 scale。建议补半句前提。
- P3-2 第 261 行三项必填只给了 model_url、rfork_scheduler_url 的环境变量，漏了 model_deploy_strategy_name 的环境变量 MODEL_DEPLOY_STRATEGY_NAME（config.py 101–108）。
- P3-3 H2「读 RFork 前先分清谁在哪一层」排在第五节，标题里的「读前先」和位置不符。建议改成「同一个词分属不同层：软件栈、角色与编号」之类。
- P3-4 第 179 行「其他页需要时链接过来」是写给写手的话，读者用不上。建议改成「各子页的版本说明以这里为准」。
- P3-5 第 191 行提到「知识库术语表第五节」但没有链接；直觉图里没有画「还租约」，可在图注或第 78 行补一句（第 108 行已讲，不强求）。

### 跳过的内容

frontmatter 的 sources 区；「对照源码」各 H3 正文只 grep 核对（五个 H3 齐全、顺序对，版本差异含 v0.23 / v0.26 / main），另按 400 专项读了第 263、275、347 行；HANDBOOK、docs/plans/ 未读。整页截图因预览服务未运行而跳过。

## P5 修订记录（10-02）

逐条对应「P5 审查」：

- **P2-1 已修。** 先更正写作记录里的错误说法：类名「留给 rfork-lifecycle 展开」不成立，该页只讲七个阶段、三种归还结果、延期等概念，没有类名。修法：
  - 源码位置表新增 types.py 12–49 行：写出 RForkLifecycleState（七个值）、LeaseReleaseResult（RELEASED / RETRYABLE / REJECTED）、RForkSeedServiceStartResult（STARTED / DEFERRED / FAILED，只有 STARTED 为真）、RForkFallbackCleanupResult（三项字段；can_schedule_seed 只看服务和内存，租约没还完不挡回退）。依据：rfork@3284850b types.py 12–49，rfork_loader.py 667–671。
  - session.py 行写上 transfer_from_seed；核对发现 fetch_seed_transfer_info 定义在 seed_client.py 89 行（session.py 第 15 行导入、第 122 行调用），旧版写「在 session.py」是错的，这里按源码写成 seed_client.py 89–96。
  - 报错表那一行改成「ImportError: RFork requires …」，并写明是初始化传输引擎时导入 yr.datasystem 失败（transfer_backend.py 207–217）；正文第 159 行补「抛导入错误（ImportError）」，不加行内代码。
  - 正文第 167 行改为中文列出七个阶段、两组三种结果和清理结果，指向生命周期页讲机制、指向本页源码位置看类名。
  - sources 追加第 23–25 条（types.py、seed_client.py、transfer_backend.py 207–217），来源与结论对应补一行 [C23][C24][C25]。全页角标 29 处，C 级 76%。
- **P3-1 已修。** 305 GiB 补上前提「主机内存装得下整份文件时」，并注明是按权重形状还原的估算、没算视觉塔和缩放系数、真值只会更大（与 npu-worker-lifecycle 第③步 calc 的旁注一致）。
- **P3-2 已修。** 补 MODEL_DEPLOY_STRATEGY_NAME（config.py 101–108 核过）。
- **P3-3 已修。** H2 改为「同一个词分属不同层：软件栈、角色与编号」；本页阅读顺序表里的锚点同步改；改前 grep 全库无其他页链接旧锚点，lint 跨页锚点校验通过。
- **P3-4 已修。** 两处写给写手的话改成「各子页的版本说明以那里 / 这里为准」。
- **P3-5 部分修。** 直觉图图注补上「读完后 B 把租约还给 Planner，确认收回后自己也登记成 seed」，并重新生成 SVG（图上文字仍是 8 段）。「术语表第五节加链接」不改：wiki/TERMS.md 不是站内渲染页面——src/ 下没有任何代码引用 TERMS，全库 concepts / sources 也没有一页链接它（grep 0 命中），加链接会在前端变成死链；保留纯文字指引。

验证：`pnpm wiki:lint` 全库通过；`pnpm wiki:diagrams` 只更新本页 1 张、`--check` 281 张一致且本页无提示；`pnpm wiki:audit` 通过，本页 25 条来源全部有效、全库越界 0。写作标准自测：正文 5,755 字，行内代码 0/千字、正文角标 0、calc 0.35/千字、免责 2.6%，各项通过。旧版信息清单已同步勾选（scratchpad\p5\rfork-facts.md 末尾）。

- 修正（10-02，rfork-identity 写手按主会话裁定）：第 105 行「各并行组的大小」改为「TP / PP / DP 各组的大小、是否开 EP」，注明 EP 组大小一栏实际为空并链到 [rfork-identity#部署指纹里写了什么]；第 248 行「同为 TP8、DP2、EP16、W8A8……否则指纹不同」改为「开 EP」并补一句 EP16 不单独进指纹、由 TP8、DP2 与开了 EP 隐含（依据 rfork@3284850b identity.py 160–167、233–235，vllm@568afb3a ParallelConfig 无 expert_parallel_size / ep_size）；底稿 01 第 511 行同口径改正。lint、audit 退出码 0，本页写作标准仍全 ✓（免责 2.6%）。
