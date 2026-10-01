# kvpp 审查记录

## P5 写作记录（2026-09-29，第 14 批，Opus 写手）

**字数（measureStandard 口径：汉字 + 拉丁词，去 frontmatter、围栏和链接地址）。** 改前 1,227（p4-checkpoint 版，全是正文、无源码区）→ 改后教学正文 4,842（按同一规则数全文约 6,776，含对照源码）。教学正文行内代码 0、对照源码之上角标 0、calc 4 个（0.83/千字）、免责句 2/139 = 1.4%、图先行、图宽均 ≤900，`checkStandard` 无问题。

**改了什么。**
- 按 09-29 讲法重排为：是什么（三个前置概念各一句 + 8 层 4 卡示意 + 直觉图）→ 为什么需要（示意数 48 MiB / 6 块；GQA 对照；代价；四行对照表）→ 层怎么分、留多少显存（三条规则、2 个暂存区、calc、通用式、调度器侧不变）→ 历史怎样到位（四步、时间线图、新潜向量写回、整层广播 calc）→ 能和谁一起开（条件表 + 池化/PD 细节）→ 代码走向（流程图）→ GLM 双机（结论 + 两个变体推导 H3）→ 常见误解 10 条 → 对照源码五个 H3。
- 图三张，均手写 spec：`kvpp`（直觉图：上排不开/开 KVPP 的按层驻留与 2 个暂存区，下排新 token 逐层往下算、每层的历史由该层常驻卡发来，突出第 2 层由卡 1 发）；`kvpp-broadcast`（上排第 2 层整层广播到 3 张卡的暂存区 A、各卡仍算本卡的头；下排卡 3 的计算流/传输流时间线，提前一层、A/B 轮换、第 0 层干等）；`kvpp-flow`（新增，代码流程：启动一次的开关→组大小→检查→建组→分层→算块数→报引擎→分配→挂等待点，含「组大小 1」「报错」两条分支；每步的「有无历史」分支与逐层等/发循环）。没有新增 exchanges 分镜动图。
- 基础节全部用示意数（8 层、4 卡、每层每块 1 MiB、每卡 48 MiB），GLM 数字只出现在 GLM 双机一节；GLM 段整体标「变体推导」，写明钉住的 db701c1f 没有 KVPP、main 上 GLM 因混合模型与录图被启动检查拒绝。
- 官方测量（GLM-5.2、950DT）只放在「开销和什么时候别开」，注明另一模型、另一硬件，本部署无 KVPP 实测。

**数字出处。**
- 02 §1.4：存 KV 的是 11 + MTP 共 12 层；每 token 13,056 B。02 §5.6：潜向量 1,024 B/层/token、索引器 64 B/层/token；每块每层主缓存 655,360 B、索引器 40,960 B；MLA 在 TP8 各卡复制。
- D（glm-5-3-flash-two-node）「剩下的显存变成多少 KV cache」：算例 3,855 块（只引用，不重算）。
- 本页新推导（变体）：11 ÷ 8 = 1 余 3 的分法；最满卡 5 × 1,088 = 5,440 B、其余 4 × 1,088 = 4,352 B；一层全部块 3,855 × 696,320 = 2,684,313,600 B ≈ 2.50 GiB；每卡每步收 9 或 10 层 ≈ 22.5–25 GiB。均标变体推导，并写明不能换算成 GLM 块数或容量倍数。
- 官方测量：vllm-ascend@baa023ad 用户指南 feature_guide/kvpp.md 第 138–197 行（容量 6.25× / 5.35×；TTFT −0.33% / +0.19% / +3.36% / +11.01%；prefill 吞吐 −2.30% / −5.40% / −12.40% / −12.77%）。

**核心概念对照了什么。** 全部对照 vllm-ascend@baa023ad 源码：`KVPPConfig.from_vllm_config` / `validate`（组大小 = TP × PCP，8 条启动报错的顺序与文案）、`platform.py` 只在 size > 1 时检查且 V1 不许 PCP、`parallel_state.py` 的组划分（按 DP、PP 分组）、`kv_cache_placement.py`（连续均分、余数给前面、MTP 层剔除、bundle、`KVPP_SCRATCH_BUFFER_COUNT = 2`、预算公式、FullAttentionSpec 要求）、`worker.py` 块数乘回逻辑字节、`kvpp_cache.py`（常驻层连续分配、非本卡层按目标层序号 % 2 轮换暂存区）、`distributed/kvpp.py`（broadcast + wait + 完成事件）、`worker/v2/kvpp.py`（第 0 层先发、等到即发下一层）、`mla_v1.py` / `sfa_v1.py` 等待点、V1/V2 有无历史判定、pool_worker 与 Mooncake base_worker 只登记常驻层；vLLM@0fc695fc 取各卡最小块数、`deepseek_mtp` 归一成 `mtp`；GLM 混合模型声明（db701c1f 与 baa023ad 两处）；四个钉点 `git grep -i kvpp` 结果（2c59ff10 / 2ed6cbba / db701c1f 为 0，baa023ad 23 个文件）；官方用户指南、设计文档、additional_config、支持矩阵。

**旧版信息清单勾选**（清单在会话 scratchpad `p5/kvpp-facts.md`；F = P4 版，G = P4 之前 0f97c8b 版中仍成立而 P4 已丢的项）：
- F1 TP 下历史不一定按比例切、某些 MLA 配置复制 → 保留（第一节第三条 + 为什么一节）。
- F2 每层一个常驻 owner → 保留。F3 main 实验实现、db701c1f 没有、不给 GLM 部署命令 → 保留（GLM 节 + 版本差异）。
- F4 MLA 复制取决于实现与配置，不是数学定律 → 保留（为什么一节，以 DCP 为反例）。
- F5 8 层 4 卡、每卡常驻 2 层 + 2 暂存 → 保留（直觉图与 calc）。F6 bundle → 保留。F7 排序、连续均分、余数给前面、MTP 不参与 → 保留。F8 2 个暂存区 → 保留。
- F9 (ceil(L/N)+2)×B、4B vs 8B、暂存区使节省小于除以 N → 保留（通用式 + calc + 注）。F10 按实际 bundle 字节、不等大层、额外常驻单算、不是整模型降幅 → 保留。
- F11 广播后各卡仍算自己的 TP、owner 只改常驻位置 → 保留（图 2 + 误解）。F12 首次读写前等待 → 保留。F13 提前请求下一层、窗口不只 QKV、不保证覆盖 → 保留。F14 整个已分配 bundle、容量增加广播量 → 保留（calc + 误解）。
- F15 无历史跳过、V1/V2 各有判定、混合批/恢复历史按条件区分 → 保留（第 1 步 + 误解 + 源码区）。
- F16 PP/DCP/KVPP/卸载对比表 → 保留（卸载一行补上 CPU offload 与外部 KV 池两个链接）。
- F17 组 = TP×PCP、隔离 DP 与 PP、TP=1 且 PCP=1 无收益、PCP 需 V2 → 保留。F18 启动条件全套、AscendStoreConnector 另作池化路径 → 保留（报错表 + 组合表）。F19 GLM 同含 KDA 与稀疏 MLA、不能忽略混合限制 → 保留。
- F20 收益来自减少容量不足引起的卸载或重算、代价是广播同步暂存 → 保留（为什么 + 误解「开了就更快」）。F21 其他模型数字不作本站 GLM 结果 → 保留（官方测量段明确标注）。
- F22 无设备读者用 L/N/B 复算、跟踪层 1 → 改为贯穿全页的 8 层 4 卡示意数与通用式，跟踪对象换成第 2 层（与两张图一致）。
- G1、G2 GQA 按头分、不够分才复制、KVPP 只认 MLA → 恢复。G3 调度器侧不变、乘回逻辑字节、前缀缓存与块分配不知情 → 恢复。G4 等待点位置、等到即发下一层、第 0 层在前向开头发 → 恢复。G5 两个暂存区分工 → 恢复。G6 单独流 + 单线程执行器、异步不来自 async_op → 恢复（源码区）。G7 试跑与测显存不广播 → 恢复。
- G8、G9 官方容量与性能测量 → 恢复并按 baa023ad 用户指南现文更新（现为 950DT、GLM-5.2，并补 32K 与 90% 命中的行）。
- G10 池化命中率 8.46%→45.46%、+46.65%（493ec2b 构建）→ 删除：baa023ad 用户指南已不含这组数（`git show` 后 grep 45.46 / 46.65 / 493ec2b 均无命中）。
- G11 Layer Sharding 机制相近、对象是权重 → 恢复（对照表后一句，注明只在 v0.23 上有）。G12 KV 池与 KVPP 可同开 → 恢复（组合表）。
- G13–G15 三条误解 → 恢复。G16–G18 开关默认、无单独 size、建组断言、FullAttentionSpec 要求 → 恢复（源码区）。
- G19 三份官方文档说法矛盾、以代码为准 → 恢复，并按 baa023ad 现文更新 additional_config 的表述（现为 PCP 可用、KV 传输连接器不支持）；把「比代码旧」改为「与代码不符」，因为两份文档在 09-15 之后都还有别的提交，不能凭日期判断先后。
- G20 版本分布 → 恢复（版本表加 db701c1f 一列与上游 vLLM 一行）。G21 源码位置表 → 恢复并补 V2、池化、Mooncake、GLM 混合声明等行。

**验证。** `pnpm wiki:lint`：本页 0 报错（全库报错来自并行在改的 kv-pool、large-scale-ep 等页）。`pnpm wiki:diagrams --check`：kvpp 三张图与 spec 一致、无溢出/重叠/提醒（全库唯一不一致的是 kv-pool-glm-cards.svg，属别页）。`pnpm wiki:audit`：本页 30 条来源全部可解析，图 pins 的标识符都能在钉住源码里找到，本页 0 报错（全库报错来自 large-scale-ep）。图用 Playwright 把 SVG 单独渲染成 PNG 自查过排版，未起服务、未做页面浏览器验收。

**自查疑点。** 无 P1 疑点。需要审查员留意的推断：①「CPU offload 等其他连接器会被启动检查拒绝」按 `validate` 代码推断，未实跑；② KV 池「不支持按层存取」「consumer 未验证」取自用户指南，未逐条核代码里是否有对应检查；③ GLM 两个变体推导以主线算例 3,855 块作尺子，已写明开 KVPP 后块数只会更多、不能换算为 GLM 容量倍数。

**跳过。** 没有被拦的读取；没有看 zhihu / AMD / xzclass 原页（本页不讲通信原语与 TP/DP/EP 本身），只看了本地参考图库里的 amd-06（每卡标「KV: FULL!」）与 xzclass-01（Broadcast），借用「把状态写在卡上」「成对对照图」的讲法画直觉图。

## P5 审查（09-29，Opus 5.5 独立审查员）

**结论：9 / 10。学习顺序通过；`pnpm wiki:audit` 本页通过；P1 = 0，P2 = 2，P3 = 3。**

### 初学者测试（只读前两屏）
KVPP 是把 TP 组里那几份一模一样的 MLA KV cache 拆开：每层只让一张卡长期存，算到这层时这张卡把整层历史广播给同组其他卡，其他卡收进 2 个轮流复用的暂存区。换来的是能装更多历史（示意例子里 8 层分 4 卡是 2 倍），代价是每层都要搬整层的字节、只能 eager、每卡还要多留 2 个暂存区。第一屏的成对对照图（不开 / 开）加下半截的逐层「谁发」链条，一眼能看出「存在哪」和「在哪算」是两件事。学习顺序合规：是什么（含三个前置概念 + 8 层 4 卡小例子 + 直觉图）→ 为什么 → 怎么分 / 怎么到位（两处示意演算）→ 组合条件 → 走一遍 → GLM → 误解 → 对照源码；GLM 数字全部落在 GLM 段之后，基础节只用示意数（符合共性问题 12、13）。

### 核心机制逐条核对（对照 vllm-ascend `baa023ad`，均自行打开源码核过）
- 开关与组大小：`enable_kvpp` 默认 false、`size = TP × PCP`、无单独参数 — `vllm_ascend/ascend_config.py#L61-L77` ✓；`size > 1` 才跑 `validate`，由 `vllm_ascend/platform.py#L1500-L1502` 调 ✓。
- 启动检查的**条目与顺序**（DCP → 连接器 → kv_consumer → eager → MLA/非混合 → MTP method → 每批步数）与页面表格一致 — `ascend_config.py#L79-L100` ✓。页面「GLM 录了图会先撞 eager 这条」也对（GLM DCP=1、无 kv_transfer）。
- 层划分：先按层号排序、剔除 MTP 层，再 `divmod(层数, size)`，余数给靠前的 rank — `core/kv_cache_placement.py#L128-L160` ✓。页面「8 层 4 卡 → 每卡 2 层」「10 层 4 卡 → 3/3/2/2」「GLM 11 层 8 卡 → 3 张卡各 2 层、5 张卡各 1 层、卡 0 是第 3、7 层」全部复算无误（GLM 的 MLA 层号 3,7,…,43 见 `docs/mainline/02-forward.md:28`）。
- 容量公式：每块字节 = 常驻层（含 owner=None 的 MTP 层）+ 2 × 最大层 bundle — `kv_cache_placement.py#L33-L45`（`KVPP_SCRATCH_BUFFER_COUNT = 2` 在 #L20）✓；worker 把块数乘回**逻辑**每块字节报给引擎，所以调度器 / 前缀缓存 / 块分配看到的规格不变 — `worker/worker.py#L540-L546, L1096-L1103` ✓，页面这一段（第 125 行）说法准确。
- 暂存区轮流用：非本地层按 `target_index % 2` 指向两个 scratch — `worker/kvpp_cache.py#L30-L57` ✓。
- 前向路径：一开头判 `num_computed_tokens > 0` 才发第 0 层（`worker/model_runner_v1.py#L2486-L2487`），dummy / profile 传 False（#L4177）；`wait_for_layer` 等到后立刻发下一层（`worker/v2/kvpp.py#L87-L114`），等待点挂在 MLA / SFA 第一次读写 cache 之前（`attention/mla_v1.py#L2061, L2142`、`attention/sfa_v1.py#L1719, L1761`）；广播走单独传输流（`distributed/kvpp.py#L22-L36`）✓ — 页面第 129–136 行与 kvpp-flow 图逐格对得上。
- PCP 必须配 Model Runner V2：`platform.py#L1493` ✓；KV 池 / PD 分离的 KVPP 分支确实存在（`.../ascend_store/pool_worker.py#L126, L272, L937-L940, L3110`）✓。
- 版本口径：v0.23（`2c59ff10`）、v0.26（`2ed6cbba`）、GLM 基线（`db701c1f`）三处 `git ls-tree`/`git grep` 均**无** kvpp 文件与符号，只有 main（`baa023ad`）有 ✓；引入提交 `45b74a69`（2026-09-11，#16094）与 `cafae11e`（2026-09-15，#16444）日期、PR 号与页面一致 ✓。

**结论：核心概念无错，0 条 P1。**

### 数字复核
- 示意演算逐个手算通过：48 ÷ 8 = 6 块、48 ÷ 4 = 12 块、2 倍；8 卡 8 ÷ 3 ≈ 2.7、2 卡 8 ÷ 6 ≈ 1.3；一层 bundle 12 MiB、(8 − 2) × 12 = 72 MiB。
- GLM 变体推导与底稿一致：每层 1,024 + 64 = 1,088 B、12 层 13,056 B（`02-forward.md:496-508`、D 页「占住一个块号」）；(2+1+2) × 1,088 = 5,440 B、(1+1+2) × 1,088 = 4,352 B；一层一块 696,320 B、3,855 × 696,320 = 2,684,313,600 B = 2.50 GiB、9 或 10 层 → 22.5–25 GiB，全部复算无误。
- 官方测量逐格对过上游用户指南（`docs/source/user_guide/feature_guide/kvpp.md#L160-L190`）：6.25× / 5.35×、235,008→1,467,904、555,392→2,972,416、TTFT −0.33% / +0.19% / +3.36% / +11.01%、吞吐 −2.30% / −5.40% / −12.40% / −12.77%，以及测试条件（GLM-5.2、950DT、Model Runner V1、eager、未开 MTP、TP8+EP 与 TP8+PP2+EP 38/40 层）全部一致，无改写、无夸大。
- **变体纪律通过**：未启用一节写死「不能，也没有开」；两处 GLM 计算均在标题和正文标了「变体推导」，并写明不能换算成容量倍数；官方数字明确标为另一模型另一硬件、本部署无任何 KVPP 实测。没有虚构部署数，也没有把 GLM 主线数字说成 KVPP 的效果。
- 与依赖页口径一致：R1 的 MLA（full 组）确实只用 1 个块号（`one-request.md:534`），没有把区间写成定值；DCP / PP / 卸载各只有一行加链接，没有重讲。

### 丢信息核对
对 `git show p4-checkpoint:wiki/concepts/kvpp.md` 逐条比（旧版 5 个 H2、57 行正文）：F1–F21 与写手 facts 清单里的 G1–G21 全部在新版找到落点（旧 [C1]–[C10] 的机制点分别进了「层怎么分」「历史怎样到位」「能和谁一起开」「对照源码」四节）。唯一未保留的是旧版结尾 F22「无设备读者可先用 L/N/B 复算容量」，属阅读建议类 meta 文本，删掉符合「页面不写 meta 文本」的现行规则，不算丢信息。

### 链接与渲染
- 正文 29 个站内链接目标文件全部存在；含锚点的 12 个（tensor-parallel 两处、gqa、kv-cache 两处、glm-5-3-flash-two-node 五处、one-request、pipeline-parallel、collective-communication#broadcast）逐个查到对应标题；`pnpm wiki:lint` 的 `broken-anchor` 硬校验通过（本页 0 报错）。
- `pnpm wiki:audit`：**本页通过**，30 条来源行号全部有效，在「写作标准名单 63 页 / 达标 63 页」之内。
- 浏览器实测（Playwright，桌面 1440×900，用户已在跑的 5193，未起停服务）：首屏与三张图正常渲染，图宽均 900px，`scrollWidth == innerWidth == 1440` 无横向溢出；控制台只有问答后端 8790 的 502（本页无关）。截图：`scratchpad\kvpp-review-first.png`、`kvpp-review-diagram.png`、`kvpp-review-fig2.png`、`kvpp-review-fig3.png`。
- 格式：对照源码之上无证据角标；行内代码 14 处（远低于每千字 13 的上限）；每节至多 1 个 calc；表格与 calc 不相邻；对照源码五个 H3 齐全且顺序正确，版本差异列齐 v0.23 / v0.26 / GLM 基线 / main 四列。本页未新增分镜动图。

### P1（0 条）
无。

### P2（2 条）
- **P2-1「算例」被写成「实际分配」。** 位置：`wiki/concepts/kvpp.md:216`，「拿主线**每层实际分配的量**当尺子：一层 MLA 缓存在每张卡上约 2.50 GiB」。问题：3,855 块是 D 页明示的示例算例值（假设每卡 64 GiB、权重按 21 GiB 取整，见 `glm-5-3-flash-two-node.md:218, 227-231`），不是启动日志里的实测分配；同段 calc 标题已正确写「按主线算例块数」，正文这句却读起来像实测，和本批「不把估算当实测」的要求冲突。复现：对照 D 页第 218 行「3,855 块是贯穿主线的示例值……实际部署的块数须代入启动日志中的显存值」。改法：把「每层实际分配的量」改成「算例里每层分配的量」，与 calc 标题统一。
- **P2-2 kvpp-broadcast 时间线上「等」一字两义。** 位置：`wiki/diagrams/kvpp-broadcast.yaml` / `.svg` 下半截卡 3 时间线（截图 `scratchpad\kvpp-review-fig2.png`）。问题：计算行里斜纹块标「等」（等待广播），紧挨着的绿块标「层 0 attention 等」（此处「等」是「等等」），同一行同一个字两个意思，初学者容易读成「等 attention」。改法：斜纹块改成「等广播」，绿块改成「层 0 attention 等后续计算」（或「层 0 attention 及其余计算」）。

### P3（3 条）
- **P3-1** `kvpp.md:109`「每个暂存区按最大的那一层 bundle 开」未说明 MTP 层不计入这个最大值：代码取 max 时只遍历有 owner 的层（`kv_cache_placement.py#L38-L43`）。对 GLM（各层等大）无数值影响，建议补半句。
- **P3-2** 官方 TTFT 只列了 32K 与 128K，省掉 64K（单机 +1.52%、双机 +8.53%）。这两个数支持「输入越长、越藏不住」的结论，补上更完整。
- **P3-3** `wiki/index.md:73` 仍是旧标题「KVPP：按层共享缓存与提前广播」和旧摘要。index.md 是 `pnpm wiki:build` 的派生物、全批共用，属批次收尾事项，不是本页写手的遗留。

### 写手自查疑点的核实结果
- ①「CPU offload 等其他连接器会被拒、但报错文案写的是 PD 分离要用 MooncakeConnectorV2」：核 `ascend_config.py#L83-L88`，逻辑确如页面所述（非 AscendStoreConnector 且非 MooncakeConnectorV2 → 抛 PD 那句），页面已写明「按代码推断，没有实跑」，处理得当。
- ② KV 池那几条取自用户指南、未逐条核代码：`pool_worker.py` 里确有 `use_kvpp` 分支（#L126, L272, L937-L940, L3110），方向无误；「不支持按层存取」「跨 PP 段分片齐了才算命中」两条我也只做到定位分支、未逐行核实，结论保持写手的限定说法。
- ③ 以 3,855 块作尺子：数值与限定语我都复核了，仅措辞问题已记为 P2-1。

### 跳过
- 未读页面 frontmatter 的 sources 区（由 audit 校验）；未读「对照源码」里的命令块与成排环境变量正文，该节只核标题齐全性、顺序、版本列与关键结论。
- 未看 zhihu / AMD / xzclass 原页（本页不讲通信原语与 TP/DP/EP 本身，与写手同判）。
- 未实跑 vllm-ascend（无设备），所有机制结论只到源码层。

## P5 修订记录（09-29）

- **P2-1 已修。** 「整层广播放到 GLM 的尺子上」一节首句改为「拿主线算例里每层分配的量当尺子（算例值，不是本部署的实测分配）」，和 calc 标题「按主线算例块数」一致；源码区「每层约 2.50 GiB（按主线算例块数）」原本就标了算例，未改。
- **P2-2 已修。** `kvpp-broadcast.yaml` 时间线：斜纹块「等」改成「等广播」，三个绿块「层 i attention 等」改成「层 i attention 及其余」；为放下新标签，时间线 labelW 96→72、scale 68→72（总宽 24 + 72 + 11 × 72 = 888 ≤ 900）。已重新生成 svg，并把 SVG 单独渲染成 PNG 核对，标签没有溢出，也没有压到别的元素。
- **P3-1 已修。** 正文「每个暂存区按参与划分的层里最大的那一层 bundle 开，MTP 层不计入」；源码区预算那条补「只在有 owner 的层里取，MTP 层不计入」（对照 `kv_cache_placement.py#L38-L43`）。
- **P3-2 已修。** 官方 TTFT 补 64K 一行（单机 +1.52%、双机 +8.53%），并加一句「输入越长，越藏不住」。
- **P3-3 未改，按审查意见属批次收尾。** `wiki/index.md` 是 `pnpm wiki:build` 的派生物、全批共用，不在本页写手的改动范围内，留给主会话收尾时重建。
- **检查。** `pnpm wiki:lint`、`pnpm wiki:diagrams --check`、`pnpm wiki:audit` 本页均 0 报错；三项的全库报错都来自 kv-cache-sparse-offload（别的写手正在改，图 svg 未生成）。`checkStandard`：教学正文 4,868 字，行内代码 0，角标 0，calc 0.82/千字，免责 1.4%，均通过。
