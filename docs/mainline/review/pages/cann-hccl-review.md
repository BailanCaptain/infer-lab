# cann-hccl 审查记录

## P5 写作记录（2026-09-28，第 03 批）

### 改写范围与理由

- 重写 `wiki/concepts/cann-hccl.md`，保持 id、标题与原检索别名。先解释通信库、接口、链路的职责，再讲等待与缓冲成本、精度与基础计算，之后落到 A0 建组和 A4 使用。
- 重绘 `cann-hccl.yaml` / SVG：两侧框架请求经 HCCL、设备和物理链路交换数据，再将就绪结果交回计算。新建 `cann-hccl-flow.yaml` / SVG：A0 初始化后接 A4 普通通信 / MC2 分支，普通 All-to-All 画出切片与交换，并解释接收后拼接。两图画布宽均为 860。
- 将原合并页 AI QoS 的事实融入机制与源码区：VL / SP、Unified Bus 与 Unified Buffer 区别、五类流量与等级、AIV 驱动限制、默认 SDMA 源标签及目标 VL、端点和交换机的分别配置 / 恢复、A3 产品与最低软件条件全部保留。补齐三版五键到三键的变化。
- 旧两卡数值小例的 All-Gather / All-Reduce 语义保留，重复算例改链通信基础；通信库的单机、多机、集合及点对点能力保留。没有重算部署页或请求主线的账。
- 仅改本页、所引两组图和本记录；未改其他页面、共享索引、src、scripts、tests 或计划，未提交。

### 数字与原始依据

- 数字口径：`01-deploy-entry-schedule.md` §A0.2 的 TP8 / DP2 / EP16 与 CPU gloo 组；`02-forward.md` §1.2 的 218 个主干通信调用边界、BF16 的 [T,4096] TP 载荷、MoE 两条路径。R1 的 32 KiB 只引用 `one-request` 通信账；16 卡分组只引用部署页。
- CANN / HCCL 职责、集合与点对点、链路及 SUM / PROD / MAX / MIN：实际联网阅读页内两条 CANN 9.1.0 官方文档。
- 初始化与通信：定点读取 `vllm-ascend@db701c1f` 的 Worker 975–988、NPUCommunicator 40–68，及 `vllm@0fc695fc` 的 DeviceCommunicatorBase 180–207、parallel_state 1749–1875、parallel.py 683–707。
- QoS：定点读取固定快照的官方指南和 ai_qos.py 270–474；对比三版 `2c59ff10` / `2ed6cbba` / `baa023ad` 的 Worker、脚本及官方指南。前两版脚本与固定快照一致；main 为 AIV / SDMA / PCIEDMA 三键，等级、VL 与文档调用入口已单列。
- 未发现本页消费数字的新算错或队列矛盾。固定镜像完整软件配套、真实链路算法、带宽与 QoS 收益仍需实机证据，保留在页末待核。

### 独立审查与修订

独立审查者 `/root/review_cann_hccl` 实读修改前备份、实际页面、图 spec 和定点源码，提出：

| 级别 | 问题与影响 | 修订与复审 |
|---|---|---|
| P1 | token 曾写成位置编号，混淆词表编号与 position ID | 改为分词得到的基本单位、进入模型用词表编号表示；复读关闭 |
| P2 | 重排时漏写点对点与单机 / 多机能力 | 在首图后补回；复读关闭 |
| P2 | 版本表指向并不存在的完整五键 VL 表 | 填全五键目标 VL / 优先级；复读关闭 |

独立审查结论：文字、spec 和源码无未关闭 P1/P2。实际截图送审后，前两屏、两张完整图、版本表及末段视觉复核通过，无 P1/P2。主写手另逐屏核读了全部八屏。

### 统计与验证证据

字数采用项目 `measureStandard` 口径：汉字数＋拉丁单词数，去掉 frontmatter、围栏内容与 Markdown 链接 URL。含源码区的全文 **1298 → 4102 字**；新版教学正文 **2348 字**，源码区之前行内代码 0、证据角标 0、calc 0。数字推导归属其他页，因此未为本页凑 calc。首图之前无部署数字或 calc，仅有两卡通用说明。正文免责词命中 1 / 71 句（1.4%）。单页八项写作标准全部通过，来源角标共 22 处，其中 C 15 处（68.2%）。

| 实际验证 | 结果 |
|---|---|
| `pnpm.cmd check:content` | 通过，registry 131 页 |
| `pnpm.cmd wiki:diagrams --check` | 最终通过，163 图与 spec 一致；本页两图独立布局检查无错误 |
| `pnpm.cmd wiki:audit` | 最终通过；1523 条本地行号有效，0 无效提交 / 缺文件 / 越界；URL 与 raw 全库内容不属于该命令验证范围 |
| `pnpm.cmd wiki:lint` | 最新一次失败 1 处：`hardware-devices.md` 的两条 e.huawei.com 来源域名不在白名单。本页无 lint 错误；按范围未改该页 |
| `wiki:build` 对应脚本 | 将当前 concepts / params / sources 复制到 `tmp/p5-cann-hccl/build-check`，在该副本执行 `node --import tsx ../../../scripts/wiki-build.ts`，131 页生成通过；避免写回协调者管理的共享 registry / index |
| `pnpm.cmd build` | 前两次受其他页瞬时图 spec 问题、workflow 锁竞争阻塞；最后一次通过，2137 模块，构建 27.85 秒 |
| `pnpm.cmd check` | 类型检查和代码 lint 阶段通过；全套测试出现参数扫描用例失败及快照构建阻塞，后中止，不宣称全套通过。未修改测试或清理其他进程的锁 |
| 相关测试 | 读取本机配置设置 WIKI_PYTHON 后，运行 `pnpm.cmd exec vitest run scripts/wiki/standard.test.ts scripts/wiki/diagrams.test.ts`，2 文件 / 37 测试全部通过 |
| 差异检查 | 本页与图 `git diff --check` 无空白错误 |

当前没有可连接的 CUA 浏览器；使用项目已有 Playwright / Chromium 测试依赖打开真实生产页面。开发服务无响应后关闭，以生产预览在 **4175** 验收，视口 **1440×1000**，共八屏和两张完整图。浏览器验证标题、两图、A0 启动锚点跳转且进入视口、通信基础跳转与返回；页面与两图均无横向溢出，pageerror 为空。预览已关闭，netstat 确认 4175 无 LISTENING；未启动或停止 5193 / 8790 服务。

截图及浏览器结果：

`C:/Users/-/AppData/Local/Temp/claude/C--Users---Desktop-infra-view-new/13898c74-f916-4e2c-8924-fe9bf130f160/scratchpad/p5/cann-hccl/`

目录内为 `screen-01.png` 至 `screen-08.png`、`figure-1.png`、`figure-2.png`、`browser-results.json`。检查日志和改前备份在 `tmp/p5-cann-hccl/`。

### 取舍与未决

保留完整机制与合并事实，省去其他页已有的重复数字推导；只核本页相关版本行为，未将整套镜像标为三版 verified。无 NPU 实测。需要用户决定的问题：无；全库 lint 外部阻塞及完整镜像 / 性能待核已如上记录。

## P5 审查（09-28）

独立审查，只审不改。审查对象：工作区 `wiki/concepts/cann-hccl.md`（未提交，184 行）与两张图 spec / SVG；对照 HEAD 版本、`14591fd^` 中被并入的 `ai-qos.md`、`01` §A0.2、`02` §1.2 / §6.4、`vllm-ascend@db701c1f` 与 `baa023ad` 源码。

**跳过的段落**：frontmatter 来源清单（11–33 行，由 audit 校验）；「## 对照源码」正文（116–184 行）只用 grep 核对结构和个别事实，未通读；旧 `ai-qos.md` 的 frontmatter（1–56 行）与对照源码正文（125–202 行）同样只 grep。没有读取被拦截的段落；一次检索输出中途中断，未重复该检索，所需信息已由后续 grep 取得。

### 1. 初学者测试（只读前两屏，45–72 行）

能说清。我的一句话：CANN 是把框架接到昇腾卡的软件体系，HCCL 是其中按约定组织多卡收发和求和的通信库，字节实际走 HCCS / RoCE 等物理链路；代价是每次交接都要发起、传输、归约、等齐参与者，还要占设备缓冲，GLM 双机一次前向要经过 218 次。

直觉图（`figshots` 实截 `test-results/figshots/cann-hccl-1.png`）画出了“框架请求 → HCCL → 卡 → 物理链路 → 另一张卡”，符合本页要求。

### 2. 核心概念逐条核对

| 位置 | 论断 | 核对依据 | 结论 |
|---|---|---|---|
| 47、55 行 | HCCL 属于 CANN，支持集合与点对点、单机与多机 | 旧页 [S2] 与 CANN 9.1.0 文档，写手已联网核读 | 对 |
| 80 行 | All-Reduce 可选 SUM / PROD / MAX / MIN，类型、元素数、调用次序须匹配 | 同上 | 对 |
| 84 行 | 先初始化设备通信，再建模型并行组，然后加载、预热 | `vllm_ascend/worker/worker.py@db701c1f` 975–988（`init_distributed_environment(..., "hccl")` → `ensure_model_parallel_initialized` → `init_ascend_model_parallel`），`load_model` 在 668 行、`compile_or_warm_up_model` 在 693 行 | 对 |
| 88 行 | TP {0…7} / {8…15}，DP {0,8}…{7,15}，EP / MC2 覆盖 16 rank | `01` §A0.2 101–103 行 | 对 |
| 90 行 | gloo CPU 组用两个 int32 同步“有无未完成 / 是否暂停” | `01` §A0.2 104 行 | 对 |
| 98 行 | MoE 每层四个通信边界；AllGather 路径换成两次 DP 收集 + DP Reduce-Scatter + TP 归约 | `02` §1.2 105–108、113 行 | 对 |
| 104 行 | VL 隔离 + 严格优先级 | 官方指南 `Ai_QoS_introduction_en.md@db701c1f` 15、17 行 | 对 |
| 106 行 | 仅 Atlas 800T A3 / Atlas 900 A3 SuperPoD | 同指南 77 行 | 对 |
| 114 行 | 脚本只打印交换机命令，交换机须另行执行 | `tools/ai_qos.py@db701c1f` 33–35、124–128 行 | 对 |

核心概念没有讲错。

### 3. 数字核对

| 页内数字 | 底稿 | 结论 |
|---|---|---|
| 218 个通信调用边界（59 行） | `02` §1.2 111 行：1 + 45 + 3 + 42×4 + 1 = 218 | 一致 |
| TP 归约 [T,4096] BF16（96 行） | `02` §1.2 102–104、108 行：T × 4096 × 2 B | 一致 |
| R1 每次 TP 归约 32 KiB/卡（96 行） | `one-request.md` 380 行“张量 32,768 B”（T = 4） | 一致，出处唯一 |
| 分组成员、gloo 两元素 | `01` §A0.2 | 一致 |

写手自报的疑点（第 19 行：镜像配套、链路算法、带宽与 QoS 收益待核）已在页末“待核”写明，属实。未发现算错的数字，也未发现没有出处的数字。

### 4. 有没有丢信息

- 与 HEAD 相比（`git diff`，只看删除行）：CANN 职责、HCCL 单机 / 多机、链路列表与“不代表都具备”、归约可选操作、需分别记录框架 / 适配层 / CANN / 驱动 / 固件版本（现在 120 行）都还在。**唯一丢掉的是指向 [张量并行](tensor-parallel.md) 的链接**（旧 relation 和正文“具体数据流放在张量并行里读”），见 P3-3。
- 与被并入的 `ai-qos.md`（`14591fd^`）逐个 H2 对照：五类流量、默认等级、VL 2 / 3 / 5 与优先级（140、168 行）、AIV 不生效（138、170 行）、SDMA 共享标签 2 并靠交换机按入口拆分（140、167 行）、SP 与序列并行的区别（106 行）、不是请求调度（104 行）都保留了。**丢了两处**：
  - main 上 PD 分离 KV 连接器的 `qos_priority`（旧页 164、171 行：整数 0–4，缺省 1，非法值抛 `ValueError`；与 AI QoS 的引擎和 VL 编号是两套）。新页 `grep qos_priority` 为 0，全库也是 0。源码确认只在 main 上：`baa023ad` 的 `kv_p2p/mooncake_connector.py:2188` 等 5 个文件调用 `inject_qos`，`kv_transfer/utils/utils.py:19` 的 `PD_QOS_DEFAULT = 1`；`2c59ff10` 和 `2ed6cbba` 中为 0 个文件。见 P1-1。
  - “推理进程退出不会自动还原，要手动 unset”。新页 142 行只写了 unset 能恢复快照，没说设置不会跟着推理进程一起结束。旧页说“重启服务器也会还原”，但固定快照的指南里查不到这一说法，不必恢复。见 P3-5。
  - 旧页指向 [ShortRequestFirst](short-request-first.md) / [Batch-Job-Aware Scheduler](batch-job-aware-scheduler.md) 的链接丢了，见 P3-4。

### 5. 链接与锚点

本页 13 个出链全部能解析：目标文件都在；`collective-communication.md#mc2`（167 行）、`#放到-glm-双机一个-token-会在哪里通信`（137 行）、`glm-5-3-flash-two-node.md#16-张卡怎样分组`（125 行）、`#启动时发生了什么`（245 行）、`#怎么开`（293 行）、`one-request.md#一次前向的通信账`（368 行）、`#示例请求-r1-与官方双机部署`（109 行）都有对应标题。全库入链：`ai-core.md`、`learning-guide.md`、`index.md`（4 处）都不带锚点，能解析。已删除的 `ai-qos.md` 在 wiki 正文和 src 中没有残留链接。

### 6. 自动检查

- `pnpm wiki:audit`：exit 0。本页 evidence=C，教学正文 7 节，来源 22 条，行号全部有效。**注意**：本页不在 `scripts/wiki/standard-pages.json` 名单内，audit 不强制本页的写作标准。我另用 `checkStandard` 单独跑了本页（脚本在 scratchpad 的 `std-one.mts`），结果为 2348 字，行内代码 0/千字，角标 0，对照源码结构合格，calc 0，没有相邻块，图先行合格，免责词 1.4%，图宽合格，八项全部通过。
- 对照源码的五个 H3 齐全、顺序正确（118 / 144 / 150 / 156 / 174 行）；版本差异一节同时出现 v0.23、v0.26、main。
- `pnpm wiki:lint`：exit 1，只有 `hardware-devices.md` 的 source-domain 一处报错，与本页无关。
- 浏览器：5193 上运行 `pnpm wiki:figshots cann-hccl`，截得 2 张图，布局无重叠。

### 7. 打分：7 / 10

**P1**

1. **位置**：对照源码 · 版本差异（156–172 行）。**问题**：并页时丢了 main 上 PD 分离 KV 连接器的 `qos_priority` 这条事实，现在全库都没有了。读者在 main 上看到 `qos_priority` 时，会误以为它就是 AI QoS，或者根本查不到。**改法**：在版本差异表加一行“推理引擎内的 QoS 入口”，填 v0.23 无 / v0.26 无 / main 有（PD 分离 Mooncake 系连接器与 KV 池后端，`kv_connector_extra_config.qos_priority`，整数、缺省 1，非法值抛 `ValueError`），并注明它的编号与本页的 AI QoS 引擎、VL 是两套。源码位置补 `baa023ad` 的 `kv_transfer/utils/utils.py#L19` 和 `kv_pool/ascend_store/backend/base.py` 的校验函数。

**P2**

1. **位置**：49、55、68、98 行。**问题**：rank、All-Reduce、Reduce-Scatter 都在本页就地下定义，“集合通信”首次出现（55 行）也没有链接；到 72 行才第一次链到通信基础。TERMS 规定这些术语由 collective-communication 负责定义。此外，49 行把 rank 定义成“同组参与者的编号”，而 88 行用的是全局编号（DP 组 {0,8}），两处自相矛盾。**改法**：49 行改成“参与者编号（[rank](collective-communication.md#两张卡交换以后各自手里多了什么)）”，All-Reduce 链到 `collective-communication.md#all-reduce`，55 行“集合通信”加链接，98 行 Reduce-Scatter 链到 `#reduce-scatter`，只保留半句提示，不再下定义；88 行注明“下文均为全局 rank 编号”。
2. **位置**：74–80 行“数据精度和本地计算，怎样影响通信”，以及 113 行误解。**问题**：只讲了“W8A8 不意味着 hidden 按 int8 传”，却没给本部署的实际情况：MC2 dispatch 在 W8A8 下**确实**传 int8 hidden 加 FP32 per-token scale（`02-forward.md` 683、691 行：每个 (token, 专家) 4,100 B），combine 传 BF16（692 行）。读者会得出“本部署通信全是 BF16”的错误印象，而这正是本节要讲的例子。**改法**：在 78 行后加一句，写明 TP 归约是 BF16（2 B/元素），MC2 dispatch 是 int8 加 scale、combine 是 BF16，字节推导链到 `one-request.md#一次前向的通信账`（该表 381 行已有 ≤ 32,800 B），本页不重算。113 行改成“归约仍是 BF16，只有 dispatch 这一段因量化而变小”。
3. **位置**：82–98 行 GLM 段。**问题**：本页标题是“计算、通信和物理链路”，四层表里也有“物理链路”一行，可 GLM 段没说各组走哪条链路。`01` §A0.2 101 行写明 TP 组“走机内 HCCS”，[硬件设备](hardware-devices.md) 59、82 行写了机内 HCCS、跨机 RoCE。正文也一次都没有链到 hardware-devices，尽管 relation 写了 builds-on。**改法**：在 88 行 TP 组后补“走机内 HCCS”，EP / DP 跨机部分写“跨机经 RoCE，链路规格见 [硬件设备](hardware-devices.md)”，带宽数字不在本页重复。

**P3**

1. 88 行在“EP / MC2 组”里先用了 MC2，直到 98 行才解释，属于先用后讲。改法：88 行写“EP 组（MC2 通算协同也用它，见下文）”，或把 MC2 的一句解释前移。
2. 96 行“四路残差流”没有解释。改法：删去这半句，或写成“GLM 把隐藏向量复制成 4 条并行残差流（mHC），但 TP 归约只对子层输出 [T,4096] 做一次”。
3. 67 行表格里 TP / EP / DP 首次出现，没有链接；旧页指向张量并行的链接也丢了。改法：在这一行给三者分别链到 tensor-parallel / expert-parallel / data-parallel。
4. 104 行“请求什么时候进入模型仍由推理调度器决定”，可以补回旧页指向 short-request-first / batch-job-aware-scheduler 的链接。
5. 对照源码里可以补一句：AI QoS 的端点与交换机配置不随推理进程退出而还原，要显式执行 `unset` 并在交换机上执行 undo 命令。
6. 直觉图：全部箭头都是双向，“请求向下”的方向只靠小字说明；标题是“CANN 与 HCCL”，图里却没有画出 CANN 的边界，只在脚注里提了一句。改法：请求方向用单向箭头，结果返回另画一条回线，或加虚线框把 HCCL 圈在“CANN”里；图注和脚注文字重复，删掉一处。
7. 90 行“DP 执行组”是本页自创的叫法，建议改成“两个 DP rank（各自一个 EngineCore，管 8 张卡）”，与部署页一致。98 行“AllGather 路径”与 68 行“All-Gather”拼写不一致，应说明前者是 MoE 通信方式的名称。
8. 流程图（`cann-hccl-2.png`）中“All-to-All 返回后按接收维拼接”这段说明放在 MC2 竖线旁边，容易被当成 MC2 的说明。应移到 All-to-All 框的右下方。
9. 本页已经达到写作标准，建议协调者把 `cann-hccl` 加进 `standard-pages.json`，让 audit 真正守住它。这一项不属于本页修改范围。

## P5 修订记录（2026-09-28）

按上一节「P5 审查（09-28）」逐条修订。只改了 `wiki/concepts/cann-hccl.md`、`wiki/diagrams/cann-hccl.yaml`、`wiki/diagrams/cann-hccl-flow.yaml` 和两张重新生成的 SVG，没有做 git 提交。以下行号都是修订后页面的行号。

### P1

- **qos_priority 补回版本差异**（189、191 行，会报什么错 166 行，源码位置 205 行）。先在 `baa023ad` 源码里核实：`kv_transfer/utils/utils.py` 18–26 行 `PD_QOS_DEFAULT = 1`、`inject_qos` 只收 0–4 的整数（`type(qos) is not int` 同时挡住布尔值），否则抛 `ValueError`，合法值写进 `ASCEND_GLOBAL_RESOURCE_CONFIG` 的 `comm_resource_config.qos`；`kv_p2p/mooncake_connector.py:2188`（以及 hybrid 1726、layerwise 1234）在建传输引擎前调用它；`kv_pool/ascend_store/backend/base.py` 19–35 行校验 KV 池的同名字段，不填返回 None；`mooncake_backend.py` 132–181 行写 `store.comm_resource_config.qos`，`memcache_backend.py` 150–168 行写 `MF_DEVICE_UB_QOS`。官方教程 `pd_disaggregation_mooncake_multi_node.md` 219–275 行写明发起端决定通道 QoS（pull 用 D 侧、push 用 P 侧），以及 `Injected ...` 日志只证明环境写入。`2c59ff10`、`2ed6cbba`、`db701c1f` 的 `vllm_ascend/` 下 grep 为 0（`tools/ai_qos.py` 里命中的是 `aiqos_priority`，不是这个字段）。
- 版本表加一行“推理引擎内的 KV 传输 QoS 入口：无 / 无 / 有”；表后一段写清三个连接器、KV 池两种后端各写哪个键，0–4 与 AI QoS 的等级、VL、交换机优先级是两套编号，以及 GLM 主线没有配置 KV 传输（`02` §6.4 685 行：`kv_transfer_config is None`），用不到这个入口。frontmatter 新增来源 [C23][C24][C25][S26][C27][C28]。

### P2

1. **术语改为链接、不重新定义**：57 行 rank 链到 `collective-communication.md#两张卡交换以后各自手里多了什么`，All-Reduce 链到 `#all-reduce`，只留“做完后两张卡都拿到对应位置之和”这半句提示；63 行“集合通信”首次出现加链接；76 行 All-Gather 链到 `#all-gather`；114 行 Reduce-Scatter 链到 `#reduce-scatter`，删掉“求和后各留一片”的定义，并链到 `#大批输入为什么改用-reduce-scatter`。98 行写明“下文的编号都是全局 rank：机器 0 上是 0–7，机器 1 上是 8–15”，消除与 DP 组 {0,8} 的矛盾。
2. **dispatch 传 int8**：88 行新增一段。TP 归约是 BF16，每元素 2 B；MoE dispatch 发 int8 隐藏向量加每个 token 一个 FP32 缩放系数，每个 (token, 专家) 副本 4,100 B；combine 收回 BF16。数字取自 `02-forward.md` §6.4 683 行（`quant_mode=2`、`torch.int8` / `torch.float32`）和 691–692 行（4,100 B / 8,192 B），字节账链到 `one-request.md#一次前向的通信账`（381 行 ≤ 32,800 B），本页不重算。129 行误解改为“TP 归约仍传 BF16，只有 MoE dispatch 这一段改传 int8 加缩放系数，combine 仍是 BF16”。为了不先用后讲，88 行没有提 MC2，只在这里首次解释 MoE。
3. **GLM 段各组走哪条链路**：98–104 行把分组改成三条列表。TP 组全在机内，走 HCCS（`01` §A0.2 101 行）；DP 设备通信组两端分处两台机器，只能经 RoCE（[硬件设备] 59 行）；EP 组发往另一台的部分经 RoCE（[硬件设备] 82 行）。**EP 组机内部分没有写成 HCCS**：`db701c1f` 的 `token_dispatcher.py` 115–117 行注释写明，A2 上设 `HCCL_INTRA_PCIE_ENABLE=1`、`HCCL_INTRA_ROCE_ENABLE=0` 可以改变机内走法；`02` §6.4 697、769 行写明教程没有设置这两个变量，HCCL 在 A2 上是否自动分层仍待核。所以正文写“取决于 HCCL 机内设置与 MC2 算法，本部署实际路径仍待核”，页末“待核”也补了这一项，来源加 [C29]。带宽规格只链到 `hardware-devices.md#官方带宽规格能说明什么`，不重复数字。

### P3

1. MC2 先用后讲：98–102 行的组名改成“EP 组”，写“下文的 MC2 也在这个组里执行”。
2. 四路残差流：112 行改成“GLM 把隐藏向量复制成 4 条并行残差流（mHC），但 TP 归约只对子层输出 [T,4096] 做一次”，依据 `02` §2 161 行。
3. 75 行 TP / EP / DP 分别链到 tensor-parallel / expert-parallel / data-parallel；relations 补回 `tensor-parallel`（builds-on）。
4. 120 行补回 ShortRequestFirst、Batch-Job-Aware Scheduler 的链接。
5. 158 行补一句：脚本在推理任务之前单独运行，推理进程退出后配置照旧生效，要显式执行 `unset` 并在交换机上执行 `undo`。依据：固定指南 66–70 行“How to disable”，`tools/ai_qos.py` 28 行状态文件，脚本里没有退出时自动还原的逻辑。
6. 直觉图 `cann-hccl.yaml`：请求改为单向实线箭头向下，结果另画虚线箭头向上；每侧加一道 “CANN” 框把 HCCL 圈进去；删掉与图注重复的脚注，改为两条短图例（实线交出请求、虚线交回结果）；画布高度 420 → 390。63 行正文同步改成“沿实线箭头向下看……虚线箭头表示结果交回”。
7. 106 行“DP 执行组”改成“DP2 的两个成员各起一个 EngineCore（引擎进程），各管本机 8 张卡”，与部署页 253–263 行一致；114 行说明“AllGather”是 MoE 通信方式的名称（源码 `MoECommType.ALLGATHER`，`ascend_forward_context.py@db701c1f` 27–31 行），不是单指一次 All-Gather 操作。“两台合起来才持有完整的路由专家集合”一句挪进 EP 组条目，作为 EP 组要覆盖 16 个 rank 的理由。
8. 流程图 `cann-hccl-flow.yaml`：“All-to-All 返回后按接收维拼接”合成一行，移到 All-to-All 框右下方 (398, 545)，远离 MC2 竖线（x = 670）。
9. 把本页加进 `standard-pages.json` 需要改 `scripts/`，不在写手范围内，**未处理**，留给协调者。

### 验证

- 写作标准（scratchpad `std-one.mts` 单页跑 `checkStandard`）：2348 → 2778 字，行内代码 0/千字，角标 0，对照源码结构合格，calc 0，相邻块 0，图先行、免责 1.2%、图宽全部通过。
- 出链：scratchpad `anchor-check.mts` 用 `src/content/wiki/anchors.ts` 的 slugger 逐个解析本页 30 个 `.md` 出链：0 个坏链、0 个坏锚点。
- `pnpm wiki:diagrams`：两张图重新生成，本页图没有 problem；flow 图的两条代码名提醒是原有的，这张图放在「对照源码」里。`pnpm wiki:diagrams --check`：163 张图与 spec 一致。
- `pnpm wiki:audit`：exit 0，本页 evidence=C，7 节，来源 29 条，行号全部有效。
- `pnpm wiki:lint`：exit 1，只有 `hardware-devices.md` 的 source-domain 一处，与本页无关；本页没有报错。
- 没有截图、没有起服务；两张图改版后的实际观感，要在浏览器验收环节用 `pnpm wiki:figshots cann-hccl` 看。

## P5 复审（09-28）

快速复审，只核对上一节「P5 审查」中 P1、P2 的修订是否落实。读法：正文 52–131 行分段读；「对照源码」只用 grep 看了命中行（144、146、156、166、181–193、202、205 行），没有通读；frontmatter 来源区、代码块、HANDBOOK 没有读。以下行号都是当前页面 `wiki/concepts/cann-hccl.md` 的行号。

**结论：P1、P2 全部落实，没有发现新的 P1 / P2。分数 9 / 10（上一轮 7 / 10）。**

| # | 核对项 | 结果 | 位置与证据 |
|---|---|---|---|
| 1 | P1 qos_priority | 落实 | 189 行版本表“推理引擎内的 KV 传输 QoS 入口：无 / 无 / 有，整数 0–4”；191 行写明只由 PD 分离的三个 Mooncake 连接器和 KV 池后端读取、不填时 P/D 默认 1、0–4 与 AI QoS 的等级 / VL / 交换机优先级“不是同一套编号”；166 行写非法值（含布尔值）抛 `ValueError`、覆盖原值打 warning、`Injected` 日志的含义；205 行源码位置写明 v0.23、v0.26、固定快照都没有。源码核对（`git show baa023ad:`）：`kv_transfer/utils/utils.py` 18–26 行 `PD_QOS_DEFAULT = 1`、`QOS_MAX = 4`、`type(qos) is not int or not 0 <= qos <= QOS_MAX` 时抛 `ValueError`，34–41 行覆盖并 warning；`mooncake_connector.py:2188`、`mooncake_hybrid_connector.py:1726`、`mooncake_layerwise_connector.py:1234` 以 `get_from_extra_config("qos_priority", PD_QOS_DEFAULT)` 调用 `inject_qos`；`kv_pool/ascend_store/backend/base.py` 15–16 行 `QOS_VALUE_MIN = 0`、`QOS_VALUE_MAX = 4`，27–35 行缺省返回 None、布尔或越界抛 `ValueError`。`git grep qos_priority` 在 `2c59ff10`、`2ed6cbba`、`db701c1f` 的 `vllm_ascend/` 下均为 0 个文件。页面表述与源码一致。 |
| 2 | rank 等术语改为链接 | 落实 | 57 行 rank 首次出现链到 `collective-communication.md#两张卡交换以后各自手里多了什么`（该节 48 行定义 rank），All-Reduce 链到 `#all-reduce`，只留“做完后两张卡都拿到对应位置之和”半句提示；63 行“集合通信”首次出现加链接；76 行 All-Gather、114 行 Reduce-Scatter 均链到对应 H3，114 行不再下定义。页面其余 rank 出现处（98、100、102 行）只是使用，不再定义；98 行写明“下文的编号都是全局 rank”，与 DP 组 {0,8} 不再矛盾。锚点对照目标页标题：46、80、88、96、185 行都在。 |
| 3 | dispatch 数据 | 落实 | 88 行：TP 归约 BF16 每元素 2 B；dispatch 发 int8 隐藏向量加每 token 一个 FP32 缩放系数，每个副本 4096 B + 4 B = 4,100 B；combine 为 BF16；字节账链到 `one-request.md#一次前向的通信账`，本页不重算。与底稿 `02-forward.md` §6.4 683 行（`quant_mode=2`，`torch.int8` / `torch.float32`）、691 行（4,100 B）、692 行（combine 8,192 B BF16）一致。129 行误解同步改好。 |
| 4 | GLM 各组链路 | 落实 | 100 行 TP 组 {0…7}/{8…15} 走机内 HCCS（底稿 `01` 101 行）；101 行 DP 设备通信组 {0,8}…{7,15} 两端分处两台机器，经跨机 RoCE；102 行 EP 组发往另一台的部分经 RoCE，机内部分“取决于 HCCL 在 A2 上的机内设置与 MC2 的通信算法……仍待核”（依据 `02` 697 行：教程未设 `HCCL_INTRA_PCIE_ENABLE` 等变量）；207 行页末“待核”也列了“EP 组机内部分的实际链路”。104 行带宽只链到 `hardware-devices.md#官方带宽规格能说明什么`（目标页 86 行存在），不重复数字。 |
| 5 | 两张新图 | 落实 | `cann-hccl.yaml` 画布 860×390，`cann-hccl-flow.yaml` 860×710，均 ≤900；生成的 SVG `viewBox` 同为 `0 0 860 390` / `0 0 860 710`。直觉图 SVG 里 4 条向下实线箭头（框架→HCCL→卡）、4 条向上虚线箭头（卡→HCCL→框架）、1 条双向横线（物理链路），yaml 8–9 行两道 CANN 框圈住 HCCL，30–31 行图例“实线：交出请求 / 虚线：交回结果”，与正文 63 行“沿实线箭头向下看……虚线箭头表示结果就绪后交回”一致。流程图 A0 初始化→建组→A4 分流到普通设备通信器 / MC2 专用入口→汇合到“取得结果”，与正文 94、128 行一致；“All-to-All 返回后按接收维拼接”在 (398, 545)，已离开 MC2 竖线（x = 670）。 |
| 6 | `pnpm wiki:audit` | 通过 | exit 0。本页：evidence=C，7 节，来源 29 条，写作标准 2778 字，行内代码 0.0/千字、角标 0、对照源码、calc、相邻块、图先行、免责 1.2%、图宽全部 ✓；本地来源行号全部有效，只有两条 hiascend URL 按惯例未联网验证。本页已在 `scripts/wiki/standard-pages.json` 16 行名单里，全库“名单 15 页，达标 15 页”。 |

**P3（可选，不影响分数判断）**

1. 流程图 35 行的注释“All-to-All 返回后按接收维拼接”紧贴 All-to-All → torch.distributed 的向下箭头（x = 385），而这条箭头表示提交方向，“返回后”没有对应的回程箭头。读者可能以为拼接发生在提交之前。改法：把注释挪到 torch.distributed 框右侧、靠近“取得结果”的回程一段，或写成“通信返回后再按接收维拼接”。

**本轮没有核的内容**：上一轮 P3 第 5 条（158 行 AI QoS 需显式 `unset` 与交换机 `undo`）在「对照源码」正文里，按读文件纪律没有通读；两张图只核了 spec 与 SVG 属性，没有在浏览器里看实际渲染效果。
