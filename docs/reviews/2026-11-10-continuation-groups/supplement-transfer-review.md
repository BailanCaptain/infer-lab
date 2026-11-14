# KV cache、外部池与 PD：49 项既有补证独立审查

审查日期：2026-11-10。审查者：`/root/groups_ucm_review`。依据：[wiki 写作标准](../../wiki-writing-standard.md)。本轮独审未修改教学页、图或产品实现；发现的问题由作者修订后重新核验。

**49 个来源出现项已逐一完成语义判断；发现的 1 项 P2 已修订并复核关闭，当前无未解决的 P1/P2/P3。** 每项的主张、固定引用、支持条件、证据和原文/摘录/当前页 SHA 见 [独立逐项账本](supplement-transfer-independent.json)。`supported_scoped` 只认证正文实际使用的限定命题，不认证整个文件、所有模型或设备运行效果。

## 范围、阅读与计数

| 页面 | 来源序号 | 项数 | 本轮处理 |
|---|---:|---:|---|
| [KV cache](../../../wiki/concepts/kv-cache.md) | 47–58 | 12 | rc2 布局/默认/分组，实际写入入口，旧 GLM 容量子账 |
| [KV Pool](../../../wiki/concepts/kv-pool.md) | 58–70 | 13 | 角色门槛、跨 TP 条件、保存栅栏、逐版本加载等待 |
| [Mooncake](../../../wiki/concepts/mooncake-connector.md) | 65–77 | 13 | 注册、准入失败清理、Hybrid 拓扑、逐层池指南、地址簿 |
| [PD 分离](../../../wiki/concepts/pd-disaggregation.md) | 74–84 | 11 | 分层元数据、V1 选块/截断/角色、矩阵与失败默认、完成池边界 |
| 合计 |  | **49** | 关闭既有补证账本，不再加到冻结 500 项 |

范围来自前批 `reconciliation-after.json` 的 `new_or_changed_outside_frozen500`。完整读取四页当前正文、版本表与证据区，并阅读前批四份独立审查、KV cache/KV Pool 保留清单及已读的总验收记录；随后逐项读取本轮 49 份固定摘录。原作者账本用于范围和差异对账，没有直接采用其语义判断。

49 项涉及 **33 个“版本＋文件”、1,450 行引用区间**，行数含重叠。本轮重读的是引用区间，不是 49 篇全文。Mooncake 来源 73/74 只读指南第 1–17、166–202 行，PD 来源 80 只读支持矩阵第 27–45 行；已有全文阅读记录只沿用作来源背景和避免重复记账。**新增首次官方全文阅读为 0，本轮也没有新增完整复读计数。**

49 项均重新从固定 Git 对象验证源文件 SHA、摘录逐行内容以及当前 frontmatter 中对应序号的引用；此机械检查只确认身份。各项支持结论由人工主张/证据工作表填写，不能从行号存在或历史验收自动推出。

作者初始账本把 KV Pool 来源 67 记作 `duplicate_same_version`；它实际是 `2c59ff10`，来源 66 是 `db701c1f`，两份摘录内容相同但提交不同。本独审分别判断版本命题为 `supported_scoped`，仍不重复记全文；已通知作者。这是账本标签区别，不是对当前教学命题的实质分歧。

## 发现、修订与复核

**P2 · Mooncake 第 417 行跨页摘要遗漏查询长度条件，已关闭。** 原句将“只加 KV Pool、不开 prefix caching”一概概括为“一次查询都不会发出”。实际旧 GLM 推演是段长 133,120，短于段长的提示词被向下取整为 0；不能把这个长度条件省略。

独审另读 `db701c1f` 的 `pool_scheduler.py` 第 491–536 行，核实整段取整和不足一段时的返回门槛；另读 `patch_mamba_config.py` 第 205–226 行，核实不启用 APC 时 Mamba 块长取模型最大长度。作者现已改为明确“段长等于最长长度 133,120；短于该长度的 prompt 向下取整为 0，不会发出查询”，保留 KV Pool 主解释链接。本轮实际查看修改后段落并点击回链，目标标题为“只加 KV Pool、不开 prefix caching：短于最长长度的 prompt 不会查询”。

本次重点复核的其他边界：

- **普通缓存写入与专用 GLM 路径分开。** KV 52–53 不能只看三行类声明就判继承成立；补读完整 `AscendAttentionBackend` 类，确认没有覆盖父类的 `forward_includes_kv_cache_update`。KV 57 是 Qwen3 DFlash 的独立更新调用例，未泛化为普通前向的第二次写入。KV 58 保留 85 MiB 状态页子账与完整物理块计费的区别。
- **保存栅栏的因果链补齐。** Pool 61–62 的 `released_req_ids` 不只含抢占：另读 scheduler 构造的 finished/preempted 并集，以及发送线程实际等待 pending 请求的循环。普通 `wait_for_save` 登记 batch 后返回，不代表设备块复用前取消了等待。角色门槛通过也不等于所有后端、模型组合获支持。
- **旧版超时返回不等于加载成功。** Pool 66/67 的 10 秒等待后仅记日志和清事件；68 开始循环等待和查后台异常；69/70 进一步在完成后检查错误并在异常时清理、重抛。正文和浏览器版本表保留了这些差别。
- **连接器入口存在不等于通用部署支持。** Mooncake 的 D2RH/SfaRemoteD2H 注册分别核验；Hybrid 的 DCP、PP/PCP、consumer PCP 限制和端口算式按对应函数核验。逐层池指南明确真实 NPU、Master/Metadata、多 TP 端到端尚未验完；该指南的 AscendStore＋Mooncake 后端不能与点对点 Layerwise 同名概念合并。
- **PD 的元数据、完成池和恢复成功分开。** 来源 74–76 支持运行时层名/拥有者映射，未据此宣称完整 GLM 传输已通过。77 保留 V1 按压缩比的行为、align 状态选最终 prompt 块及 N>1/只截一次条件。83–84 共同核实 ratio=4 时位置 0/1/2 不发布完成池、长度为 floor(3/4)=0，而不是看到状态槽就认为已有一条完成池记录。

完整 49 项主张仍以逐项账本为准，上述摘要不代替各项证据。

## 原有效信息与其他会话内容的保留

以 `continuation-500/file-checkpoint.json` 的验收后哈希为基准，四页均取得精确字节证明：

| 页面 | 当前 SHA256 | 相对前批验收后的全部差异 |
|---|---|---|
| KV cache | `fa3c8ae61dd4e6aecbed87b62eec7490c48e392810f6ab04b1c77c669e76c74d` | 只有其他会话新增的“块表中的缓存生命周期”导航段；移除这一段后原字节哈希完全一致 |
| KV Pool | `b3f05698e4f3250968ffd51c10ce47c8b77841f82f02fc0616b98a4d093bfbc4` | 与前批验收后完全一致 |
| Mooncake | `361d2790694396837de25c6a4ac4ec97568fa33c9876bb3df0c4b89d2ecd1ea1` | 只有上述 P2 一句修订；恢复该句即可精确匹配旧哈希 |
| PD 分离 | `5c0327f1a78ee73cd10edf55c02fa32a12d93021e85403e808269e21c6322236` | 只有其他会话新增的 3D 导入段和 `inference-mechanism:2` 围栏；移除该段即可精确匹配旧哈希 |

保留清单包括：KV 的逐位置复用、位置次数算例、普通容量和块利用率、GLM 五类状态与旧镜像容量账；Pool 的 24/8/20 命中拆解、段长边界、名称/身份限制、IPC/逐层路径、三个后端和 133120/640 推导；Mooncake 的块号与地址对照、两半接口、整批拉/逐层推、押块时长、D2RH 与版本约束；PD 的混部/拆分对照、六步交接、块号示例、纯注意力/递推状态截断、GLM full 组选块问题、EPD 与编码缓存边界。除明确记录的差异，这些原解释未被重写或删减。

四页关联 15 对 YAML/SVG 全部记录当前指纹。5 对有前批验收后哈希并全部匹配；其余 10 对未出现在那份改动 checkpoint，已与前批 `before.zip` 对应文件逐字节比较，20 文件全部一致。故没有把“缺验收后哈希”误记成“与验收后哈希一致”。本组共冻结 34 个教学内容文件；保留与比较明细见 [checkpoint](supplement-transfer-checkpoint.json)。

KV 导航及 PD 的 3D 段属于其他会话，本轮保持原样；只核正文与来源关系，不接管其 renderer，也不冒认 3D 的实际播放或教学验收。

## 浏览器与交付证据

本轮实际打开 `http://127.0.0.1:5201/#/wiki/…` 四页，查看前两屏和四张版本表。KV 的入口先说明保存历史及显存/访问代价，Pool 先解释跨实例复用与查询/搬运成本，Mooncake 先对块表再搬历史，PD 先讲两实例职责和交接代价；均保留版本与固定镜像的条件。Mooncake/PD 两张宽表实际横向滚动到右侧并查看 rc2 列，另查看 Mooncake 指南限制单元格。没有将第一次截图中被横向容器裁掉的列当作已看完。

修改后的 Mooncake 条件句已实际查看，KV Pool 回链已实际点击并确认目标标题。浏览器 `pageerror=[]`，四页文档均无整体横向溢出；宽表使用自身滚动区域。其余既有图表沿用前批验收和本轮字节保留证据，本轮不声称重新验收全部 15 张图或 3D 播放。

- [supplement-transfer-independent.json](supplement-transfer-independent.json)：49 项独立人工 claims/verdict/evidence，版本、源文件、摘录和页面哈希。
- [supplement-transfer-checkpoint.json](supplement-transfer-checkpoint.json)：34 个文件指纹、差异和保留证明、六份补读上下文、浏览器结果与限制。
- `.tmp/continuation-groups-2026-11-10/supplement-transfer/`：固定摘录、独审人工工作表、补读原文和验证输出。
- `.tmp/continuation-groups-2026-11-10/review-supplement-transfer-browser/`：四页操作记录与实际查看过的截图。
- `.tmp/continuation-groups-2026-11-10/review-supplement-transfer-final.zip`：当前教学文件与独审账本快照。

执行的是引用/字节/范围验证及当前浏览器检查；未修改产品实现，未新报全站单测、构建通过。没有 NPU，不追加模型精度、时延、吞吐、实际字节传输或部署成功结论。本组关闭 49 项补证，不代表全站、全部官方资料或父任务其他账目都已完成。需要用户决定的事项：无。
