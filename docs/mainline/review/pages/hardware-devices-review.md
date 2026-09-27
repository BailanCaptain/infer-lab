# hardware-devices 审查与写作记录

## P5 写作记录（2026-09-28，第 02 批，接续半成品）

### 为什么改、改了什么

在本轮读取到的半成品上续写；改前副本保存在 `tmp/hardware/before.md`。原页只有硬件层级、软件设备、产品系列、内存池化与两个源码 H3，缺少 A0 挂靠、双机数据流、可靠带宽规格和完整源码对照。

- 首屏解释芯片／板卡／服务器／机柜、Device、主机内存和设备显存、token、矩阵与平台契约；直觉图保持通用两卡示意，补足跨服务器数据连线和软件绑定。
- 按“为何分设备与通信代价 → 一个 token 在双机上怎样走 → 规格数字 → 主机／设备账 → 超节点变体 → 误解 → 对照源码”组织。沿用旧页的设备映射条件、产品系列区别、MemFabric/MemCache、统一编址和远端恢复步骤，没有把搬运合并说明继续留给读者。
- 新增 `hardware-device-startup` 图，表达 A0 选卡与内存检查、失败退出、HCCL 分组、Runner 和 A1 入口的先后关系。源码区补齐固定顺序的五个 H3。
- 修改范围仅本页、两图 YAML/SVG 与本记录；未修改其他页面、src、scripts、tests、来源白名单或共享派生物，未提交 git。

### 数字出处与原始证据

- 2×8 可见设备、每机编号 0–7、全局 rank 0–15、机内 TP8／跨机 EP16：底稿 **01 §A0.1–A0.2**；前端、协调器、引擎和 worker 共 20 个主要进程，其中 16 个占卡，亦来自 §A0.1。分组推导继续链接 D 页，不在本页重算。
- 每卡权重主体 20.58 GiB：**01 §A0.3** 的结论，其指定完整账为 02 §1.3；读者只链接 D 页的“每张卡上放了什么”。64 GB 官方规格与 D 页 64 GiB 教学假设分开解释，未改动 D 页算例。
- 先读用户硬件研究目录的 `whole/VERIFICATION.md`、`whole/README.md`、`whole/reference/huawei.html` 与 `atlas800t.pdf`，再查本库 cann-hccl、tensor-parallel 和 sources。既有 Wiki 只给 HCCS/RoCE 定性关系，没有可直接复用的同口径速率。
- **HCCS**：华为《Atlas 800T A2 训练服务器 技术白皮书》，版本 **16，2026-05-12**，§5.1 表 5-2，印刷页 **37**／PDF 第 **46** 页。每路处理器 7 条 HCCS，最大理论带宽 **392 GB/s**，8 路 Full mesh。使用 PyMuPDF 提取并渲染，实际查看规格页图像；不是把其他型号或二手文章里的数字搬过来。
- **RoCE**：同白皮书表 5-1，印刷页 **36**／PDF 第 **45** 页给每处理器 200GE 直出接口；联网打开华为 Atlas 800T A2 官方产品页，技术规格给整机 **8×200GE QSFP、RoCE**。本页新增的唯一 calc 为 **200 Gbit/s ÷ 8 = 25 GB/s**，只换算单端口规格速率。
- 页末 sources 直接保留华为原始链接；正文明确为规格峰值、非实测，392 GB/s 统计七条链路，白皮书该表未明确单向／双向，因而不算倍率、不宣称为任意两卡单链路速率。
- 用户目录的 VERIFICATION 是原硬件可视化项目的验收记录，未当成 NPU 链路实测。教程仅写 Atlas 800 A2，引用的规格型号明确为 Atlas 800T A2；现场型号仍待核。

### 核心概念与源码核对

- Device 枚举、选定设备后查询内存及系统预留：保留 CANN 官方 API 来源；CPU/NPU 的计算职责对照官方 CANN 介绍。
- 设备身份与可见变量：`vllm-ascend@db701c1f:platform.py#L128-L138`；选卡、内存快照和错误分支：`worker.py#L439-L524`；预算：`#L527-L597`；HCCL 与并行组：`#L975-L988`，均实际读取。
- rank 偏移、TP/DP/EP 组：`vllm@0fc695fc:parallel_state.py#L1535-L1560`、`#L1758-L1772`、`#L1833-L1875`。All-Reduce 的“先本地部分和，再合齐”由独立审查者对照 `RowParallelLinear.forward` 核对。
- 三版按 HANDOFF 与 seeds 钉点实际读取平台文件：v0.23 `2c59ff10`、v0.26 `2ed6cbba` 都主动拒绝平台总显存查询；main `baa023ad` 在 NPU 初始化后才允许查询。三版设备类型／可见变量与查询默认设备号也逐项核对。`verified: []` 保留，因为本页仅对照上述接口，未声称三版完整部署均验证。
- MemFabric/MemCache 保留旧页事实和原官方来源，本轮该文章的 web 访问失败，明确放入待核，不把访问失败写成已重新核验。

### 独立审查与修订

依写作标准由独立审查者 `/root/hardware_review` 只读审阅正文、改前副本、实际 diff、两图 YAML/SVG、白皮书规格截图及钉住源码。

| 级别 | 发现与影响 | 修订及复审 |
| --- | --- | --- |
| P1 | 初稿把 All-Reduce 放在“输出合并后”，颠倒了归约与合并的关系 | 改为输出／降维投影各自产生部分和后，分别 All-Reduce 合齐；独立复审关闭 |
| P2 | MoE、HBM 先使用后解释 | MoE 首次出现即定义；前文不再提前使用 HBM；独立复审关闭 |
| P3 | 首图图例把单向“运行时绑定”也说成数据传送 | 正文、YAML caption、SVG 标题与无障碍说明同步区分双向传数据／单向绑定；独立复审关闭 |

审查者前两屏复述通过：物理层级与软件设备边界清楚，多卡分摊存储／计算并引入传送和等待。最终复审还查看了 screen-01/02/03/05，未发现新的问题；未冒充桌面浏览器操作验证。

### 统计与实际验证

字数按项目 `standard.ts`：**汉字数＋拉丁单词数**，不含 frontmatter、链接 URL 和围栏块；不是 Markdown 文件字符数。

| 范围 | 改前 | 改后 |
| --- | ---: | ---: |
| 教学正文（“对照源码”之前） | 1047 字 | 2809 字 |
| 含源码区的全文 | 1219 字 | 4314 字 |
| 教学正文行内代码 | 1 处 | 0 处／千字 |
| 教学正文证据角标 | 4 处 | 0 处 |
| calc | 0 | 1，0.356 个／千字 |

首图围栏在页面第 49 行，图前 calc 为 0；图前没有容量、带宽或部署数量，只有挂靠名称 A0（目标链接 URL 中还含模型版本号）。两图宽度 840／820px。全文角标 21 处，C 级 14／21＝66.7%；全文行内代码 23 处，5.33 处／千字。自动免责词统计的教学正文为 2／80 句＝2.5%；全文为 4／122 句＝3.28%，多出的限制集中在源码区和待核，保留真实证据缺口。单独调用 `checkStandard` 检查本页，问题数 **0**；未通过改名单或跳过规则达标。

最终实际运行（Windows 用 `pnpm.cmd` 避开 PowerShell 对 pnpm.ps1 的执行限制）：

| 命令／检查 | 结果 |
| --- | --- |
| `pnpm.cmd check:content` | 通过，registry 131 页 |
| `pnpm.cmd wiki:diagrams --check` | 通过，158 张图与 spec 一致；本页两图定向 `figureProblems` 均为空 |
| `pnpm.cmd wiki:audit` | 通过，131 页、1459 条本地行号有效，无无效 commit／路径／越界；URL 内容与 raw 摘录语义不属于该命令通过范围 |
| `pnpm.cmd wiki:lint` | **未通过，剩 1 项**：本页两个 `e.huawei.com` 官方 URL 未在 `scripts/wiki/sources.ts` 白名单中 |

本轮发现的本页重复 relations 已删除。验证期间其他写手的 device-memory 页曾出现 schema／图重叠／重复关系，导致首轮全库检查和页面加载失败；本轮未触碰它，最终这些错误已消失，故不把早期失败冒充当前阻塞。

4174 服务使用 `--strictPort`，没有操作 5193／8790。桌面 Computer Use 返回 **“Computer Use was not approved to use Google Chrome”**，未进一步说明原因，故停止桌面输入。改用隔离的 **headless Chromium，1440×1000** 进行页面测试：

- 从头到尾保存并逐张查看 **8 张逐屏截图**；前两屏、两图、三表、calc 和来源区均可读。
- 页面 clientWidth／scrollWidth 均为 1440；三表均为 1034／1034，无横向溢出；未捕获 pageerror。
- 去重后 22 个站内目标成功加载，所有带锚点链接都存在对应标题。
- 实际点击首屏 A0 链接，等待目标标题更新，目标小节位于 viewport 顶部 16px；记录为 `clicked-a0.png` 和 `browser-check.json`。
- 这是隔离浏览器实测，不等同于已完成受限的桌面 Chrome 人工操作验收。

截图和浏览器记录：

`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\13898c74-f916-4e2c-8924-fe9bf130f160\scratchpad\p5\hardware-devices\`

最终截图为 `screen-01.png` 至 `screen-08.png`、`clicked-a0.png`；`browser-blocked-1440.png` 只保存早期 schema 错误，不代表最终页面。命令输出存于 `tmp/hardware/*-final.log`，本页统计存于 `tmp/hardware/metrics.json`。

验证结束后已关闭本轮 4174 服务；会话退出，端口无监听，TCP 连接探测返回非零。`git diff --check` 检查本页及修改图通过，仅提示既有 CRLF 将规范为 LF。

### 取舍、仍待核与集成事项

1. **来源白名单冲突**：用户明确要求使用华为官方规格，且限定只改本页及图。保留可靠原始来源与 C/S 证据，不降级为推断，也不越界修改 `scripts/wiki/sources.ts`、HANDBOOK 或测试。须由协调者按仓库流程确认华为企业官网官方域名后更新白名单；在此之前不能称全套验收通过。
2. **桌面验收**：Chrome 访问被工具拒绝，已完成隔离浏览器验收；桌面操作仍待补。
3. **旧材料矛盾**：教程概览“64GB×16”与双机操作节每机 8 卡的差异只报告并保留，不改官方原文或其他页面；64 GB 规格与 64 GiB 教学假设分别标明，没有擅改底稿账单。
4. **事实待核**：现场完整型号／设备映射／可用显存；392 GB/s 的方向口径；真实 HCCS/RoCE 有效带宽与推理延时；MemFabric/MemCache 原文访问和支持条件。全部留在读者页末。

正文续写、独立审查修订与可执行的验证已落实；全套验收尚差来源白名单集成和桌面操作两项。没有请求用户决定新内容方向。

## P5 审查（09-28）

独立审查者，只读不改页面。审查对象：`wiki/concepts/hardware-devices.md`（195 行，工作区未提交）、`wiki/diagrams/hardware-devices.yaml/.svg`（已改）、`wiki/diagrams/hardware-device-startup.yaml/.svg`（新增未跟踪）、本记录 P5 写作段。未打开桌面浏览器，页面渲染只核 YAML/SVG 与工具输出，写手的隔离浏览器记录不作为我的证据。

**评分：8.5 / 10。** P1 0 项，P2 2 项，P3 4 项。

### 1. 初学者测试（只读前两屏）

通过「是什么、代价在哪」这一关：第 45–53 行给出芯片 → 板卡 → 服务器 → 机柜的物理包含关系，并把 Device 说成运行时暴露、程序要选定的软件边界；第 57–61 行用每卡权重 20.58 GiB 说明为什么要分卡，并说清分完之后结果要过链路、下一段计算要等它到齐。HCCS（机内）与 RoCE（跨机）在第 59 行各自定义，HCCL 与链路分层说清。

但「为什么 TP 放机内、EP 跨两台」这个结论不在前两屏：它出现在第 82 行（机内合算矩阵、跨机寻找专家）和第 105 行（反复同步利用机内互联 / EP 跨机换容量）。第二屏已经有 HCCS=机内、RoCE=跨机、TP=切矩阵、EP=分专家四个零件，缺半句把它们连起来。记 P3-a。

### 2. 硬件数字：出处、口径、与研究目录的一致性

逐个核到原始件，全部标明规格峰值／实测：

| 数字 | 页面位置 | 我核到的原始证据 | 口径 |
|---|---|---|---|
| HCCS 392 GB/s、每路处理器 7 条链路、8 路 Full mesh | 第 92 行 | `whole/reference/atlas800t.pdf` 用 `pdftotext -f 46 -l 46` 提取：表 5-2 出现 `AI7HCCS392GB/s` 与 `NPU8AIHCCS8P Full mesh`；同页页脚 `16 (2026-05-12) … 37` | 页面写明「规格峰值，不是实测值」，并禁止当成任意两卡单链路速率（第 95 行）✓ |
| RoCE 每接口 200 Gbit/s、整机 8 个 200GE QSFP | 第 93 行 | 同 PDF 第 45 页（页脚印刷页 36）表 5-1 含 `200GE QSFPRoCE`；`whole/reference/huawei.html:2692` 技术规格「8 * 200GE QSFP接口直出，RoCE协议」 | 规格峰值，且「NPU 可直接引出接口」有 html 的「直出」支持 ✓ |
| 25 GB/s | 第 101 行 calc | 200 ÷ 8 的单位换算，页面注明十进制、未扣协议开销 | 换算值，非实测 ✓ |
| 设备容量 64 GB | 第 115 行 | PDF 第 45 页表 5-1 `64GB`（同格另有 `1600GB/s` 内存带宽，页面未引用） | 规格；与 D 页 64 GiB 教学假设分别标明 ✓ |
| 每卡权重 20.58 GiB | 第 57 行 | `glm-5-3-flash-two-node.md:111`、`:177` 均为 21,078 MiB ≈ 20.58 GiB | 一致，本页只给结论并回链 ✓ |
| 20 个主要进程 / 16 个占卡 worker | 第 109 行 | `glm-5-3-flash-two-node.md:255`、`:266`「合计 20 个进程，其中 16 个占卡」 | 一致 ✓ |
| 前 3 个稠密层 | 第 61 行 | `glm-5-3-flash.md:108`、`:220` 前 3 层稠密 MLP | 一致，但用法有问题，见 P2-1 |
| 2×8 可见设备、rank 0–15、TP8/DP2/EP16 | 第 72、76 行 | 钉住教程 `0576b647:docs/source/tutorials/models/GLM5.3-Flash.md:241`「2 Atlas 800 A2 (64GB × 8) nodes with DP2 … TP8 inside each node」；rank 偏移见 `vllm@0fc695fc:parallel_state.py:1547` `rank = data_parallel_rank * world_size + rank` | 一致 ✓ |

与用户硬件研究目录的一致性：`whole/VERIFICATION.md`（12 行）是 2026-09-06 三维可视化项目的验收记录，**没有任何带宽、链路或显存数字**，因此不存在数字冲突；页面也没有把它当链路实测（写作记录第 22 行已说明）。可比的结构数字只有 `VERIFICATION.md:6` 的 `Atlas 8 NPU / 4 CPU / 32 DIMM`，与本页每机 8 个可见设备、`huawei.html` 的 4×鲲鹏920/32 DIMM 一致。`whole/README.md:29` 自称「没有把旧项目的未核验 HCCS 连接补成真实布线」，与首图 caption「不对应特定产品布线」方向一致。

### 3. 写作记录里的矛盾，逐条核

1. **来源白名单 vs 官方规格**（记录取舍 §1）：真实存在。`pnpm wiki:lint` 输出 `x concepts/hardware-devices.md [source-domain] https://e.huawei.com/... 不在可引来源白名单里，撑不起 evidence C`。写手选择保留华为一手来源、不越界改 `scripts/wiki/sources.ts`，并写明「在此之前不能称全套验收通过」——如实、清楚。但结论仍是仓库门禁红的，见 P2-2。
2. **教程 64GB × 16 与每机 8 卡**（记录 §3、页面待核第 194 行）：核到教程 `0576b647` 第 21 行 `2 Atlas 800 A2 (64GB × 16) nodes` 与第 241 行 `(64GB × 8) nodes`，两处确实冲突；`wiki/sources/glm-5-3-flash-baseline.md:116` 已记为未获作者澄清。页面按操作节固定 2×8 并回链基线，处理如实。
3. **64 GB 规格 vs 64 GiB 教学假设**：页面第 115 行明确基数不同、不可互换，没有改 D 页算例，如实。
4. **392 GB/s 未标单向／双向**：页面第 95 行说明白皮书表 5-2 未给口径，因此不算倍率；待核第 193 行保留。我在 PDF 上确认该表确实只给「最大理论带宽」一项，没有方向标注——如实。
5. **MemFabric/MemCache 原文访问失败**：页面来源索引第 183 行与待核第 195 行都写明本轮访问失败、沿用原页事实，没有冒充重新核验，如实。
6. **桌面 Chrome 被拒 → 隔离 Chromium**（记录 §2）：记录明确说「不等同于桌面人工验收」，没有把工具通过说成人工验收，如实。我本轮同样没有做桌面验收。
7. **型号**：教程写 Atlas 800 A2，规格引 Atlas 800T A2，页面第 88 行与待核第 192 行两处披露。披露到位但不够具体，见 P3-c。

### 4. 格式与自动检查（实际运行）

用仓库自己的 `checkStandard` 单页核（`scripts/wiki/standard.ts` + `standard-pages.json`，tsx 直接调用）：

```
2809 字 · ✓行内代码 0.0/千字 · ✓角标 0 · ✓对照源码 · ✓calc 0.36/千字 · ✓相邻块 0 · ✓图先行 · ✓免责 2.5% · ✓图宽
problems: 0
```

九项全过，与写作记录自报一致。直觉图围栏在第 49–51 行，落在第 1 个 H2、第一个 calc（第 99 行）之前；`对照源码` 五个 H3 顺序与 `sourceSubsections` 完全相同，其后无 H2；两图 840/820px。版本差异表（第 165–169 行）逐格核过钉住源码：`2c59ff10` 与 `2ed6cbba` 的 `get_device_total_memory(device_id: int = 0)` 都直接 `raise NotImplementedError`，`baa023ad` 改为未初始化才抛、已初始化则 `torch.npu.mem_get_info(device_id)` 返回总量；三版 `NPUPlatform` 的 `device_type="npu"`、`device_control_env_var="ASCEND_RT_VISIBLE_DEVICES"` 一致；三个 commit 与 `wiki/seeds/*.yaml`、`HANDOFF-LLM-WIKI.md:246` 的钉点相符。源码区其余引用也核了实体：`db701c1f:worker.py:439-440` 是 `DP adjusted local rank … is out of bounds` 原串，`:505-524` 确实是 `init_device()` 建 ModelRunner（对应来源索引的 [C10] 创建 Runner），`:975-988` 是 `_init_worker_distributed_environment` 里的 `init_distributed_environment(..., "hccl")` 与并行组初始化——启动图的先后顺序与代码一致。

命令（Windows，Bash 工具内直接 `pnpm`）：

| 命令 | 结果 |
|---|---|
| `pnpm wiki:audit` | **整体失败，但与本页无关**。本页 21 条来源全部 ✓（行号有效、无越界），无页面级问题；失败项是其他写手工作区里的页，两次运行结果还不同：一次 `concepts/token.md [schema] relations.kind=related`，一次 `concepts/matmul-and-weights.md [diagram-missing]` + `concepts/cann-hccl.md [schema]`。本页不在 `standard-pages.json` 名单内，写作标准对它只统计不强制。 |
| `pnpm wiki:lint` | 失败 10 处，其中 **1 处属本页**：`[source-domain]` 两个 `e.huawei.com` 未白名单。其余 9 处是 matmul-and-weights / embedding / glm-5-3-flash / token / quantization / tensor-parallel 的既有问题。 |
| `pnpm wiki:diagrams --check` | 失败 1 处，`diagrams/matmul-shapes.yaml` 重叠，非本页；本页两图无报错。 |

### 5. 链接

用页面自己的 `headingSlug`/`createSlugger`（`src/content/wiki/anchors.ts`）对全页 16 条站内链接逐条解析，**全部命中**，含指定的三条：`tensor-parallel.md#切开以后要付的代价`、`expert-parallel.md`（无锚点）、`glm-5-3-flash-two-node.md#部署前提`；其余 `#启动时发生了什么`、`#每张卡上放了什么`、`#16-张卡怎样分组`、`#剩下的显存变成多少-kv-cache`、`#为什么是两台机器不是一台`、`#怎么开`、`one-request.md#示例请求-r1-与官方双机部署`、`one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节` 及 5 个无锚点页面链接也都存在。注意 `wiki:lint` 只校验链接的文件部分，锚点不在它的覆盖范围内，所以这一条靠上面的脚本核实。

### 6. 问题清单

**P2-1（正文，第 61 行）：把 TP 的 All-Reduce 局限在「前 3 个稠密层」，低估逐层同步频次。** 原句「在 GLM 的前 3 个稠密层中，attention 的输出投影、前馈网络的降维投影各自产生部分和后，分别做一次 All-Reduce」，随后只说 MoE 层「还需」派发。但 `tensor-parallel.md:105` 写明稀疏 MLA 层（都在 MoE 段里）的 attention「同样只做一次 TP All-Reduce」，即 attention 的归约 45 层都有。影响：这是本页论证「TP 放机内」的唯一动机数字，读成 3/45 层才同步会得出相反印象。不是陈述假命题，故不记 P1。修法：改成「每层 attention 的输出投影都要一次 All-Reduce；前 3 个稠密层的 MLP 降维再加一次，其余 42 层换成共享专家一次加路由专家的派发／回收」，通信总账继续回链 TP 页。

**P2-2（仓库门禁）：本页新增的两个 `e.huawei.com` 来源不在白名单，`pnpm wiki:lint` 红，evidence=C 目前无工具背书。** 依据即上面的 lint 输出。数字本身出处齐全（我已在本地 PDF 与官方产品页副本上核到），所以不是「数字没有出处」的 P1，而是集成未完成。修法：协调者确认华为企业官网域名后更新 `scripts/wiki/sources.ts` 白名单并复跑 lint；在此之前本页不能宣称全套验收通过（写作记录已这样写）。

**P3-a（第 59–61 行）：前两屏缺一句把 HCCS/RoCE 与 TP/EP 绑起来。** 结论在第 82、105 行。修法：第 61 行末补半句「逐层反复归约走机内 HCCS，专家派发才跨机走 RoCE，原因在下一节展开」。

**P3-b（跨页一致）：本页没有链接 `cann-hccl.md`，而 `tensor-parallel.md:532` 的待核仍写「缺这两台机器的 HCCS / RoCE 端口速率」。** 本页已经给出同型号规格峰值（现场实测仍缺），两处口径应区分开；HCCL 与链路分层的既有出处 `cann-hccl.md:70-72` 也值得从本页第 59 行或 relations 指过去。改 TP 页超出本页范围，留给协调者。

**P3-c（第 88、192 行）：引的是 Atlas 800T A2「训练服务器」白皮书，页面只说「现场完整型号仍须核对」，没点明 T 是训练型号。** 读者容易把训练机规格当成部署机规格。修法：把型号差异说成一句话（教程只写 Atlas 800 A2；本页规格取自 800T A2 训练服务器白皮书，现场型号与同系列其他型号未核），不必新增外部证据。

**P3-d（集成）：本页写作标准 9 项已全部达标，却没进 `scripts/wiki/standard-pages.json` 的 pages 名单，CI 不会拦回退。** 属集成动作，需协调者决定。

### 7. 我这轮没做的事

未开桌面浏览器、未联网核外链（S1–S7 的在线内容与 MemFabric 文章都没验证）；`atlas800t.pdf` 只用 `pdftotext` 抽 ASCII 数字与页脚，PDF 里的中文字形没有 ToUnicode 映射，中文表头没有逐字读出，规格页图像也未渲染查看；HANDBOOK、`docs/plans/`、`wiki/TERMS.md` 按纪律未读；`pnpm check:content`、类型检查与测试未跑。
