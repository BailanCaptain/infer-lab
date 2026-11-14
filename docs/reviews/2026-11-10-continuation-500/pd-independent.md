# PD 分离页首轮独立审查（2026-11-10）

审查对象：`wiki/concepts/pd-disaggregation.md`，以及页面实际引用的 `pd-disaggregation-intuition.yaml`、`pd-disaggregation.yaml`、`pd-state-boundary.yaml`。页面没有引用 EC 图块。起始版本取自 `.tmp/continuation-500-2026-11-10/before.zip`；比较时归一化 CRLF/LF，避免把换行变化算作内容变化。

本次为新的独立审查，先读了 `AGENTS.md`、`docs/wiki-writing-standard.md`、`wiki/AGENTS-GUIDE.md`，完整阅读当前页面、三个 YAML 和实际文本 diff；对重点结论重新读取固定 Git 原文。没有把写手的 72 条初判当成独立审查结论，也没有声称本次重新逐条审完所有 72 个来源。纯文档审查，未启用代码技能，未修改产品页面或图。

**首轮结论：首次静态审查未发现已证实的 P1，记录了 5 项 P2、2 项 P3。后续浏览器阅读另暴露 1 项图示 P1；本独立审查重新核源，已确认写手修订关闭该项，详见末节补充复审。** 本审查者没有浏览器打开、链接操作、SVG 视觉验收或 NPU 执行，因此这不是页面最终验收通过结论；主任务的浏览器观察不冒充为本审查者执行。

## 初学者测试与已核对的主线

只读前两节，可复述为：一条请求先用 P 计算提示词的历史，再由 D 接着生成；拆开减少同一步里提示词计算对生成请求的干扰，但要搬运状态、提前占 D 的块、延后释放 P 的块，还多出代理与失败恢复。首图和正文共同表达了数据流与代价，这一关通过静态阅读。

- 首轮时三图宽度均为 900；机制、调用顺序、状态边界各有一图。首轮读取时三个 YAML 与 before.zip 归一化后完全相同；后续状态边界图修订见末节。没有把未做的 SVG/浏览器检查记作通过。
- 正文从直觉、动机、交接、边界、失败、EPD 进入 GLM；`对照源码` 是最后一个 H2，其 H3 顺序符合标准。
- 教学正文按去空白字符统计为 11,747 字符；inline code 为 0，calc 1 块，证据角标 0 处；全页证据标记 30 处。此统计是结构检查，不代替术语和事实审查。
- 块号示意保留 P#7→D#3、P#12→D#5；R1 保留混合模型 S₃→p₃→S₄ 与纯注意力退回一格；2,000→1,999、640/2,560、4 块/1 块的推导保留；EP8 的 36 专家、38.72 GiB、1,577 块与 EP16 的 18 专家、20.58 GiB、3,908 块仍回链唯一出处，未重算另一套账。
- 源块与请求生命周期、失败也通知 P、480 秒超时、失败策略对混合模型的限制、单 token 未实测、D 端块大小断言未实测、Hybrid 选择未核、DP/MTP/图模式组合未实测均仍在。
- ECExampleConnector 的磁盘/媒体 hash、encoder-only 的执行与加载区别，以及 ECCPU 单主机、MRV2、固定主机内存、CANN、内核、槽位与字节单位的边界保留。重新读来源 70/71 完整指南，当前本机缓存说明与指南相符。

## P2-1：四版对照表仍没有 rc2 列，遗漏实际行为差异

**位置：** 页面 L437–L454，尤其 L441–L450；frontmatter 的 `verified` 也没有 `releases/v0.30.0rc2`。

**影响：** 表格的四列实际是 v0.23、GLM 独立镜像、v0.26、main，独立镜像不能代替标准要求的 rc2。前面两段笼统说明 rc2 不足以让读者逐项比较。尤其 rc2 V1 的状态选块、完成回调及 D2RH 注册均有可读到的不同，不能整列简单写“同 main”。

**精确修法：** 保留 GLM 固定镜像列，另外补 rc2（`7d825229`）列，逐项填写下列已核事实，并在完成实际逐项核验后同步 `verified`。表内对“V2 不少传”应写成“按本组逻辑块大小裁剪，不再额外乘压缩比；仅此处块数规则”，避免理解成端到端保证。默认值可增加一行，至少明确所列上游四份快照的加载失败默认值均为 `fail`；不要把允许配置等同于本页 GLM 能使用 `recompute`。

| 现有表项 | rc2 可以填写的事实 | 本轮直接读取的原始位置 |
| --- | --- | --- |
| V1 主流程 | 仍按长度上限交棒、D 拉取；另有 D 入队前拒绝时发送空接收以释放 P 源块的分支 | `vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2007-L2069`，尤其 L2025–L2040 |
| 混合模型截断 | 仍仅 N>1 才截尾，标记保证只截一次 | 同文件 `#L1874-L1905` |
| full 组裁块 | V1 仍取最后压缩比并乘入逻辑块跨度；CP 计算改用 DCP。V2 使用组逻辑块大小，SWA 与其他 attention 组的 DCP 规则有区别 | V1 同文件 `#L1788-L1856`；V2 `vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_scheduler.py#L115-L150` |
| 状态组 | V1 新增 align 模式按提示词位置选单个最终状态块，不能把旧版“所有状态块先留在元数据里”泛化到 rc2 | V1 同文件 `#L1818-L1850` |
| `kv_both` | V1 仍按字符串选线程及完成集合；V2 初始化要求恰好一种角色 | V1 同文件 `#L2711-L2769`；V2 `base_scheduler.py#L46-L53` |
| 点对点注册 | V1、D2RH V1、V2/Pull、Hybrid、Layerwise、SfaRemoteD2H | `vllm_ascend/distributed/kv_transfer/__init__.py#L45-L88`、`#L131-L135` |
| 池及 offload 注册 | AscendStore、UCM、通用 Offloading 的 NPU 边界、条件注册的 SimpleCPU、Preempt；没有恢复 LMCache/Recompute 注册项 | 同注册文件 `#L70-L135`；须保留 SimpleCPU 的导入条件 |
| GLM 支持矩阵 | 模型实验性支持，PD 列勾选；这不替代本页的硬件/配方限制与实测缺口 | `docs/source/user_guide/support_matrix/supported_models.md#L27-L45` |
| partial-prefills 限制文字 | 设计文档没有旧限制条目；平台仍在属性非 1 时重置为 1 | `docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L101-L105`；`vllm_ascend/platform.py#L778-L783` |

加载失败默认值的直接证据：`vllm@0fc695fc:vllm/config/kv_transfer.py#L70-L73`、`vllm@568afb3a:vllm/config/kv_transfer.py#L69-L73`、`vllm@84030bbe:vllm/config/kv_transfer.py#L69-L73`、rc2 配套 `vllm@ced6857afa0ea7b2e3f0846a62e1394e90f15607:vllm/config/kv_transfer.py#L103-L107`。配套钉点以 `wiki/seeds/*.yaml` 为准；`84030bbe` 是现页使用的上游快照，不能另称为自动跟踪最新 main。

**复核方式：** 对上表各路径执行 `git -C tools/repos/vllm-ascend show 7d825229:<path>`，按行看分支；不是用连接器名字命中数证明版本支持。

## P2-2：rc2 的连接器 PCP 能力与 GLM 配方条件没有明确分开，来源 69 也不够支撑 metadata 说法

**位置：** 页面 L437–L439；来源 67/69/72。

**影响：** “旧 main 的 V2 必须 PCP=1 不能延伸到 rc2”就连接器本身而言有证据，但紧接 GLM 配方，会使读者误以为 rc2 GLM 也可以开 PCP/DCP。来源 67/72 明确写了 GLM 只支持 Model Runner V1，并要求 PCP=DCP=1；当前正文没有把这两项具体写出。来源 69 只到基类读取配置与组规格，不能单独证明这些配置真的序列化并由 D 使用。

**精确修法：**

1. 在 rc2 段先写清：A3 为 P DP2/TP8、D DP16/TP1；A2 为两台 P DP2/TP8、两台 D DP8/TP2；该 GLM 教程要求 MRV1，PCP=DCP=1。SFA 的实验性 `enable_dsa_cp` 在 TP 组内切 query，不能称为打开 PCP/DCP。原文是 `vllm-ascend@7d825229:docs/source/tutorials/models/GLM5.3-Flash.md#L17-L33`，其中 L26–L33 为 runner/CP 限制。
2. 另起一句限定“连接器实现层”：rc2 V2 不再在 base worker 初始化时强制 PCP=1，并按 PP/PCP/TP 组织握手数据；这不是 GLM 配方支持范围的扩张。
3. 把“metadata 包含 PCP 与各 KV 组的规格”精确写为“握手 metadata 带 PCP/DCP/TP 规模，并按 PP/PCP/TP 组织层名、组索引、逐层块大小、形状、步长及地址信息”。metadata 并没有直接传一个叫 `kv_group_specs` 的对象；D 同时使用本地 `kv_cache_specs`。
4. 给来源 69 增加真正的结构、序列化与消费者来源，或另加独立来源条目，不能只把基类配置读取当作运行协议证据。

**原始证据链：**

- 旧 main 强制检查：`vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L98-L103`，L101 为 `assert self.pcp_size == 1`；rc2 对应 `base_worker.py#L99-L103` 已无此断言。
- rc2 类型：`.../mooncake/metadata.py#L88-L122`。`MooncakePPTransferMetadata` 的 L98–L107 是逐层布局与按 PCP 分组的数据，`MooncakeTransferMetadataGroups` 的 L117–L122 是 PP/PCP/DCP/TP 和分组记录。
- rc2 真正编码发送数据：`.../mooncake/pull_scheduler.py#L58-L95`，L84–L95 构造并用 msgpack 编码 `MooncakeTransferMetadataGroups`；L170–L185 校验 PCP、TP rank 集合完整。
- rc2 D 消费：`.../mooncake/pull_worker.py#L249-L284`，从远端层名配对本地层，L279 使用本地规格，L280–L283 使用远端布局与 PCP/TP/DCP；L1443–L1456 还校验远端 PCP 大小和 rank 集。

这条补核闭合的是 metadata 的实际使用，不是所有模型/所有 CP 组合端到端可用。

## P2-3：D2RH 的版本引入说法不准确

**位置：** 页面 L435：“后续官方快照 921ccc52 还增加 D2RH”。

**影响：** rc2 的注册表已经有该入口，读者可能误以为必须离开指定 rc2 才有 D2RH。来源 68 已包含反证，当前段与来源自身不一致。

**精确修法：** 改成“rc2 已注册 MooncakeD2RHConnectorV1；后续固定文档快照 921ccc52 进一步说明 D2RH 的两跳等待关系……”，或者只写“另一条 D2RH 路径……”并分别标明实现与所引文档的固定版本。不要据此声称最初引入提交，本轮没有查历史首引入。

**原始证据：** `vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/__init__.py#L49-L53` 已注册 `MooncakeD2RHConnectorV1` 指向 `mooncake_d2rh_connector.MooncakeConnector`；该固定版本存在完整 `mooncake_d2rh_connector.py`，L2595 有 `MooncakeD2RHConnector = MooncakeConnector`。存在入口与实现不等于本轮做过 D2RH 运行验收。

## P2-4：N>1 与“只修这处选块算法”的限制没有同步到摘要性结论

**位置：** 页面 L375、L428、L444–L445、L486；L270 与 L491 已正确写限制。

**影响：** 细节处已说单 token 不走 N−1，常见误解和开销却又无条件写“混合模型没有哪一格算两次”。版本表又写“V2……不少传”，容易被独立引用为所有长度、所有 CP 或整条链路结论。尤其本页明确单 token 的恢复正确性还待核，不能在另一处写成已经普遍成立。

**精确修法：**

- L375、L428 和来源索引的“不重复算位置”统一补“提示词多于 1 个 token、走这里的截断路径时”。
- 表行标题改成“混合模型截断（N>1）”；V2 单元格改成“按各组逻辑块大小裁剪，不再额外乘压缩比；本文 N>1、PCP=DCP=1 算例修正这处块数”。
- 保留 L270 的单 token 待核、L348/L490 的 D 端块大小断言待核，不用“短提示词不受影响”去泛化整个 PD 链路。

**原始证据：** `vllm-ascend@db701c1f:.../mooncake_connector.py#L1751-L1756` 与 `#L1765-L1782` 都明确 `num_prompt_tokens > 1`；main V2 `base_scheduler.py#L125-L138` 的块数分母含 `block_size * max(1, pcp_size * dcp_size)`。现 L491 限定 N>1、PCP=DCP=1 的修订是正确的，应同步到本页其余摘要。

## P2-5：V2 待核从“缺 D 端源码通读和运行”缩成只缺运行证据

**位置：** before.zip 原 L489 与当前 L491。

**影响：** 原文明确列出 `pull_worker.py` 的源码通读仍未完成。本轮 diff 没有相应的完整 D 端审查证据，却把“缺源码通读”删掉，仅留下需要端到端运行。读者与后续维护者会少掉一个真实未核项目；写作标准要求未核项不能因换写手消失。

**精确修法：** 在当前已加限定的段末恢复“D 端 pull_worker 及整条链路尚缺完整源码通读与相应版本的运行验证”。本审查只为 rc2 PCP metadata 定位读取若干消费者分支，不能用它关闭 main V2 的完整 D 端审查。若写手已在别处完成，应给出该次实际记录的路径与范围，再明确迁移去向。

**依据：** 归一化后的实际 diff，原文是“待核：V2 的 D 端（pull_worker.py）和整条链路在 GLM 上能否跑通，缺源码通读和一次实际运行。”当前只有“端到端可用性仍需相应版本的运行证据”。不是要求重写整页，也不要求没有设备时补造运行结果。

## P3-1：来源 48 可确认成立，补上类边界能让负面结论更好复查

**位置：** 来源 48 以及页面 L475。

完整读 `vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py` 后，`AscendSampler` 类实际范围就是 L46–L125，L128 开始的是另一个类 `AscendTopKTopPSampler`。用 Python AST 静态解析得到方法列表：`apply_penalties,__init__,set_q_event,prepare_sampling,do_async_exponential,greedy_sample`；没有 `forward` 或 `__call__` 覆盖。因此写手初判“仅起始摘录不能证明”可在补核后关闭，不应继续当事实缺口。

可将来源 48 范围延至 L128，让读者看到下一类边界；或在源码表解释“L46–L125 是完整类”。无需修改“Ascend 采样继承上游 forward”的结论。

完整链条仍是来源 49 的 `_sample`→`self.sampler`，来源 48 继承 `Sampler`，来源 50 的 `Sampler.forward` 在采样前调用 logits processors，来源 26/27 把最少生成数之前的停止 token 置为负无穷。这一静态链与当前示例代理 `max_tokens=min_tokens=1` 的解释一致。

## P3-2：更新元数据与维护记录不要留在教学尾部

**位置：** `updated: '2026-11-03'`；页面 L498–L499 的“来源 58 / 来源 59”两行。

修订后更新日期应反映本次。两行编号式维护尾注没有提供教学解释，且 58/59 只是来源 3/8 的重复范围，可把编号对应关系留在本审查目录或判断 TSV；正式来源索引以已有结论→原始来源映射承载。不要为删重复尾注而删除这两条来源支持的条件。

## 本轮修订的接受项与信息去向

| diff 变化 | 独立审查结论 | 原始证据/信息去向 |
| --- | --- | --- |
| P 仍需调 chunk 和 token 预算 | 接受；没有再把“消除混部折中”写成“不用调 chunk” | 设计文档两条动机；原来的混部干扰示例仍在 L205 |
| 来源 12 扩到 L2027，区分请求等待和 worker 陪跑 | 接受 | `db701c1f:model_runner_v1.py#L2027-L2042` 明确 external_launcher、DP>1、`_dummy_run(1)` 后再走 connector 无前向路径；L2053–L2057 为另一空输入分支 |
| 同步“调度器空转”误解 | 接受 | 不再把一个请求 0 token 推成整个 worker 不算模型 |
| 配置段不再声称只改角色和端口；增加 PP 默认与互斥 | 接受 | `db701c1f:mooncake_connector.py#L2001-L2003`、`#L2064-L2083` 支持 PP/PCP 互斥、两侧 PP 默认 1、D_PP=1 |
| V2 N−1 算式加条件、降为局部块数结论 | 接受限制本身；需处理 P2-4/P2-5 | 逻辑块数规则已核；不能把 D 端源码通读缺口抹掉 |
| 图文件 | 无内容改动 | 三个 YAML 归一化后逐行相同；没有删图或删图中文字 |

## 验证记录与范围

实际运行：PowerShell `Get-Content` 读取页面、标准、YAML 和来源摘录；Python `zipfile`+`difflib` 对 before.zip 做归一化文本 diff；固定提交 `git show` 阅读上述原文；`git grep` 定位后回读实际上下文；Python AST 检查完整 AscendSampler 类边界和方法；页面结构/角标/图块的只读统计。最后一项统计输出为三图 YAML 不变、教学角标 0、calc 1、全文标记 30。

未运行：浏览器实读、图像视觉验收、链接点击、NPU、多机 PD、D2RH、ECCPU 实测；也未在本子审查中运行全库 lint/audit/build。外链可达性没有联网验证。主任务须在修订后按项目要求做页面与仓库验证，不能把本报告当作那些步骤的替代。

Why：防止固定 GLM、rc2 通用连接器及后续文档快照被混成同一支持范围。What：完成首轮独立静态审查并给出精确修法，未改产品。Evidence：上列固定源码、实际 diff、完整类 AST 与结构统计。Tradeoff：不将源码路径正确扩展成硬件可用或性能保证。Open Questions：main V2 D 端完整源码通读及页面既有 NPU 待核仍未关闭；其余无需用户作产品决策。

## 补充复审：P1 图示把 indexer 未满池尾状态误作三格已完成历史（已关闭）

**触发与范围：** 主任务在浏览器实读中发现旧 `pd-state-boundary.yaml` 的第一状态框写“按位置的历史 3 格 / MLA 潜向量、indexer 缓存”，没有交代 R1 在 P 侧只算前三个位置时的 indexer 尾状态。主任务已手改 YAML；本审查者随后独立读取当前 YAML、固定模型配置、缓存类、slot 映射与写入算子，并对 before.zip 做实际 diff。本审查者未执行浏览器或 NPU。

**级别与影响：** 旧图记 P1。它在核心状态交接图中把 MLA 按 token 保存的历史与 indexer 每四个位置才完成一池的历史混为同样“3 格”，且遗漏 D 算 p₃ 必须接续的未满池 K/gate 尾状态。只凭旧图会误以为 D 得到三条已完成的 indexer 池记录；本页后面的正确文字不能替代图中必要的区分。首次静态审查漏检此处，现据原始源码更正结论。

**当前修订：**

- YAML L15 的状态框已改为“MLA 的前 3 格历史 / 另带 indexer 未满池尾状态”。
- YAML L3 的 caption 说明 S₃ 含 MLA 历史、indexer 未满池尾状态及 KDA 状态；前三个位置还没凑满四个，没有完成的 indexer 池。
- 实际 diff 只有这两处文本；图宽、框坐标、框尺寸、箭头、纯注意力分支和 KDA 状态框没有变化。

**直接证据与推演：**

1. 固定 Hugging Face revision `690b705278a3a58e538fcb37c2ca8b5f9511213c` 的 `config.json.text_config` 为 `index_head_dim=128`、`index_kpool=4`、`index_kpool_compress=true`。本轮读取本地固定原文副本 `.tmp/evidence-2026-11-03/groups-01-02/glm-config-690b7052.json#L21-L25`；没有把本地缓存读取说成重新联网下载。
2. `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1253-L1313` 将配置的 `index_kpool` 传给两个独立缓存：L1298–L1304 的尾状态是 `state_dim=2*head_dim`、FP32；L1305–L1313 的完成 indexer K 是 BF16。
3. 同模型文件 `#L312-L362` 明确尾状态保存每 token 的 `[K, gate]`；窗口与块大小等于压缩比，FP32 保留精度，完成压池后才向 indexer 缓存写 BF16。该旧镜像实现是滑动尾页，不把 rc2 的环形状态描述套回这里。
4. `vllm-ascend@db701c1f:vllm_ascend/core/kv_cache_interface.py#L27-L50` 的真实映射条件为 `(positions + 1) % compress_ratio == 0`；未到池末的 token 映射为 −1，只更新全精度状态。代入位置 0、1、2 和压缩比 4，条件均为假；位置 3 才为真。
5. `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L175-L200` 真正调用上述映射，并把有效 indexer 长度设为 `floor(seq_len / compress_ratio)`。所以处理三个位置时完成池数是 `floor(3/4)=0`，处理第四个位置后是 1。
6. `vllm-ascend@db701c1f:vllm_ascend/ops/glm5_next_kpool_state_compress.py#L159-L160` 先将 K/gate 写入尾状态；`#L200-L207` 压池并按 indexer slot 写入，`#L110-L137` 把无效 slot 当作 no-op。Triton 路径同文件对应实现 `ops/triton/glm5_next_kpool_state_compress.py#L98-L117` 也分别写尾状态并检查 indexer slot 有效性。由此“没有完成的池”是有效数据判断，**不表示没有给 indexer 分配物理缓存块**。

**复审结论：** 当前两处文本与固定配置、两类缓存及有效槽位规则一致，关闭这项图示 P1；没有新发现的 P1/P2。该结论确认“应交接哪些有效状态”，不证明 Mooncake 在此版本上已正确搬运并恢复它们，仍须保留页面现有连接器与 NPU 待核。

为了让新图结论可从页面直接追溯，可在页面来源/图 pin 中补充上述 `glm5_next.py#L312-L362`、`core/kv_cache_interface.py#L27-L50` 与固定模型配置；这与源码审查是否成立是两件事。图文字修改后的 SVG 生成检查与浏览器视觉验收由主任务执行，本审查者不代签。
