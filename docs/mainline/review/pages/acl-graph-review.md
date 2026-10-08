# acl-graph 审查记录

## P5 写作记录（2026-09-29，第 18 批深改）

**改了什么。** 正文从 p4-checkpoint 的 5 个小节（去 frontmatter 后 4,869 字符）重写为 5 个正文 H2 + 常见误解 + 对照源码（15,967 字符，审计口径 7,222 字 / 7 节）。新顺序是：是什么（一句话定义 + 三个前置词）→ 为什么需要（decode 一步等的是 Host）→ 怎么做（一张图里录了什么、每轮三步）→ 限制（什么进不了图）→ GLM 双机 → 常见误解 → 对照源码。按本批要求，捕获 / 回放的一般道理、7 张图的清单、补齐账都只写一句话加链接，分别指向 `graph-mode-layer.md`（含 `#官方双机上录了哪-7-张图`、`#对照源码`）与 `concurrent-requests.md`（`#进入第-4-站之前宽度先按自己补再按对面补`、`#先补到自己这组的图尺寸`），本页不重推。

**两张图。**
- `acl-graph.yaml`（重画，直觉图）：一步里 6 个设备任务的两条时间轴。上「逐个下发」——Host 6 段交任务背靠背，设备每算 1.5 格就要空等（斜线格），整步 13.5 格；下「整串回放」——Host 只占 1 格，设备 6 个任务连着算完，整步 10 格；两条都标出设备真正在算 9 格。格数是示意，图注写明不是实测。原图是脚本生成的 JSON 式 yaml，画的是补齐档位，与 `concurrent-requests` 重复，本轮换掉。
- `acl-graph-buffers.yaml`（新增）：第 k / k+1 轮的内容写进同一组固定地址（token 编号、位置与已算长度、block table），图只记次序与地址，结果落回同一块输出缓冲。
- `pnpm wiki:diagrams` 重生成后 `--check` 全库一致；两图都过了渲染器的越界 / 压字检查，也按提示把图上的整句改成短语。

**数字与结论出处。**
- 档位 `FULL_DECODE_ONLY` 与 7 个捕获宽度 `[4,8,16,32,64,96,128]`、`uniform_decode_query_len = 1 + 3 = 4`、7 档对应 1/2/4/8/16/24/32 条请求：01 §A0.6，只引结论并链接 `graph-mode-layer`，不重算。
- 回放前的一次同步、通用整图参数更新路径在本模型不执行且调用点在执行之后：03 §A6 第 5、6 条，并对 `acl_graph.py#L226-L259`、`model_runner_v1.py#L2778-L2835` 复核。
- 「一步混进 prefill 就没有图、两组取较低档」：03 §A6 第 7–10 条与 §B4，页内只写结论 + 链接。
- 时间账里的格数全部是示意，页内两处明说本库无 NPU 实测、不给加速比。

**核实过的核心概念（本轮实际读的源码）。**
- 支持等级四档与降级链：`vllm@0fc695fc:vllm/v1/attention/backend.py#L506-L519`、`vllm/config/compilation.py#L1343-L1425`。GLM 两类后端的声明：`indexer_kpool_mla_v1.py#L324`（稀疏 MLA，且 `AscendIndexerKPoolMLAImpl` 继承 `AscendSFAImpl`）、`ops/gdn_attn_builder.py#L224`（KDA 走的 GDN 构建器），都是 `UNIFORM_BATCH`，所以 `FULL_DECODE_ONLY` 不触发降级。
- 默认宽度表：`platform.py#L207-L241`（注入 `min(max_num_seqs × decode_query_len, 512)`，docstring 自述去掉上游的 `× 2`）+ `vllm/config/vllm.py#L1690-L1740`（`[1,2,4]` + 每 8 一档 / 256 起每 16 一档、按 token 预算截断、SP 过滤）。
- 投机下宽度取整到 4 的倍数：`vllm/config/compilation.py#L1437-L1441`、`#L1473-L1518`。
- A5 砍 4 档只在分段编译那一支调用：`platform.py#L109-L124`、`#L612-L623`。
- 报错四条：`ASCEND_LAUNCH_BLOCKING` 互斥 `platform.py#L634-L646`；`207008` 重抛 `acl_graph.py#L28-L54`；状态缓存块数校验 `compilation.py#L1453-L1468`；调试级别地址断言 `acl_graph.py#L234-L240`。
- 版本差异按名字在四个 commit 上 grep 核对：`2c59ff10` 与 `db701c1f` 的 `acl_graph.py` 关键位置行号相同；`2ed6cbba`、`baa023ad` 多识别 `Alloc sq cq fail`；main 无 `ASCEND_LAUNCH_BLOCKING` 检查、A5 门禁改成 `REDUCED_CUDAGRAPH_CAPTURE_SIZES`、多一个 `breakable_aclgraph.py`。
- 官方文档 `graph_mode.html`（v0.23）实际打开核过：ACLGraph 记在 v0.9.0rc1 起、五个档位列为昇腾支持值。~~旧版里「官方文档说更新在回放之前」那句在这页文档里查不到，已改写成不指名的流传说法~~（**10-02 更正：查错了地方**——该说法出自官方设计文档 `docs/source/developer_guide/Design_Documents/ACL_Graph.md#L85`（db701c1f），页面已改回并补回来源，见下方修订记录 P1-1）。

**旧版信息清单落位**（清单存 scratchpad `p5/acl-graph-facts.md`，逐条勾过）：p4 版 15 条全部有落点——稳定缓冲、批描述符、调试地址检查、动态注意力参数、稀疏路径不执行、流同步、平台互斥都在新版对应节；三种路径表与「先查 FULL 再查 PIECEWISE」归 `graph-mode-layer`，本页只留「模式对不上就透传」；补齐例子归 `concurrent-requests`。a6c8e7d 版另有的默认尺寸表算法、A5 砍档、SP 对齐、支持等级、状态缓存块校验、`207008`、地址断言全部核实后写进对照源码；旧版的 35 档 / 256 并发 / Qwen 场景属于默认配置的旧例子，本部署显式给 7 档，只保留算法不保留旧例子。

**验证。**
- `pnpm wiki:lint`：通过，本页 0 报错（原有的 `[mark-flood] 82% 都是 [C]` 提醒已消除：角标 30 处、C 占 22 处 = 73%）。
- `pnpm wiki:diagrams` / `--check`：270 张图与 spec 一致。
- `pnpm wiki:audit`：通过，本页 23 条来源行号全部有效，无无效 commit、缺文件、越界行号。
- 单页 `checkStandard`：problems 为空；教学正文 2,421 词、行内代码 0、calc 1 块、免责句 1.3%、正文角标 0、图宽合规。
- 未起服务、未截图，浏览器验收留给审查环节。

**仍待核。** 稀疏 MLA 与 KDA 的元数据在整趟回放时由哪一步写进固定缓冲（通用更新路径已确认不执行，同 03 §A6 待核 4）；7 张图的启动耗时与设备内存占用（要本部署启动日志，同 03 §A6 待核 1）。

## P5 审查（09-29）

审查员独立核对，只审不改页面。评分 **6.5 / 10**；学习顺序通过；`pnpm wiki:audit` 本页通过（全库因 `concepts/lora.md` code-density 失败 1 处，与本页无关）；`pnpm wiki:lint` 通过，本页无提示。

**初学者测试（只读前两屏）。** ACL Graph 是昇腾上把一步前向的几百个设备任务连同读写地址按固定宽度录下来、之后同宽度的一步只提交一次整串回放的实现；decode 一步设备算得快、Host 交任务慢，它省的是交任务的时间，计算量不变，prefill 基本吃不到收益。能说清；录图的启动时间、内存、补齐空跑等代价要到第 4 节和 GLM 节才出现。

**学习顺序。** 是什么（L59–65）→ 为什么需要（L67–87，示意格数）→ 怎么做（L89–107）→ 限制（L109–118）→ GLM 双机（L120–131）→ 误解 → 对照源码。基础节没有 GLM 数字，通过。

**示意时间账手算。** 逐个下发：Host 第 i 个任务占 [2(i−1), 2i]，设备算 [2i, 2i+1.5]，中间空 0.5；最后一个在 12+1.5=13.5 格结束 ✓。整串回放：1+6×1.5=10 ✓。设备在算 9 格 ✓，空等 13.5−9=4.5 格（开头 2 + 5×0.5）✓。图与 calc 一致。

**旧版信息清单。** 旧会话 `p5/acl-graph-facts.md` 存在（29 条）。抽查：#5 描述符 / 透传 / 调试地址检查 → L100、L106、L107 ✓；#13 启动工作与内存 → L131 + 开销节 ✓；#22 `207008` → L160 ✓；#26 事件 + 侧流换入参 → L116 ✓；#3「编译 / 捕获 / 回放三阶段，一句话 + 链 npugraph-ex」→ **正文无此句，也没有链 npugraph-ex** ✗；#27「Before replay 是官方设计文档的说法」→ **新版改成了「流传的说法」** ✗（见 P1-1）。另 #29「npugraph_ex 一句话带过」正文也没有。

**源码核对（只 grep 单行 / 读附近 ≤40 行）。**
- 回放前同步：`vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L245-L258`，条件 FULL 且非草稿 eagle 合图、`enable_enpu` 时跳过；页面 L128 ✓。
- 通用更新路径：`model_runner_v1.py#L2784-L2787` 要求 `not use_sparse and not use_compress`；`#L2825-L2835` 非 ENPU 时先 `run_model()` 后更新；`use_sparse` 由 `index_topk` 且无 `compress_ratios` 决定（`#L385-L388`）；页面 L129 ✓，与 03 §A6 第 5、6 条一致。
- 事件挡注意力：`attention/attention_v1.py` 中 `ExternalEvent().wait` 与 `update_stream` 上 `graph_task_update_begin` + `event.record`（L473–L518、L921–L922 等）；页面 L116 ✓。
- 只在启动窗口录：`acl_graph.py#L166` 调 `validate_cudagraph_capturing_enabled`，`vllm@0fc695fc:vllm/compilation/monitor.py#L90-L98` 窗口外抛 `RuntimeError`；L118 ✓。
- 支持等级：`vllm/v1/attention/backend.py#L506-L519` 四档；`gpu_model_runner.py#L6830-L6846` 取最低；GLM 两类后端 `indexer_kpool_mla_v1.py#L324`、`ops/gdn_attn_builder.py#L224` 均 `UNIFORM_BATCH`；L117、L124 结论 ✓（例外见 P3-1）。
- 版本差异：`ASCEND_LAUNCH_BLOCKING` 在 `2c59ff10`/`db701c1f`/`2ed6cbba` 的 `platform.py` 存在、`baa023ad` 无；`Alloc sq cq fail` 只在 `2ed6cbba`/`baa023ad`；与表一致 ✓。
- 数字：7 档宽度、`1+3=4`、1/2/4/8/16/24/32 条请求与 01 §A0.6（L247–L249）一致 ✓；补齐账只链 `concurrent-requests`，未重算 ✓。

### P1

1. **「参数更新在回放之前」不是流传说法，而是官方设计文档原文——写手的改动不成立。**
   位置：对照源码「版本差异」L185（「提醒一句流传的说法」）；写作记录「官方文档 graph_mode.html……查不到」一段。
   证据：`vllm-ascend@2c59ff10`、`@db701c1f`、`@2ed6cbba` 的 `docs/source/developer_guide/Design_Documents/ACL_Graph.md#L85`，`@baa023ad` 同文件 `#L72`，原文是 Before replay 时由 `update_full_graph_params()` 调后端的 `update_graph_params()`；`docs/source/locale/zh_CN/.../ACL_Graph.po` 有对应中文译文。a6c8e7d 版引的就是这份设计文档（[S10]，来源 `ACL_Graph.md#L78-L96`），信息清单 #27 也写的是「官方设计文档说法」。写手只核了用户指南 `graph_mode`，没核设计文档，结论查错了地方；新版还把 `ACL_Graph.md` 从来源里删掉了。
   影响：把官方文档的表述降格成来路不明的说法，读者无法回到原文核对；同时丢了来源。
   改法：L185 改回「官方设计文档（ACL_Graph）写的是更新在回放之前；按 Python 调用顺序，非 ENPU 路径是先 `run_model()` 后更新，成立的说法是在图里那个注意力算子真正执行之前」，来源补回 `vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/ACL_Graph.md#L78-L96`（main `baa023ad` 同一节为 `#L65-L83`），写作记录那一句同步更正。
2. **层数写错。** L124「44 层里的 34 层 KDA……和 11 层稀疏 MLA」：34+11=45；底稿 02 L26–L28 写主干 45 层（第 0–44 层），`attention-backend-family`、`attention-cost` 等页也都写 45 层。改法：「44 层」→「45 层主干」。

### P2

1. **重讲 graph-mode-layer，并与自己的声明矛盾。** L63 说「为什么省时间、录的是次序不是结果，图模式已经讲过，本页不重讲」，但 L67–L107、L115、L118 和误解 L136、L141 把 `graph-mode-layer` 的 L59–L100（Host 逐个交、decode 吃收益、录次序不录结果、图与请求无关）和 L150–L168（包装器透传不自判、只在启动窗口录、数据必须写进固定地址 + 调试核对、通用更新路径本模型不执行）基本重讲了一遍。时间轴图加了「时间」这一维，是 graph-mode-layer 没有的，可以留；其余通用段应压成一句话 + 链接，本页篇幅留给昇腾特有的部分（回放前同步、事件 + 侧流换入参、支持等级与降级、207008、ASCEND_LAUNCH_BLOCKING、A5 砍档、版本差异）。至少要删掉或改写 L63 那句「不重讲」。
2. **时间轴图注「省掉 Host 的 12 格」算错。** Host 侧从 12 格降到 1 格，省 11 格；整步从 13.5 降到 10，省 3.5 格。改法：图注改成「Host 从 12 格降到 1 格 · 整步少 3.5 格」（`wiki/diagrams/acl-graph.yaml` 第 9 行）。
3. **buffers 图箭头画错。** `acl-graph-buffers.yaml` 里第 k 轮只连到「token 编号」缓冲，第 k+1 轮只连到「block table」缓冲，读起来像两轮各写一块。实际每轮都要把三样都写进同一组地址、后一轮覆盖前一轮。改法：两条箭头都指向「固定地址」框整体（或各连三块），并标出 k+1 是覆盖写入。截图：scratchpad `acl-graph-review-acl-graph-buffers.png`。
4. **信息清单有两处勾选不属实。** #3 写「一句话 + 链 npugraph-ex」，#29 写「npugraph_ex 一句话带过」，正文都没有（grep `npugraph`/`编译` 只命中对照源码里的「分段编译」「编译期改写」）。初学者常把编译期融合和捕获回放混为一谈。改法：第一节末尾加一句「编译期把几个算子合成一个是另一件事，见 [编译期图融合](npugraph-ex.md)」。

### P3

1. L117「超出这个等级就自动降级并打一条 warning」不全：最低等级是「完全不支持」而又要求整趟图时，上游直接抛 `ValueError`（`vllm@0fc695fc:vllm/config/compilation.py#L1354-L1360`、`#L1418-L1428`）。补半句即可，可同时进报错表。
2. L71「设备几微秒就把一个任务算完」：无出处的量级，改成「很快」或删去数字。
3. 术语先用后讲：「分派器」首次出现在 L106，没有解释；L122「MTP 草稿」没有链接（可链 `mtp` 相关页）。
4. 描述符里的 LoRA 条件（p4 版 #7）没了；可在 L100 括号里补「是否带 LoRA」。
5. 队列要求的直觉图是「运行形状匹配档位、补齐后回放」，写手换成 Host/设备时间轴，理由是补齐已归 `concurrent-requests`。可以接受，记一笔。

**链接与锚点。** 本页出链 `concurrent-requests#进入第-4-站之前…`、`graph-mode-layer#官方双机上录了哪-7-张图`、`glm-5-3-flash-two-node#部署前提` 由 lint 跨页锚点硬校验通过；全库 32 个文件链到本页，没有任何带锚点的入链。

**跳过 / 未做。** 5193 预览服务没起（curl 000），按规定不起服务，**页面整页没截图**；只用 Playwright 把两张生成的 SVG 内联渲染截图（scratchpad `acl-graph-review-acl-graph.png`、`acl-graph-review-acl-graph-buffers.png`）。对照源码节正文除 L152–L153、L185 外未读（按规定只 grep 结构）；frontmatter 来源区未读；算子实现与底层代码未读。

## P5 修订记录（10-02）

按「P5 审查（09-29）」逐条处理，P1×2、P2×4、P3 顺手修，全部完成：

**P1**
1. **「更新在回放之前」改回官方设计文档说法。** 审查属实：`vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/ACL_Graph.md#L85`（grep 确认 main `baa023ad` 同文件 L72 也有）确有 Before replay 原句，09-29 只查了用户指南 `graph_mode.html`，查错了地方。版本差异段改为：引设计文档原话 [S24]（来源补回 frontmatter 第 24 条 `ACL_Graph.md#L78-L96`）+ 源码调用顺序 [C16] + 两边都成立的读法（更新赶在图里注意力算子执行之前，图停在事件上等它）[!]，并补一句说明它与「回放前同步」不矛盾（同步等的是上一轮的图放完）。写作记录原句划掉并加 10-02 更正注。
2. **层数改正。** 「44 层里」→「45 层主干里」（34 KDA + 11 稀疏 MLA = 45，与 `glm-5-3-flash.md` summary 一致）。

**P2**
1. **重讲与「不重讲」矛盾：按最小改法处理。** 第一节那句「本页不重讲」改成明确分工（档位 / 选图 / 退回的通盘规则归 `graph-mode-layer`，本页讲实现侧）；「模式对不上就原样执行」「只在启动窗口里录」两条压缩并链 `graph-mode-layer` 的 `#包装器内部透传回放还是现录`、`#启动时录运行时放`。「为什么需要」与时间轴保留：这是本批派发说明点名要本页讲的内容（示意时间对比），审查也认可时间维是 graph-mode-layer 没有的；未做整节删并。
2. **时间轴图注改正。** 「设备仍是 9 格 · 省掉 Host 的 12 格」→「Host 从 12 格降到 1 格 · 整步少 3.5 格」。
3. **buffers 图箭头改正。** 两条箭头改为指向「捕获时定下的固定地址」框整体；k+1 项副标与新增旁注写明「每轮三块都重写、后一轮覆盖前一轮」，caption 同步。两图重生成，`--check` 一致。
4. **npugraph-ex 一句补上。** 第一节末尾加「编译期把几个小算子合成一个大算子是另一件事，和回放可以同时开，见[编译期图融合](npugraph-ex.md)」，信息清单 #3/#29 的落位由此成立。

**P3**
1. 支持等级补「完全不支持 + 要求整趟图 = 启动直接报错」，C9 来源范围扩到 `#L1343-L1428` 覆盖最终 raise。
2. 「几微秒」改「很快」。
3. 分派器首现处加括号解释；「3 个 MTP 草稿」补一句解释并链[投机解码](speculative-decoding.md)。
4. 描述符括号里补「有没有带 LoRA」。
5. 直觉图换时间轴一事按审查记一笔，不改。

**角标预算。** 新增 [S24] 后去掉「补齐的浪费」行的 [D]：共 30 处、C 22 处（73%），不触发 mark-flood。

**验证（10-02）。** `pnpm wiki:lint` 通过、本页 0 报错（跨页锚点含两个新链接均通过）；`pnpm wiki:diagrams` 重生成 + `--check` 271 张一致；`pnpm wiki:audit` 通过，本页 24 条来源行号全部有效；单页 `checkStandard` problems 为空（正文 2,519 词、行内代码 0、免责句未超）。未起服务、未截图。

## P5 复审（10-02）

独立复审员，只审不改页面；范围按派发：两条 P1、四条 P2、本轮删改是否丢信息、audit。评分 **8.0 / 10**（上一轮 6.5）。两条 P1 已修好；新增 P1 0 条、P2 1 条、P3 3 条。

**P1 复核**
1. **「更新在回放之前」——已修好。** 自己 grep 设计文档 `docs/source/developer_guide/Design_Documents/ACL_Graph.md`：`2c59ff10`、`db701c1f`、`2ed6cbba` 在 L85，`baa023ad` 在 L72，都是 Before replay 由 `update_full_graph_params()` 调后端 `update_graph_params()` 那句；同文件 L100（main L87）另写了回放前同步当前流。页面 L184 现在写明出自官方设计文档 [S24]、Python 调用顺序是先执行后更新 [C16]、两者的调和读法 [!]；frontmatter 第 42 行（sources 第 24 条）为 `db701c1f:…/ACL_Graph.md#L78-L96`，与 [S24] 对上，audit 该行 ✓（文件 133 行）。与源码事实是否自洽：`db701c1f:vllm_ascend/compilation/acl_graph.py#L244-L258` 注释写明同步是为了让本轮的参数更新只在上一轮图放完之后执行；`model_runner_v1.py#L2825-L2835` 非 ENPU 先 `run_model()` 后 `_update_full_graph_params_if_needed`。页面 L127（同步保证改参数在上一轮回放结束之后）和 L184 末句（同步等的是上一轮的图，不是本轮更新）与这两处一致，不矛盾。写作记录 L25 原句已划掉并加更正注 ✓。
2. **层数——已修好。** L123 现为「45 层主干里的 34 层 KDA……和 11 层稀疏 MLA」；底稿 02 L26–L28 为 45 层、KDA 34、稀疏 MLA 11，`glm-5-3-flash.md` summary 同 ✓。页内 grep「44 层」0 处。

**P2 复核**
1. **「不重讲」矛盾——按最小改法已消除。** L64 改成分工说明（通盘规则归 `graph-mode-layer`，本页讲实现侧）；L105、L117 两条压缩并链 `#包装器内部透传回放还是现录`、`#启动时录运行时放`，两个锚点 lint 通过；被压掉的「热身、按宽度从大到小逐个录」在 `graph-mode-layer` L172 有，不算丢。剩余重叠见 P3-3。
2. **时间轴图注——已改对。** `acl-graph.yaml` 注为「Host 从 12 格降到 1 格 · 整步少 3.5 格」；重渲染截图（scratchpad `acl-graph-rereview-acl-graph.png`）与 calc 13.5 / 10 / 9 一致。
3. **buffers 图箭头——基本改对。** 两条箭头都终止在「捕获时定下的固定地址」外框左边，k+1 副标「覆盖写入同一组地址」、旁注「每轮三块都重写 · 后一轮覆盖前一轮」、caption 同步；截图 scratchpad `acl-graph-rereview-acl-graph-buffers.png`。小瑕疵见 P3-2。
4. **npugraph-ex 一句——已补。** L64 末句链 `npugraph-ex.md`；信息清单 #3（编译 / 捕获 / 回放区分）、#29（npugraph_ex 一句话带过）现有落位。

**本轮删改是否丢信息。** 09-29 版与 10-02 版都未提交、也没有中间快照（`p5-checkpoint-1/2/3` 里本页与 HEAD 相同），`git diff` 只能看到相对 HEAD 的整体改动，分不出本轮。改用首审行号逐处对照：L70「几微秒」→「很快」、L99 补 LoRA、L105 补分派器解释、L116 补报错分支、L121 补 MTP 解释与链接、L123 层数、L184 版本差异；L170「补齐的浪费」去掉 [D] 只是角标（该行是链接不是论断）。信息清单 #5、#7、#13、#27 落位仍在（L99/L105/L106、L130/L168、L184）。未发现丢信息。角标 30 处、[C] 22 处（73%），与修订记录一致。

### P2（新增）

1. **L116 的报错条件写宽了（本轮修 P3-1 引入；首审 P3-1 原话本身也不够准）。** 页面说「完全不支持」时「还要求整趟图」就启动直接报错。实际 `vllm@0fc695fc:vllm/config/compilation.py`：只有**混合批也要整趟图**（`mixed_mode()==FULL`，即 FULL 档）且最低等级为 NEVER 时，L1354–L1360 直接 `raise ValueError`；**只给 decode 要整趟图**（FULL_DECODE_ONLY、FULL_AND_PIECEWISE 的 decode 部分）且为 NEVER 时，L1372–L1396 是降到 PIECEWISE 或 NONE 并 `logger.warning`，降完后 L1418–L1428 的复检因已无整趟图而不再报错。影响：读者按本页理解，会以为本部署这种 FULL_DECODE_ONLY 遇到完全不支持的后端会启动失败，实际是降级加 warning。改法：L116 末半句改为「只有『完全不支持』又要求混合批也走整趟图时，启动直接报错；只给 decode 要整趟图的，退到分段或不录图并打 warning」；L152 对照源码那句降级链顺手补上 NEVER 的这一分支。

### P3（新增）

1. L128「这个调用点本身在模型执行之后，不在回放之前」单看与官方设计文档的 Before replay 字面相反，要读到 L184 才知道两者怎么调和。建议在 L128 括注「按 Python 调用顺序；设计文档的说法见版本差异」。
2. buffers 图两条箭头虽都落在外框上，落点仍分别贴着「token 编号」块和「位置 / block table」两块之间，粗看仍有「两轮各写一块」的残影。可把两条箭头汇到外框左边中点，或改成一条粗箭头标「每轮：三块全写」。
3. 第 2–3 节（L66–L106）与 `graph-mode-layer` L59–L100、L162–L166 仍大段同义（省提交次数、录次序不录结果、图与请求无关、数据写进固定地址）。首审已接受最小改法，时间轴图确为本页独有，记一笔。另：修订记录 P2-1 说「示意时间对比是本批派发说明点名要本页讲的」，队列本页那行写的直觉图是「运行形状匹配档位并补齐后回放」，没查到「时间对比」的点名，这条理由存疑（不影响结论）。

**验证（本轮实际运行）。** `pnpm wiki:audit` exit 0，本页 `evidence=C`、来源 24 条，非 ✓ 行只有 v0.23 `graph_mode.html` 一条 URL（未联网验证，属常态），全库「名单 76 页达标 76 页」；`pnpm wiki:lint` exit 0，输出里没有本页。Playwright 内联渲染两张 SVG 截图如上。源码 / 文档核对均为 `git show <commit>:<path>` 后 grep 或读 ≤25 行。

**跳过 / 未做。** 未起 5193 / 8790 服务，页面整页未截图；frontmatter 来源区只 grep 单行（第 42 行）和计数，未整段读；未重审整页（第 1 节、误解、怎么开、报错表只为核对改动处读过）；未重跑 `wiki:diagrams --check`。

**修订补充（10-02，按复审）。** 复审 P2-1 属实（对照 `vllm@0fc695fc:vllm/config/compilation.py#L1354-L1360`、`#L1372-L1396` 复核）：报错条件已写准——「完全不支持」+ 混合批整趟图才启动报错，只给 decode 要整趟图的是降级加 warning；L152 降级链同步补上这一分支。复审 P3-1 已加括注（调用顺序与设计文档的调和见版本差异）；P3-2 两条箭头汇到外框左边中部并重生成。另更正修订记录 P2-1 的说法：「时间对比」点名出自本批派活消息的补充说明，不是队列行，队列行写的直觉图是档位补齐（已按派活消息执行并由首审记一笔）。三项检查重跑：lint / diagrams --check / audit 本页均 0 报错，checkStandard problems 为空。
