# eplb 审查记录

## P5 写作记录（2026-09-29，第 14 批，Opus 写手）

### 改了什么

- 按新讲法整页深改：是什么（循环直觉图）→ 为什么需要 → 怎么算（峰均比 calc）→ 副本（位置整除、平分估计 vs 按来源卡固定挑副本）→ 两张表（示意物理号表 + 走一遍）→ 一轮三段（计数器 calc）→ 代价（示意显存 calc）→ GLM 双机（未启用；理想均分链接 C/E；开启条件与估算变体）→ 常见误解 → 对照源码五个 H3。
- 贯穿例子：两张卡、四个专家。窗口 1 [8,8,2,2]（保留 p4 版的对调 E1/E2 算例），窗口 2 [12,4,2,2] 引出「单专家超过平均，换位置压不下去」，再用 2 个副本位演示规划估计 10:10 与实际 12:8。
- 正文字符：p4 版正文 1,863 字符 → 现 15,599 字符（audit 口径，含对照源码）；教学正文行内代码 0，calc 5 个（每节 ≤1），免责句 1.9%，对照源码之上角标 0，全页角标 29（C 22 个，占 76%）。
- frontmatter：title、summary、updated 改；sources 从 9 条增到 34 条（C10–C30、S1–S4），原 C1–C9 顺序不动。
- 模型讲法：moe、expert-parallel、collective-communication、matmul-and-weights 只一句话 + 链接，没有重讲路由、dispatch/combine。

### 图

- `eplb-cycle`（首图，直觉图）：四格循环 ① 数 → ② 算 → ③ 搬（接收区 + 交叉箭头）→ ④ 再数（流量变了，回到 ①），每格两张卡的专家块 + 负载条。借参考 AMD 图的「状态写在卡上」手法，卡框标签直接写合计。
- `eplb`（副本一节）：三栏成对对照，骨架相同，只改专家行：只换位置 14:6 / 加副本规划估计 10:10 / 实际 12:8。借 AMD -06/-07、-09/-10 的「同一骨架只改一行」。
- 两张图宽 900，图上文字各 ≤8 段，无代码名；pnpm wiki:diagrams 无本页告警。没有新增分镜动图（09-29 暂停）。

### 数字出处

- GLM：288 个路由专家、EP16、每卡 18 个、每专家 int8 24 MiB、43 层放路由专家（含 MTP）取自 D 页「每张卡上放了什么」；场景 M 96,768 对 / 336 / 6,048、纯 decode 608 对 / 38 行取自 02 底稿 §8.6（经 C 页、E 页链接，不重算）。
- max_num_seqs 32、decode 每请求 4 token 取自 D 页参数表与 01 底稿（`max_num_seqs=32 × 4`）。
- 推导（[D]）：冗余只能取 16 的倍数；取 16 时 304 位 / 每卡 19；副本 43×24=1,032 MiB、接收区 19×24=456 MiB、合计 1,488 MiB；只换位置接收区 18×24=432 MiB；一轮 600+50+43=693（MTP 未登记则 692）；PD 门槛 32×4=128；v0.23 式与 v0.26 式起始摆法的 GLM 例子。均标「估算、未实测」。
- 示意数全部标「数为示意」；没有 GLM 的峰均比、迁移耗时或收益数字。

### 核心概念对照了什么

- 默认值与校验（600/50/0/2/all、环境变量 assert、json 校验）：db701c1f、2c59ff10、2ed6cbba、baa023ad 的 `ascend_config.py` 四版逐一 grep。
- 峰均比 = 每层各卡负载 max/mean，副本按份数平分热度：db701c1f `eplb_worker.py#L303-L316`；日志为 info 级。
- 位置整除、起始摆法、未开时只返回连续映射、冗余只在动态或映射文件时生效：`eplb_utils.py#L46-L107`；v0.26/main 起始摆法改为 vLLM 物理顺序（2ed6cbba、baa023ad 同段）。
- 物理号 = 本地槽 + rank × 每卡槽数、挑副本公式（tp>1 时掺专家号）：`eplb_utils.py#L110-L136`；单元测试 8 专家/2 卡/5 槽期望值 `tests/ut/eplb/core/a2/test_eplb_utils.py#L79-L88` 逐项手算核对。
- 路由编号经第二张表换成物理号再 dispatch：`moe_comm_method.py#L140-L143`。
- 三段计数器（第 599 步末 all-gather + 唤醒、第 649 步阻塞取回、之后每步一层、满一轮清零；记录模式不换表只导出）：`eplb_updator.py#L79-L153`。
- 搬运：forward_before 发 batch_isend_irecv，forward_end 先 wait，再换 expert_map、log2phy，最后写权重：`eplb_device_transfer_loader.py#L46-L138`（写作中据此改正了「先写权重再换表」的顺序）。
- 接收区按第一层本卡位置数、每种量化键一套；(W8A8, False) 要搬 w13/w2 + 两个 scale；W4A8MXFP 拒绝：`vllm_adaptor.py#L28-L146`。
- 通信组 `dynamic_eplb` 与 MC2 同 rank 集合：`parallel_state.py#L84-L102`。
- runner 接线只看昇腾 dynamic_eplb、PD 门槛 = max_num_reqs × uniform_decode_query_len、dummy run 也调 forward_before/end：`model_runner_v1.py`。
- 本部署未启用：官方 GLM5.3-Flash 双机教程（0576b647）grep 无 eplb / additional-config / DYNAMIC_EPLB；与 E 页逐项核对一致。
- 输出不变的验证：`tests/e2e/pull_request/two_card/test_qwen3_moe_eplb.py`（Qwen3-30B-A3B-W8A8、TP2+EP、冗余 2、100/20 步、400 token 贪心逐字相等）。
- 官方文档：2c59ff10 与 baa023ad 的 `expert_parallelism_load_balancer.md`（不建议场景、A2 不支持冗余、每 die 专家数前后相反、静态计划在 v0.25.1 移除、环境要求）。

### 旧版信息清单勾选（清单在 scratchpad p5/eplb-facts.md）

A = p4 版（GLM 快照口径），B = 59893fa 重写前版（Qwen3.6 例子）。

- A1–A2 ✓ 是什么/为什么；A3 ✓ [8,8,2,2] 对调算例保留为窗口 1；A4 ✓ 配对口径；A5 ✓ 时效；A6 ✓ 两张表；A7 ✓ 冗余与挑副本规则；A8 ✓ 常见误解（逐位相同不保证）；A9 ✓ 源码位置「数配对的细节」（累加形式先差分）；A10–A12 ✓ 一轮三段；A13–A14 ✓ 代价；A15 ✓ 对照源码开头链接来源基线；A16 ✓ 怎么开表格与整除；A17 ✓ 量化组合与 W4A8MXFP；A18 ✓ EP≠EPLB、组合未验证。
- B1–B4 ✓；B5–B6 ✓（600/50/每层一步，只数个数）；B7 ✓ 单独通信组（补了「物理链路相同」）；B8–B10 ✓；B11 ✓；B12 ✓ 官方不建议场景与环境要求（10 Gbps、shm、NPU 一致）；B13 ✓ 常见误解三条都在，另加三条；B14 ✓ 配置表；B15 ✓；B16 ✓（moe_load、all-gather、峰均比日志、FlashLB 环形数组）；B17 ✓；B18 ✓ 子进程与守护进程 patch（链接 engine-processes、ascend-patch-system）；B19 ✓ 静态映射与记录模式（更正：记录模式不换到卡上、每轮结束导出）；B20 ✓ 报错清单（新增上游冗余数校验一条）；B21 ✓ 版本差异表（起始摆法、MRv2、force 开关、A2 冗余、每 die 条件）；B23 ✓ 源码位置表与 8 专家测试期望值。
- 删除/未搬：B22「main 设计文档模块树对不上代码」未保留——本批没有重新核 baa023ad 的 model_runner_v1_eplb.md，不能沿用旧结论；Qwen3.6 例子的数字（650/350、6 MiB、690 步、240/774 MiB）随例子一起换成 GLM 与示意数，不适用本部署。
- 补正：旧 B 版只说记录模式「每轮导出摆法」，现按 updator 补上「照常数和算、但不换到卡上」；旧 A 版「传输完成后更新映射、逻辑到物理关系与本地权重」的顺序按 loader 代码写明为先换两张表、再写权重。

### 参考图库

看了 refs/INDEX.md、HOW-THEY-TEACH.md 第 4 节与「可借做法」，Read 了 amd-10-hi.png（DP=8+EP 图：专家行 Exp 0-31… 静态放置、dispatch/combine 两条箭头）。借了两点：状态直接写在卡上；成对对照图同一骨架只改专家行。没有照搬 AMD 的虚线箭头画法和配色。

### 验证

- `pnpm wiki:lint`：本页 0 条；当前失败项全是并行写手的 kv-pool 页（summary 超长、relations 指向不存在的 kv-pool）以及一度缺 kv-pool-intuition.svg，与本页无关。
- `pnpm wiki:diagrams --check`：250 张图与 spec 一致；本页两图无告警。
- `pnpm wiki:audit`：本页 34 条来源全部行号有效；整体失败 1 处为 kv-pool.md 的 summary。
- 本页不在 standard-pages.json 名单里，另用 scratchpad 脚本按名单规则单测本页：行内代码 0/千字、角标 0（对照源码之上）、calc 5、相邻块 0、免责 1.9%，problems 为空。
- 未截图、未起服务（按派发说明由审查环节做浏览器验收）。

### 自查疑点

- 「A2 的一张卡是一个 die」用于对照文档的每 die 条件，没有在仓库内找到硬件手册出处，审查时请核。
- 规划器「按平分估计副本负载」取自评估函数 `_compute_imbalance`；各策略内部是否都按平分排，未逐个读策略代码。
- MTP 层是否登记进 EPLB（692 或 693 步）、空闲 DP 组空批次的补位行是否计入热度，都列为页末待核。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，只审不改页面）。对象：`wiki/concepts/eplb.md` 工作区版本（未提交）。

**分数：8.0 / 10**（P1 1 条、P2 3 条、P3 8 条）

### 结论速览

- **学习顺序：通过。** 是什么（循环直觉图，L55–74）→ 为什么需要（L76–86，含代价预告）→ 怎么算（峰均比 calc，L88–110）→ 副本 → 两张表 → 一轮三段 → 代价 → GLM 双机（L205）→ 常见误解 → 对照源码。GLM 数字在 L205 之前没有出现；第一屏是问题式 H2 + 加粗定义 + 直觉图（截图 `scratchpad/eplb-review-first.png`）。
- **初学者测试（只读前两屏）：** 「EPLB 在推理时数每个专家接了多少活，把热门专家挪到闲的卡或多放一份，让各卡差不多忙；因为 MoE 每层都要等最忙的卡。代价是副本和接收区占显存、搬权重占链路还要等、热点变得太快就追不上。」能说清，通过。
- **audit：本页通过。** `pnpm wiki:audit`：本页 34 条来源，30 条仓库行号全部有效，4 条 URL 未联网；整体 `ok`。`pnpm wiki:lint` 通过，本页 0 条；`pnpm wiki:diagrams --check` 254 张一致；全库没有别的页嵌入 eplb / eplb-cycle 两张图，也没有指向本页锚点的入链。
- **注水与重复：** 正文约 1.56 万字符，没有发现空话填充；免责句约 1.9%；moe、expert-parallel、collective-communication 都只一句话 + 链接，没有重讲路由、dispatch/combine。有轻度重复，见 P3-6。
- **参考图库对照（AMD）：** 看了 refs/INDEX.md 的 amd 条目和本页两张图。AMD 的图是「每列一张卡、每层一条横带、层间虚线集合通信箭头」的骨架；本页两图是「卡框 + 专家块 + 负载条」，只借了「状态写在卡上」「同一骨架只改一行对照」两个讲法，配色、箭头、版式都不同，**不算照抄**。没有新加分镜动图。
- **口径一致：** 与 E（expert-parallel）的「本部署未开 EPLB」逐项核对表（E L461–511）、C 页和 02 §8.6 的理想均分数一致；与 large-scale-ep（L93 链到本页）说法一致。跨页不一致见文末「跨页口径」，不计入本页分数。

### 「设计文档与代码对不上」（旧版 B22）核实结论：对不上，应保留并补出处

在四个钉住版本上 grep 核实，设计文档写到的三样东西，代码里都没有：

| 设计文档里写的 | 文档位置 | 代码实际 |
| --- | --- | --- |
| 模块树里的 `vllm_ascend/eplb/utils.py`；「新增 MoE 模型」一节让人扩展这个文件 | main：`docs/source/developer_guide/Design_Documents/model_runner_v1_eplb.md` L38、L77、L156（baa023ad）；v0.23 / v0.26：同内容在 `eplb_swift_balancer.md` L36、L75、L154（2c59ff10、2ed6cbba） | 2c59ff10、db701c1f、2ed6cbba、baa023ad 四版 `vllm_ascend/eplb/` 下都没有 `utils.py`（`git ls-tree` 核过；main 实际只有 adaptor/vllm_adaptor.py、core/ 下 loader、eplb_utils、worker、policy/，以及 eplb_updator.py） |
| 在 `vllm_adaptor.py` 的 `model_register` 函数里登记新模型的参数 | main L136、L148、L160；v0.23/v0.26 L134、L146、L158 | 四版 `vllm_ascend/` 全库 grep 不到 `model_register`；实际做法是 AscendFusedMoE 建层时调用 `VllmEplbAdaptor.register_layer(self)`（db701c1f `vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L306-L310`、`fused_moe.py#L455-L458`） |
| DFX 一节的参数校验示例 `check_iterations`（`<= 0` 报错）、`check_expert_map_path` | main L184–L201；v0.23/v0.26 L182–L199 | 四版都没有这两个函数；校验写在 `ascend_config.py` 里：`baa023ad:vllm_ascend/ascend_config.py#L200-L218`（pydantic after 校验器），`2c59ff10` L878–L882、`db701c1f` L862、`2ed6cbba` L923。实际只拒绝 `< 0`，**0 能通过**，和文档示例「必须大于 0」不一致；报错文本也不同（代码是 `The expert_map is not exist.`） |

建议写法：在「版本差异」或「源码位置」加一行，说明三版设计文档（v0.23/v0.26 叫 eplb_swift_balancer.md，main 叫 model_runner_v1_eplb.md）的模块树、`model_register`、DFX 示例函数在代码里都不存在，新模型接入以 `register_layer` 为准，间隔参数实际允许 0；附上表中出处。写手记录里「本批没有重新核，不沿用」的处理当时是对的，现在已核实，应恢复。

### P1

1. **丢信息：旧版 B22（设计文档与代码对不上）被删，经核实仍然成立。** 位置：对照源码（现无对应内容）。影响：读者或问答照设计文档去找 `utils.py` / `model_register` 会扑空；文档说间隔必须大于 0，代码允许 0。改法：按上一节的表补一行 + 出处（1–2 句即可）。

### P2

1. **两张图的负载条数字被截断。** 位置：`eplb-cycle`（首图）① 卡 1 的两段「2」挤在一起，② ④ 右端的「2」只露半个；`eplb` 三栏里所有「2」段同样被切（截图 `scratchpad/eplb-review-fig1.png`、`eplb-review-fig2.png`，1440 宽实测）。影响：首屏直觉图看起来粗糙，小数值读不出。改法：spec 里给负载条设最小段宽，或把小段的数字标在条外 / 条尾；能只改 spec 就不动渲染器。
2. **L217 场景 M 的 96,768 对没说「含补位」。** 02 L923 写明 12,096 行含 padding，E 页 L460 也写了「同时包含真实请求与补位」；本页只说「一步 MoE 要处理 96,768 个配对」。在 EPLB 语境里这很关键：DP1 那 6,048 行里真 token 只有 28 个，补位行会不会被数进热度正是 L257 的待核项。改法：L217 补「（含空闲组的补位行）」，并和 L257 的待核互相指一下。
3. **「第一张表 / 第二张表」全页没有对上源码名 `expert_map` / `log2phy`。** 位置：对照源码「源码位置」L342–L343 只给了文件和函数名；frontmatter 别名有 log2phy，但正文从没说哪张表叫 log2phy。旧版 B8 有这层对应。影响：问答搜「log2phy 是什么」命中本页却找不到对应解释。改法：在源码位置表或 L355 那段加一句「第一张表 = `expert_map`（逻辑号→本卡第几格，不在记 -1），第二张表 = `log2phy`（逻辑号→物理号）」。

### P3

1. 首图 ① 的图注「峰均比 16 ÷ 10 = 1.6」在 L90 定义峰均比之前出现（术语先用后讲）。改成「最忙 16 ÷ 平均 10 = 1.6」或在 L67 顺带一句。
2. L82 把「router 带校正偏置」写成 MoE 训练压平负载的通用做法；moe 页 L214 讲的是两类（辅助损失 / 校正偏置）。改成「像 GLM 这类模型，router 带一个校正偏置……」。
3. 写手自查疑点「A2 的一张卡是一个 die」：**说法正确**，出处可用 `vllm-ascend@baa023ad:docs/source/tutorials/models/DeepSeek-V4-Flash-Vision.md#L117`（A2 每台 8 个 NPU die，对应 davinci0–7）；对照 A3 每个 NPU 两个 die 见同仓 `docs/source/tutorials/models/Qwen3-30B-A3B.md#L510`。建议在 L255 或对照源码补出处。
4. L227「int8 上投影、下投影两块权重」：搬的是 `w13`（gate 与 up 合并的一块）和 `w2`（down），外加 `w13` 的 fp32 scale 与 `w2` 的 scale（db701c1f `vllm_adaptor.py#L31-L36`）。「上投影」不准确，改成「gate/up 合并块和下投影块」。
5. L114「冗余专家」首次出现没带英文原名 redundant experts（官方参数名 `num_redundant_experts`、文档用词）。按术语规则补英文。
6. 轻度重复：代价在 L84 预告、L185 加粗再说、L197–L201 细讲，三处措辞相近；L166 的「步末等传完」在 L197、L265 又各说一遍。可把 L84 压成一句指向代价一节。
7. 旧版 B18 的「两条队列 + 共享字典」（planner_q 唤醒、block_update_q 取回、shared_dict 放 moe_load / expert_maps）标识符全页没有，语义（唤醒后台、一次取回全部层）还在。写手勾 ✓ 略宽；可在源码位置补一句。
8. `eplb` 图第三栏把卡 1 的两份写成「E0 副本」「E1 副本」，暗示有原件 / 副本之分；代码里各份完全对等（挑哪份只看卡号与专家号）。可改成「E0（第 2 份）」或加一句说明，非必须。

### 核心概念逐条核对（db701c1f，除注明外）

- 峰均比 = 每层各卡负载 max ÷ mean，副本按份数平分热度：`eplb_worker.py#L303-L316` ✓；默认策略 SwiftBalancer 也按份数平分（`core/policy/policy_swift_balancer.py` L123 `cur_experts_load / num_per_expert`）。**写手疑点「规划器按平分估计」对默认策略成立**。新旧摆法的均值 / 最大值打 info 日志（L79–L94）✓。
- 计数器：`eplb_updator.py#L79-L143`。第 599 步 forward_end all-gather + 唤醒（`wakeup_eplb_worker_flag` = 600−1）✓；第 649 步 forward_before 阻塞 `block_update_q.get()`（600+50−1）✓；650 起每步一层 ✓；走满 600+50+层数清零并清热度 ✓；只数一类时，采集阶段不符合的步不推进计数 ✓；记录模式不换表、每轮导出 ✓。示意 calc 654 步、GLM 693/692 步算术正确。
- 搬运顺序：`eplb_device_transfer_loader.py#L97-L138` 先 `req.wait()`，再换 expert_map、log2phy，最后从接收区 copy 权重 ✓（L166 与图 ③ 一致）。
- 起始摆法、整除报错、未开时只返回连续映射且 log2phy 为 None：`eplb_utils.py#L46-L107` ✓（L116、L213）。挑副本：`#L110-L136`，tp>1 掺专家号；GLM 调用处传的是 `parallel_config.tensor_parallel_size`（`fused_moe_0_23_0.py#L225-L232`），所以「真实部署里还掺进专家编号」对 TP8 成立 ✓。
- 两张表示意（L149–L154）按 tp=1 规则逐格手算 ✓；单元测试 8 专家 / 2 卡 / 5 槽的期望值（L355）逐项手算 ✓。
- log2phy 在 dispatch 前替换 topk_ids：`moe_comm_method.py#L140-L142` ✓。
- 接收区按第一层本卡位置数、每种量化键一套；(W8A8, False) 搬 4 个张量；W4A8MXFP 拒绝：`vllm_adaptor.py#L28-L45`、`#L86-L135` ✓。
- dynamic_eplb 通信组与 MC2 同 rank 集合、另起组名：`distributed/parallel_state.py#L84-L102` ✓。
- PD 门槛 = max_num_reqs × uniform_decode_query_len，大于门槛算 prefill：`worker/model_runner_v1.py` L552、L3706–L3715 ✓；32 × 4 = 128 与 D 页 L82 / L84 一致 ✓。dummy run 也调 forward_before 并更新采集状态（L3403–L3454）✓，L257 待核项的前提成立。
- 官方文档：A2 不支持冗余专家只在 main（baa023ad `expert_parallelism_load_balancer.md#L40`）✓；每 die 专家数 v0.23 / v0.26「≤ 8」、main「> 8」（2c59ff10 / 2ed6cbba L36，baa023ad L73）✓；1024 token、128 token、≥10 Gbps、shm ✓。

### 数字核对

- 96,768 / 336 / 6,048 / 608 / 38：与 02 L923–L925、E L452–L456 一致 ✓（缺「含补位」见 P2-2）。
- 24 MiB / 专家、43 层（42 + MTP）、每卡 18：D 页 L109、L170 ✓。
- 1,032 / 456 / 1,488 MiB ≈ 1.45 GiB / 432 MiB、304 位 / 每卡 19、冗余取 16 的倍数：逐项手算 ✓，均标「估算、未实测」。
- 示意 calc 五个（1.6 / 1.0 / 1.4 / 下限 14；3 位 / 估 10 / 实 12:8 / 1.2；654 步；40 + 30 = 70 MiB）逐项手算 ✓。
- 没有虚构 GLM 峰均比、迁移耗时或收益数字；没有把 GLM 主线数字当成 EPLB 效果 ✓。

### 旧版信息清单勾选核实

A1–A18、B1–B21、B23 抽查属实（A9 在 L353，B19 在 L297 / L311，B20 在 L305–L315，B12 在 L320，B21 在 L324–L336）。例外：B22 被删（P1-1）；B18 标识符缺（P3-7）；B8 表名缺（P2-3）。

### 跨页口径（不计入本页分数，转给对应页）

- **moe.md L295** 写「要不要按真实负载搬专家（`enable_eplb`）」。本部署走 model runner v1，真正的开关是 `DYNAMIC_EPLB` 环境变量 + 昇腾 `eplb_config.dynamic_eplb`（本页 L275、L303）；上游 `enable_eplb` 只在 v2 路径起作用。建议 moe 页改成「昇腾 EPLB（v1 看 `dynamic_eplb`）」并链到本页「怎么开」。
- **expert-parallel.md L463** 把 EPLB 展开成 expert parallel load balancing；官方文档与本页用 Expert Parallelism Load Balancer，建议统一。

### 验证记录

- 命令：`pnpm wiki:audit`（本页通过，整体 ok）、`pnpm wiki:lint`（通过，本页 0 条）、`pnpm wiki:diagrams --check`（254 张一致）。
- 浏览器：Playwright 1440×900 打开 `http://localhost:5193/#/wiki/eplb`（用户预览，未起停服务）；截图 `scratchpad/eplb-review-first.png`（第一屏）、`eplb-review-fig1.png`（循环图）、`eplb-review-fig2.png`（副本对照图）、`eplb-review-replica.png`。页面无横向滚动；控制台只有 8790 未启动导致的 502，与本页无关。
- 源码：`tools/repos/vllm-ascend` 下 `git show` / `git grep` 核对四个钉住 commit，行号见上。

### 跳过 / 未读

- frontmatter 来源清单（交 audit 校验）。
- 「对照源码」正文按规则只 grep；为核事实抽读了 L277、L305–L315（截断）、L353、L355，以及 L324–L336 的版本名计数。
- 没有核 MTP 层是否登记进 EPLB（692 / 693）、补位行是否计入热度，与写手一致留作待核。

## P5 修订记录（09-29）

逐条按审查意见处理，全部采纳（自己 grep 复核后认为审查成立）。

### P1

1. 恢复「设计文档和代码对不上」：放在对照源码「版本差异」末尾一段（源码位置之前），写明三处：`vllm_ascend/eplb/utils.py` 不存在；`model_register` 不存在，新模型接入以 `register_layer` 为准；`check_iterations` / `check_expert_map_path` 不存在，实际校验只拒绝负数、0 能通过，与文档「必须大于 0」不符。复核：四个钉住版本 `git ls-tree` 无 `eplb/utils.py`，`git grep` 无 `model_register|check_iterations|check_expert_map_path`；设计文档行号 baa023ad `model_runner_v1_eplb.md` L38/L77/L136/L148/L156/L160/L184/L201、2c59ff10 `eplb_swift_balancer.md` L36/L75/L134/L146/L154/L158/L182/L199；校验 `db701c1f ascend_config.py#L859-L862`、`2c59ff10 #L878-L882`、`2ed6cbba #L921-L925`、`baa023ad #L213-L218`（审查写的 baa023ad L200–218 是整个校验器，比较负数的是 L213–L218）；`register_layer` 在 `db701c1f fused_moe_0_23_0.py#L306-L310`。以上 5 条代码出处与 2 条设计文档 URL 加进 sources，正文只挂一个 [S5]（全页角标保持 30）。

### P2

1. 负载条数字截断：只改 spec、不动渲染器。两张图的负载条去掉段内数字（每个专家接了几对已写在专家块，合计写在卡名旁），图注说明「负载条只表示长短」。原因：渲染器把段内文字固定画在段起点 +16 px 处，值为 2 的段只有 20 px，放大比例会撑出卡框。
2. 场景 M 的 96,768 对补「按两组补齐后的 12,096 行算，含补位行」，并与「还没验证过的组合」里的补位待核互相指向。
3. 源码名对应：源码位置新增一段，第一张表 = `expert_map`（逻辑号→本卡第几格，不在记 -1），第二张表 = `log2phy`（逻辑号→物理号）；源码位置表两行也标上表名。

### P3

1. 首图 ①④ 图注改成「最忙 16 ÷ 平均 10 = 1.6」「最忙 14 ÷ 平均 10 = 1.4」，不在定义前用「峰均比」。
2. 「为什么需要」改成「有的模型训练时压平负载，一类加辅助损失，另一类让 router 带校正偏置」。
3. 「A2 一张卡一个 die」补出处：main 的 DeepSeek-V4-Flash-Vision 教程 L117（A2 每台 8 个 NPU die），A3 每 NPU 两个 die 见 Qwen3-30B-A3B 教程 L510；写进「开销和什么时候别开」，URL 进 sources。
4. 「int8 上投影、下投影」改为「gate 与 up 投影合并成的一块、down 投影一块，外加各自的 scale」。
5. 「冗余专家」首现补 redundant experts。
6. 「为什么需要」里的代价预告压成一句，指向代价一节。
7. 源码名段补两条队列 + 共享字典：`planner_q` 唤醒后台，`block_update_q`（容量 1）一次取回全部层，共享字典放 `moe_load` 与 `expert_maps`。
8. `eplb` 图第二、三栏卡 1 的「E0 副本」「E1 副本」改回「E0」「E1」，图注写明两份完全一样、没有原件和副本之分。

### 验证

- 每次保存后 `pnpm wiki:lint`：本页 0 条，最后一次整体通过。
- `pnpm wiki:diagrams --check`：256 张与 spec 一致，本页两图无告警。
- `pnpm wiki:audit`：本页 43 条来源（35 条仓库行号有效，8 条 URL 未联网），整体 ok。
- 按名单规则单测本页：行内代码 0/千字（教学正文）、对照源码之上角标 0、全页角标 30（C 22 个）、免责 2.0%、problems 为空。
- 未截图、未起服务。

## P5 复审（09-29）

复审员：Opus 5.5（独立复审，只审不改）。范围：上一轮 P1、3 条 P2 的修订，以及本轮删改。行号指 `wiki/concepts/eplb.md` 当前文件行号。

**分数：9.0 / 10**（上轮 P1 已修好；上轮 3 条 P2 全部改对；新增 P1 0 条、P2 1 条、P3 3 条）

### 上轮 P1（设计文档与代码对不上）：内容已修好，角标挂错（见新 P2-1）

- **位置：** L346，「版本差异」表和 GLM 起始摆法例子之后、「源码位置」之前。这件事四版都一样，严格说不算版本差异，但放在对照源码里、紧挨源码位置，读者找得到，可以接受。
- **三处事实逐条在源码里核过（`tools/repos/vllm-ascend`）：**
  - `git ls-tree -r` 四个 commit（2c59ff10 / db701c1f / 2ed6cbba / baa023ad）的 `vllm_ascend/eplb/` 下都只有 adaptor/vllm_adaptor.py、core/ 下 loader、eplb_utils、eplb_worker、policy/，以及 eplb_updator.py，没有 `eplb/utils.py`。✓
  - `git grep -E 'model_register|check_iterations|check_expert_map_path'`（排除 docs/）四版都没有结果。✓ `register_layer` 四版都在：2c59ff10 / db701c1f `fused_moe_0_23_0.py#L310`、`fused_moe.py#L458`；2ed6cbba `fused_moe.py#L512`；baa023ad `routed_experts.py#L520`。「新模型接入以它为准」成立。✓
  - 设计文档行号：baa023ad `model_runner_v1_eplb.md` 的 L38 / L77 / L136 / L148 / L156 / L160 / L184 / L201，2c59ff10、db701c1f、2ed6cbba 的 `eplb_swift_balancer.md` 的 L36 / L75 / L134 / L146 / L154 / L158 / L182 / L199，全部对得上。文档示例写的是 `expert_heat_collection_interval must be greater than 0`，`<= 0` 报错。✓
  - 实际校验在 `EplbConfig`（四版都是这个类），循环三个键（两段间隔 + `num_redundant_experts`），先查是不是 int，再判断 `< 0`，所以 0 能通过；报错文本四版都是 `{key} must greater than 0`。✓
- **sources 条目：** 新加的 #31–#35（register_layer、四版校验）和 #40–#41（两份设计文档 URL）都存在、路径正确；行号有两处小偏差，见 P3-1。
- **问题：正文唯一的角标 `[S5]` 指向第 5 条来源 `eplb_worker.py#L337-L410`**，和这段无关，新加的 7 条来源一条也没被角标引到。见新 P2-1。

### 上轮 3 条 P2：全部改对

1. **负载条截断：已修。** Playwright 1440 宽截图 `scratchpad/eplb-rereview-fig1.png`（循环图）、`eplb-rereview-fig3.png`（副本对照图）：段内数字去掉以后，每个专家的对数在专家块里，合计在卡名旁，没有截断或重叠；两张图的数逐个手算都对（16/4、10/10、14/6，中栏 6+2+2、右栏 12/8，峰均比 1.6 / 1.4 / 1.0 / 1.2）。第三栏卡 1 改成「E0」「E1」，图注说明两份完全一样，也对。
2. **场景 M 含补位：已修。** L226 补了「按两组补齐后的 12,096 行算，含补位行」，和 02 L922「12,096 行（含 padding）× 8 = 96,768」一致；L226 往下指「还没验证过的组合」，L266 往回指 96,768，并链到源码位置末尾的待核（L376）。✓
3. **表名对上源码名：已修。** L353–L354 源码位置表标了 `expert_map`、`log2phy`；L364 新段写清两张表的下标和值，另外补了 `planner_q`、`block_update_q`（容量 1）、共享字典 `moe_load` / `expert_maps`，在 db701c1f 里核过（`eplb_worker.py` L354–L355、`eplb_updator.py` L104 / L109 / L152 / L159）。✓

### 新 P2

1. **全页 5 个 `[S]` 角标都指错来源，`[S5]` 是本轮新加的。**
   - 位置：L288 `[S1]`、L329 `[S2]`、L331 `[S3]`、L308 `[S4]`、L346 `[S5]`。
   - 问题：渲染器按 `page.sources[idx-1]` 取来源，不分字母（`src/app/pages/WikiPage.tsx` L378–L379；`evidenceMarks.ts` 注释也写着编号指向 sources 第几条）。Playwright 读到的实际链接：S1 → `fused_moe_0_23_0.py#L513-L539`，S2 → `eplb_utils.py#L46-L107`，S3 → `eplb_utils.py#L110-L136`，S4 → `eplb_updator.py#L79-L153`，S5 → `eplb_worker.py#L337-L410`。本来想指的分别是 #36 GLM5.3-Flash 教程、#37 / #38 两版 EPLB 用户文档、#39 GLM-5 教程、#40 设计文档。根因在写作记录 L10：写手把 S 当成只在 URL 之间单独编号（「C10–C30、S1–S4」）。S1–S4 在上一轮就是这样，上一轮审查漏看了；本轮修订照同样的误解加了 S5。
   - 影响：读者点角标核对「官方教程没这样开过」「文档不建议」「设计文档对不上」这些说法，会跳到不相关的代码行，证据链断了。lint 和 audit 都不检查角标字母和来源类型对不对得上，所以没报出来。
   - 改法：改成 `[S36]`、`[S37]`（或 `[S38]`，按那句指哪版文档）、`[S38]`、`[S39]`、`[S40]`；L346 如果想直接指到代码，也可以用 `[C32]`–`[C35]` 里的一条。角标总数不变。改完用浏览器点一遍。

### 新 P3

1. 两条校验出处的行号有偏差：`db701c1f ascend_config.py#L859-L862` 没包含报错文本那一行（L863，正文引用了 must greater than 0）；`2ed6cbba #L921-L925` 差一行，应为 L920–L924（L920 是三个键的循环，L925 已经是 eplb_policy_type 的检查）。
2. L346「两段间隔和冗余数只拒绝负数，设成 0 能通过，和文档示例『必须大于 0』不一致」：冗余数默认就是 0，0 本来就合法；和文档对不上的只有两段间隔。可以改成「两段间隔设成 0 也能通过」。
3. L91「训练好的模型在推理时这些都固定不变」：辅助损失只在训练时存在，推理时根本没有，说「固定不变」不够准确。可改成「这些手段在训练结束后就定型了」。

### 本轮删改有没有丢信息

- 修订脚本 `scratchpad/eplb-fix3.py`（只改两张图）和 `eplb-fix4.py`（改正文 + sources），都是字符串替换。改后的行号偏移（frontmatter +9，L346 段 +2，L364 段 +2）和审查引用的旧行号一一对得上（L217→L226，L257→L266，L342–L343→L353–L354）。写作记录的「全页角标 29（C 22）」到修订记录的「30（C 22）」只多了 `[S5]`，没有删角标。
- 删掉的内容：P3-6 压缩掉的三样代价在代价一节 L194 的加粗句和后面几段里都还在；负载条段内的数字挪到了专家块和卡名旁（截图核过）；「E0 副本」改名，没有丢事实。**没有丢信息。**

### 验证记录

- `pnpm wiki:audit`：本页 43 条来源，35 条仓库行号全部有效，8 条 URL 未联网，没有越界或文件不存在；整体 `ok`。**本页通过。**
- `pnpm wiki:lint`：通过，本页 0 条。`pnpm wiki:diagrams --check`：257 张与 spec 一致，没有 eplb 两张图的告警。
- 浏览器：Playwright 1440×900 打开 `http://localhost:5193/#/wiki/eplb`（用户已经开着的预览，没有起停服务），用脚本 `scratchpad/eplb-rereview.cjs` 读出 5 个 S 角标的链接，截了 `eplb-rereview-fig1.png`、`eplb-rereview-fig3.png`、`eplb-rereview-p1.png`；没有横向滚动，没有页面报错。
- 源码：在 `tools/repos/vllm-ascend` 下对四个钉住 commit 跑了 `git ls-tree`、`git grep`、`git show`，行号见上。

### 跳过

- 没有重审整页，只看了修订涉及的段（L85–L95、L226、L266、L333–L377）和两张图。
- frontmatter 只读了 L36–L52 和按序号抽出的第 1–5、36–43 条来源。
- S1–S4 所在句子的内容本身（官方文档说了什么）这次没有重核，只核了它们指向哪条来源。

## P5 修订记录（复审后，09-29）

- 新 P2-1 采纳：角标按 sources 的序号取来源、不分字母，原 [S1]–[S5] 全部改为按序号引用：[S1]→[S36]（GLM5.3-Flash 官方教程）、[S4]→[S39]（main 的 GLM-5 教程）、[S2]→[S37]（v0.23 的 EPLB 用户文档）、[S3]→[S38]（main 的 EPLB 用户文档）、[S5]→[S40]（main 设计文档 model_runner_v1_eplb.md）。用脚本把全页 22 个 C 角标、5 个 S 角标逐个按序号对回 sources 核过，C 角标本来就与序号一致，无需改。角标总数仍为 30（C 22、S 5、D 3），和上一轮相同。写作记录里「C10–C30、S1–S4」的说法作废，编号一律是 sources 里的第几条。
- 新 P3 三条采纳：校验出处行号改为 db701c1f `#L859-L863`、2ed6cbba `#L920-L924`；设计文档一段改成「冗余数本来就默认 0，对不上的是两段间隔」；「为什么需要」改成「这些手段在训练结束后就定型了」。
- 验证：`pnpm wiki:lint` 通过、本页 0 条；`pnpm wiki:diagrams --check` 257 张一致；`pnpm wiki:audit` 本页 35 条仓库来源全 ✓、8 条 URL 未联网，整体 ok。未开浏览器点角标（按派发说明不起服务、不截图），由复审环节点验。
