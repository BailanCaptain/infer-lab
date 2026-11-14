# Mooncake connector 独立审查

日期：2026-11-10。审查者为本轮独立审查 Agent；未参与首次正文修订。本文记录首次发现、写手修订后的实际复审及未完成的验收，不以写手的 sources 判断表代替独立结论。

## 范围与证据

- 已读本仓库 `AGENTS.md`、`docs/wiki-writing-standard.md`、`wiki/AGENTS-GUIDE.md`。
- 已完整读 `wiki/concepts/mooncake-connector.md` 及其实际引用的三个图规格：`mooncake-connector.yaml`、`mooncake-connector-hooks.yaml`、`mooncake-layerwise.yaml`。
- 对比 `.tmp/continuation-500-2026-11-10/before.zip` 中原页和三个原图；首次审查时三图规格逐行相同。正文对比检查结论、数字、前提、误解、待核与链接的去向，而非只比较数字集合。
- 读取冻结来源清单及与本次重点结论有关的实际摘录，并用 `git show <固定提交>:<文件>` 补读 TP 头复制、逐层发送、窗口清理、rc2 注册/Hybrid/池指南等原始范围。没有把读取清单或关键词命中视为读完全部上游文件。
- rc2 的补读摘录保存在 `.tmp/continuation-500-2026-11-10/mooncake-independent-supplement.txt`；其中包括注册表、V1 释放与角色分支、V2 worker/metadata、池逐层指南。该文件是原文摘录，不是新的事实来源。
- 未做浏览器实际阅读、NPU 启动、双机传输、故障注入或性能测试；本报告不声称视觉验收或端到端可用。外链未另行联网验证，固定 Git 来源按本地对象读取。

## 首次发现与修订复审

| 编号 | 级别 | 首次位置 | 问题与影响 | 状态 |
|---|---|---|---|---|
| M1 | P1 | 原 L267、L280、L450，TP 异构与 Layerwise 额外开销 | 用裸 TP 比当需要拼接的不同 KV 头份数；TP 超过 KV 头数时存在复制，因而可错误预测重排通信、流和缓冲 | 已实际复审修订，关闭 |
| M2 | P1 | 原 L217，第一屏代价 | 把所有端口/传输故障概括为一直押块到超时；实际失败分支仍发送完成信号，释放不都要等待 480 秒 | 已实际复审修订，关闭 |
| M3 | P2 | 原 L396，押块比例 | 把 decode 120–121 块直接当成同长度 prompt 的 P 交接块数，且 1,577 块预算不证明长 prompt 满足准入与 chunk 瞬时需求 | 已实际复审修订，关闭 |
| M4 | P2 | 原 L460–468，版本表及 verified | rc2 只在表前有概括，表内注册、V1、V2 PCP、Hybrid、池逐层各项均无 rc2 列；无法逐项比较，且遗漏 Hybrid 消费者 PCP 的新拒绝条件 | 已实际复审版本表、metadata 直接来源及新增来源映射，关闭 |
| M5 | P2 | `mooncake-layerwise.yaml` L3 | 图注称“默认的 V1”，正文明确 V1 不是启动默认值 | 已实际复审 YAML，关闭；SVG 生成和视觉验收由写手执行 |
| M6 | P2 | 原 L451，“别开的情形” | “两边 TP 不成整数倍时不能开”漏非 MLA 条件，和同页正文/启动检查范围冲突 | 已实际复审修订，关闭 |

### M1：头复制必须先于 TP 比例

原始依据：

- `vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L210-L237`：`pd_tp_ratio` 与 `pd_head_ratio` 是不同值；L231–234 先计算复制数，再把 P、D 的 TP 分别截到总 KV 头数，计算实际头数比。
- `.../mooncake_layerwise_connector.py#L1190-L1194`：只有头数比大于 1，或量化路径需要，才创建重排流。
- 同文件 L1727–1782：实际交换分支还要求相应注意力规格与待传块；交换参数使用 `pd_head_ratio`。

稳定反例：总 KV 头为 8、P TP16、D TP8，裸 TP 比是 2，但两端每卡实际各 1 个 KV 头，`min(16,8)/min(8,8)=1`。没有量化等其他条件时，不会因此启动两份不同 KV 的交换。

写手已将正文改为先比较实际 KV 头，保留原 8 头/TP4/TP2 算例，并增加 TP16/TP8 的复制反例；源码区区分建流条件、量化条件与实际交换条件。复审实际读取修订后的 L267–282、L452，和上述代码一致。该 P1 关闭。

### M2：失败也会尝试通知，不能一律等超时

`vllm-ascend@db701c1f:.../mooncake_connector.py#L727-L755` 在 `finally` 中处理任务完成，并在 L751、L755 发送释放/接收完成信号；注释明确要求无论成功失败都尝试完成通知。因此原 L217 与原 L292 本页自身相矛盾。

建议表述为：故障会阻断交接；若完成或失败通知无法送达 P，源块才继续保留，靠押块超时回收。传输超时与源块保留超时仍须区分。缺设备日志时不应宣称完成通知一定送达。

写手已将 L217 改为“V1 读取失败后仍会通知 P 清理；若完成或失败通知无法送达，P 的源块才会继续押到超时回收”。实际重读后，故障、通知和押块超时的条件与源码一致，M2 关闭。同期重读 L453，非 MLA 条件已补回；时间图 YAML L3 已改为“本页基线 V1”，M6、M5 的文本问题关闭。

### M3：占比数正确，阶段与可运行前提原先不足

算术核对：120/1,577=7.609%，121/1,577=7.673%，均约 1/13；这不证明该 P 运行时实际保留 120–121 块。

- `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2111-L2118` 在交给 connector 之前，按最终 `num_computed_tokens` 先回收窗口外块，再拿块表。
- 同仓库 `single_type_kv_cache_manager.py#L448-L477` 以已算位置数计算跳过块；因此不能把一次 decode 分配时的尾状态 3–4 块直接搬到 P 结束后的状态。
- 本站块分配页 L240–257、L316 解释长 prompt 的尾状态按本步新 token 临时增长；8192 token chunk 对应约 2050 块的准入上限，超过假设的 1,577。实际准入还要核 chunk 与其他组，而非拿存量占比证明可运行。
- `vllm@0fc695fc:vllm/config/scheduler.py#L140` 的 `scheduler_reserve_full_isl=True`，调度器 L770 将该开关交入准入判断。

写手已保留旧 decode 数字及主线链接，但将 1/13 明确写成“实际仍保留 120–121 块”的条件示意；预算遗漏项、窗口清理、长 prompt 准入与 chunk 瞬时需求均已说明。复审修订后的 L396–398，P2 关闭。

### M4：rc2 每项应补的证据与边界

rc2 唯一钉点为 `wiki/seeds/vllm-ascend.yaml` 中的 `7d825229c77025cfb185a010c25819c1214b9450`，不能把旧 main 或 v0.30.0 正式版代替它。

| 表项 | rc2 可写结论 | 原始范围 |
|---|---|---|
| 注册 | V1、Hybrid、Layerwise、V2/Pull 共存，另有 `MooncakeD2RHConnectorV1`、`SfaRemoteD2HConnector` | `__init__.py` L45–89、L131–135 |
| V1 主流程 | 仍按 producer 字符串建发送线程，其余建接收线程；只有 consumer 上报接收完成，P 延迟释放；另新增远端 prefill 在准入前被拒绝时安排空接收以通知 P 释放的路径 | `mooncake_connector.py` L2007–2054、L2710–2767 |
| V2 PCP | 不再有旧 main 的 PCP=1 入口断言；worker 端口包含 DP/PP/PCP/TP，scheduler 控制端口排在 worker 整段端口之后；单一角色要求仍在 | `mooncake/base_worker.py` L72–114；`base_scheduler.py` L42–90 |
| V2 metadata | PP 元数据包含按 PCP rank 的字典，再按 TP rank 取 worker 地址；是实际结构，不只是配置里多了字段 | `mooncake/metadata.py` L87–122；`pull_worker.py` L255–263、L951 |
| V2 块裁剪 | 环形组保留状态页，Mamba 去草稿尾，普通组按自身逻辑块和相应 DCP 裁剪，SWA 不使用 DCP 放大 | `mooncake/base_scheduler.py` L115–154 |
| Hybrid 限制/端口 | 仍要求 DCP=1，PP 与 PCP 不同时大于 1；新增 consumer PCP>1 时立即 `ValueError`；端口基址仍乘 PCP，设备偏移按 PP/PCP/TP | `mooncake_hybrid_connector.py` L1327–1345、L1662–1683、L1723–1732 |
| 池逐层指南 | 使用 AscendStore + Mooncake + use_layerwise；要求 range/session 客户端接口；文档明确真实 NPU、Master/Metadata 与多 TP 端到端尚未完成 | `mooncake_layerwise_adaptation_and_optimization.md` L1–17、L166–202 |

`mooncake/connector.py` L233–265 同时确认 Pull 类、普通 Push 占位类和兼容别名。不能由普通 Push 占位推出独立 Layerwise 不可用。

最后文本复审已实际读取修订后的页面版本表（最终 L475–483）：rc2 独立列与上表证据一致，注册、V1 准入前拒绝释放、V2 PCP/控制端口、Hybrid 消费者 PCP 拒绝和池指南的未实测边界均已写入。`verified` 已增加 rc2，`updated` 已为 2026-11-10。随后再次实际核对最终 sources：第 77 条已加入 `7d825229:mooncake/metadata.py#L87-L122`，页末 L506 已把来源 66–74、77、60–62、75–76 映射回各自结论。metadata 类型结构不再只靠 worker 端口计算作证，M4 关闭。

## 特别核验结论

1. **每组段数累加正确。** 原来“数遍全部层再乘组数”已改为按各组的层、缓存份数与连续块段分别求和。`mooncake_connector.py` L826–938 的嵌套循环确实如此；混合状态分支另取专门的两段/分头路径。
2. **MLA 单份读取只限 TP 维度。** 新文保留 TP 组内复制，同时说明 CP/PP 仍可能拆到多个远端 rank，不再概括成永远只读一张 P 卡。
3. **full 组 8,355,840 B 不应因 KDA padding 而删除。** 在完整 640 位置逻辑块被正确映射为所有 kernel 块、双方布局一致的假设下，12×(640×512×2 + 160×128×2)=8,355,840 B；8 卡共 66,846,720 B。主 MLA 真实页与完整物理页不同会被 worker L4508–4518 拒绝；L4520–4528 把完整逻辑页拆为 kernel 块。indexer 的压缩页和 KDA 的补齐状态是不同对象，不能混算。此数不是本钉点一次成功实传的日志；本页仍保留 remote block_size=4 与长 prompt 少传的阻碍，条件必须留在算例旁。
4. **KDA 只搬有效状态。** `mooncake_connector.py` L2373–2377 分别记录张量形状字节数与 stride；L1141–1155 的等 TP 分支用两段实际长度。34×(36,864+524,288)=19,079,168 B，原每层 561,152 B 与补齐页 655,360 B 的区别正确。异 TP 分支 L1157–1194 会细分卷积行/头，不能推广成所有配置永远两段。
5. **逐层收益改为条件成立。** 3 层、每层算 1/传 0.5 的示意得到 4.5 与 3.5；这种串行传输可藏进后续计算的条件不能当成任何实际负载都省 1 单位。正文已经限定速度、布局和同步开销。
6. **256 的证据补齐。** `utils/utils.py#L14` 实际是 `MAX_HCCL_REGISTER_REGIONS = 256`。来源 26 只有检查，不单独证明常量值；新增来源 65 有必要。
7. **main Hybrid 端口的尾行已核。** 原来源 51 截至 L1723，补读 `baa023ad:.../mooncake_hybrid_connector.py#L1724` 是 `self.handshake_port = self.side_channel_port + device_index`，支持“基址加每卡偏移”。最后复审已看到页面 source 51 范围扩到 L1724。
8. **Ascend 未覆盖 pending push hook 已核。** 分别执行 `git -C tools/repos/vllm-ascend grep -n has_pending_push_work 2ed6cbba -- vllm_ascend` 与 `baa023ad`，均 exit 1、零输出、stderr 空。上游 `vllm@568afb3a:.../base.py#L577-L587` 默认 False，scheduler L2313–2324 用它决定继续步进；只证明这两个固定 Ascend 树无静态覆盖，不证明逐层后台队列一定排空。
9. **D2RH 保留的两跳边界正确。** 来源 64 L65–95 明确首跳完成可释放 P 源块，D 必须等 H2D 完成才计算，主机命中不等于设备命中，主机缓冲须等所有 H2D 读取完成才复用。本轮没有将它套回 A2 的旧 V1 基线。

## 不丢信息与教学检查

对照 before.zip，以下原有内容均在实际新版中保留，或由有证据的条件修订替代：调度/worker 两半接口；P/D 先后次序；地址簿与 stride/有效字节区别；连续块并段条件；TP4/TP2 例子；MLA/递推状态/Hybrid 区别；源块延期与失败通知；33 秒/480 秒两种超时；抢占仅运行队列；Layerwise 全部层到齐；Pool 与点对点逐层区别；kv_both 分支差异；V2/Pull/普通 Push；D2RH 两跳；官方 GLM 未开；8 对卡/5 组；R1 与 KDA 数字；120–121 与 1,577 的原数值；报错清单；原待核项。源51/52的补证没有被写成新的设备验证。

文字层面的前两屏可复述为：连接器把两端本地块号对齐并换为显存地址，由后台线程读写状态，再通过完成通知让 D 继续、让 V1 的 P 还块；代价是两边暂时占块、登记/后台线程、传输和失败处理。初学者能辨认“登记不等于传到”“块号不是跨实例统一地址”。M2 的故障释放过度概括已修正，此处文本教学检查通过；实际桌面前两屏布局仍未验收。

三个图规格均宽 900px；hook 图包含主线站点、两类进程、V1 空操作与 Layerwise 分支；时间图的示意数与 calc 相同。没有用“图未变”代替看规格，但没有打开 SVG/浏览器，因此图形可读性、遮挡与实际交互链接尚未验收。图注默认值矛盾记为 M5。

首次独审时静态统计口径为：教学正文（frontmatter 后、对照源码前）去空白 11,044 字符，含 Markdown 标记；calc 4 块，行内代码 0，证据角标 0。首图前 calc 0；数字匹配只有 V1 名称中的 1，没有部署字节算例。修订后字符数会变化，此值不冒充最后一次审计输出。源码区五个 H3 顺序符合标准；27 个本地 Markdown 链接用文件存在及标题 slug 检查未发现缺失，不代替浏览器点击。

最后文本复核按同一自定义口径得教学正文 11,075 个非空白字符、4 个 calc、0 处行内代码、0 处正文证据角标；全页显式证据角标 28 处，其中 C 级 22 处。28 个本地 Markdown 链接静态检查无缺失文件或标题 slug。该统计不是项目 audit 的字数口径或浏览器验收。

## 仍须保留的待核与交付限制

- **Layerwise 最后一层的同步未证明。** `db701c1f:.../mooncake_layerwise_connector.py#L785-L787` 的 `wait_for_save` 是 `pass`；请求结束接口返回 `False, None`。发送线程等事件后 `batch_transfer_sync_write`，最后层回调，仅证明后台线程自身的先后，不证明 P 调度器复用源块之前已经等到后台最后一次写完。正文待核必须保留，不能用基类接口注释、函数名中的 sync 或 has_pending_push_work 默认实现代替证明。
- GLM KDA 的实际逐层 hook 接入、登记段数、端口连通性、错误日志、模型/量化/MTP/图模式整体验证均仍缺设备证据。
- 本 Agent 未运行整库 audit/lint/build，也未做浏览器验收。写手应在最终修订后执行项目要求检查；本报告只主张实际已完成的文本、图规格、固定源码与算术核对。

最终文本审查结论：M1、M2 两项 P1 均已在修订后独立复审关闭；M3–M6 四项 P2 的文本和来源问题也已关闭。已发现的问题中没有未关闭的 P1/P2。此结论只覆盖上述实际文本、图规格、固定源码及算术复核；浏览器、生成图与最终项目检查仍由写手另行完成，Layerwise 同步及设备能力等原待核项继续保留。
