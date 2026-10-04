# P5 写作记录（GPT-6 Astra，10-04）

本轮角色：Netloader 新页写手。日期：2026-10-04。本文是写作与自查记录，不充当独立审查结论。

## Why / What

补齐官方 feature_guide 的 Netloader 特性说明，挂靠 GLM 双机启动阶段的权重加载站点。官方钉住文件第一行标题为 **Netloader Guide**，据此使用 kebab-case `netloader-guide`；创建前用 `rg --files -g '*netloader*'` 及 `Get-ChildItem wiki/concepts -Filter 'netloader-guide*'` 查重，无同名页。Netloader、NetLoader、netloader 均保留为检索别名。

本轮仅新增下列交付文件，没有修改目录、已有页面、应用代码、标准名单或计划文件，没有提交 Git：

- `wiki/concepts/netloader-guide.md`
- `wiki/diagrams/netloader-guide-intuition.yaml` 与同名 SVG
- `wiki/diagrams/netloader-guide-flow.yaml` 与同名 SVG
- 本记录

结构：问题式首节与一句话定义 → 第一屏直觉图 → 为什么需要及建链/带宽代价 → 握手、逐张量传输、回退与示意账 → 原始 int8 缓存 → GLM 未启用与条件分析 → 误解 → 对照源码的五个固定 H3。启动代码流程图同时表达主线位置；图全部静态，宽度均为 880 px。没有生成动画。

按新增的直接撰写入口语义设置 `origin: direct`，不补造 raw 或 rawSources。知识依据仍保留实际核读的官方文档和源码。

## 核读依据与结论

| 文件、版本及行号 | 本页承载的结论 |
| --- | --- |
| vllm-ascend@2c59ff10 `docs/source/user_guide/feature_guide/netloader.md:7–97` | 角色、应用场景、配置、两端示例、约 200 MB 缓冲提示与空闲等待建议 |
| vllm-ascend@baa023ad 同路径 `34–98` | main 新增 draft 端口说明及已测模型列表，GLM-5.3-Flash 不在列表中 |
| vllm-ascend@0576b647 `docs/source/tutorials/models/GLM5.3-Flash.md:237–341` | 两端命令使用 safetensors 文件预取，没有选择 Netloader；不臆测教程作者的取舍原因 |
| vllm@0fc695fc `vllm/config/load.py:25–34` | 默认加载格式为 auto，先 safetensors 后 PyTorch 文件 |
| vllm-ascend@db701c1f `vllm_ascend/model_loader/netloader/netloader.py:58–125` | 配置文件替换整份 extra config；字段默认值与类型回退 |
| 同文件 `140–155、230–309` | draft 识别、主模型全局同步、来源缺失与传输失败回退 |
| 同文件 `311–394、419–437` | 监听、int8 原始缓存建立时机、按需后处理；默认量化加载分支 |
| 同仓 `interaction/elastic.py:61–101、173–214` | 连接/注册阶段顺序尝试候选；握手字段和拒绝处理 |
| 同文件 `264–284、310–325、376–421` | int8 副本、单监听线程、仅 rank/路径/TP/PP 核对、发送调用 |
| 同仓 `executor/elastic_load.py:50–161` | 2 进程临时通信组、逐参数 wait、最终 barrier、缓存优先、收发过滤差异 |
| 同仓 `load.py:50–77` | HCCL 失败返回 None，外层回默认加载，不继续轮询其他供方 |
| vllm-ascend@2c59ff10 与 @2ed6cbba `netloader.py:58–437` | 两版本配置与加载行为一致；另用目录 tree hash 确认整个特性实现一致 |
| vllm-ascend@baa023ad `netloader.py:206–240、463–617、626–724` | 本地同步、处理后布局、快照清理、主模型失败后跳过 draft 网络尝试、端口防护 |
| 同仓 main `interaction/elastic.py:459–483` | int8 缓存模式检查、no 路径形状清单 |
| 同仓 main `executor/elastic_load.py:93–155、435–445` 及其清单校验函数 | 参数/buffer/模块属性张量收集、地址去重、非空清单时检查名称与元素数；清单为空则放行 |

对 `2c59ff10 / db701c1f / 2ed6cbba` 运行 `git ls-tree`：Netloader 目录树均为 `6ed0cdb0233c68e4015ce9cc6f700c9ef59c5657`，官方指南 blob 均为 `a4bb5729766719680517192ccae9a73ad1403af6`。main 的目录树为 `9c980588766c4b4f47023a004dafb1b7080806d4`，指南 blob 为 `4c1cb07abbd255fe8b7d00edc8c18d4e172de398`。这仅证明指定目录与文件相同，不泛化成整个发行版相同。

逐字核过错误表的 8 条原文及文件行号。正文明确三处文档/实现差异：MODEL 不参与当前握手调用；CONFIG_FILE 是整份替换；旧版基础端口范围上端不包含 65535，且加 rank/draft 偏移后没有再校验。main 的 no 路径不是旧版“直接发当前参数”的同义配置。

官方在线入口 `https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/netloader.html` 本轮已联网打开，标题与主题核实；技术结论按本地钉住文件撰写，不用漂移的 latest 代替版本证据。GitHub raw 的短提交 URL 曾返回工具 Cache miss；未据此声称外链全部可访问。

## 信息清单：站内零散提及

搜索范围为 `wiki/concepts`、`wiki/params`、`wiki/sources` 下 Markdown，检索 Netloader/netloader、网络权重加载等；排除本次新页。得到两处正文提及：

| 既有页面与行号 | 已有信息 | 主会话后续是否改链接 |
| --- | --- | --- |
| `wiki/concepts/platform-plugin-registration.md:183` | 通用插件调用 register_netloader 与 register_rforkloader；注册前做全局 patch | 建议在 Netloader 名称处链接本页。插件登记机制仍留在原页，不移除该页的注册事实 |
| `wiki/concepts/vllm-ascend-overview.md:119` | 通用入口登记 Netloader 与 RFork 加载器 | 建议把 Netloader 名称链接本页，并确保“装上包就生效”指平台插件接入，不被读成默认启用网络权重加载 |

`wiki/raw/kv-cache-sparse-offload.md:599` 仅为抓取页面导航里的 netloader 项，不是教学正文结论，不改。其他页面没有在本轮被改写。

新页信息勾选：官方角色与使用场景、全部七个配置字段、两端示例、输出比较方法、监听与额外内存、来源匹配、原始 int8 缓存、回退、草稿通道、版本差异均已落页。GLM 数字与分组、显存预算只回链唯一出处；没有加入 GLM 性能倍数。

## Evidence：实测验证与密度

PowerShell 默认拦截 pnpm.ps1，使用等价的 `pnpm.cmd` 运行项目命令，未修改执行策略。

- `pnpm.cmd wiki:lint`：退出码 0，本页 0 报错。检查时全站另有既有页面 mark-flood 提示，不是本页错误。
- `pnpm.cmd wiki:diagrams --check`：退出码 0，298 张图与 spec 一致；本页两图没有越界、重叠或文案提示。仅调用已有 renderer 写出本页两个 SVG，没有批量重绘其他图。
- `pnpm.cmd wiki:audit`：退出码 0；本页 13 个 sources，12 个本地引用有效，1 个教程 URL 的内容由本地对应 commit 核读。全站无无效 commit、缺文件、越界行号、未知仓库。
- 直接调用仓库 `checkStandard` 对本页执行完整规则：`problems: []`。本页不在强制名单中，因此另做此检查，未修改 `scripts/wiki/standard-pages.json`。
- `pnpm.cmd check:content`：退出码 0。该命令报告 registry 139 页；本轮未运行 wiki:build，故不把旧 registry 的成功当新页索引已发布的证明。
- 本页 sources 和图中 pins 由 audit 校验；站内链接、frontmatter 由 lint 检查。summary 长度 97。

字数按 `scripts/wiki/standard.ts` 的口径：汉字逐字计、英文单词计 1、去掉链接目标，不计围栏内容。教学正文（对照源码之前）**2524 字**；含源码区的全文 **5144 字**。Markdown body 原始长度 9954 字符，含空白、链接和围栏，不能与前两项混用。

- 首图围栏在文件第 40 行，位于第一 H2 的定义之后；图前数字算例与 calc 均为 0。
- 两图均 880 px 宽，分别 410 / 735 px 高；YAML 手写，SVG 由项目 renderer 派生。
- 教学正文行内代码 0、证据角标 0；1 个 calc，密度 0.40/千字；表/calc 相邻问题 0。
- 教学正文自动判定免责句 1/73 = 1.37%；该句保留官方的量化输出风险，没有为通过指标删除限制。
- 全文行内代码 20，密度 3.89/千字；13 个证据角标全部位于最后的源码位置小节，C 级 10/13 = 76.92%。
- 对照源码固定五个 H3，之后无新 H2；无超宽图，结构检查全部通过。

早期 lint 遇到并行修改中的其他页面重复 frontmatter、别名冲突；本页没有修其他写手文件，后续全站检查已恢复退出码 0。自查过程中修正了自己的 relation 枚举、图样式枚举，并把推测的空闲等待变量作用改成明确待核。

## Tradeoff / Open Questions

按任务要求未启动服务、未访问 5193/8790、未截图。桌面浏览器的前两屏、图/表/calc 排版、链接点击和独立概念审查由审查员完成；这里没有声称浏览器或 NPU 验收通过。当前写手自查未发现未处理的 P1/P2，仍需独立审查。

真实待核保留在页末：

1. GLM-5.3-Flash 主模型与 MTP 在 Netloader 下的输出一致性、加载耗时、显存峰值。
2. 供方推理与多个接收实例并发取权重时的干扰。
3. 官方指南的 HCCL_BUFFERSIZE 与部署教程 HCCL_BUFFSIZE 拼写不一致，目标 CANN/HCCL 的实际变量与默认值需查目标版本。
4. 官方指南建议 VLLM_SLEEP_WHEN_IDLE，但 `git -C tools/repos/vllm grep -n VLLM_SLEEP_WHEN_IDLE 0fc695fc -- vllm` 和 Ascend 固定提交的同范围查询均无匹配，缺目标镜像消费者证据；示例不把该变量当已核实前提。

**toc 建议：** 在“性能与工程优化”下设“启动与权重加载”位置收录 `netloader-guide`，与容量规划相邻；RFork 仍保留工作版目录，通过 relations 互通。本轮不改 src/。

不需要用户作出实现选择；待办是上述设备证据与审查员的独立验收。

## 审查（10-04）

审查员：Opus 5.5（独立审查，只审不改页面）。对象：`wiki/concepts/netloader-guide.md`（新页，未入名单）。

**分数：8.5 / 10。P1 0 条，P2 5 条，P3 3 条。学习顺序通过；按名单口径自测写作标准全 ✓。**

### 初学者测试（只读前两屏）

我的一句话：Netloader 让新启动的实例直接从已经装好同一份模型分片的旧实例的 NPU 上，按参数顺序把权重复制过来，省掉再读一遍模型文件；代价是建连接、卡间传输和供方额外资源（HCCL 缓冲、可选的 int8 副本），而且只核对 rank、路径、TP、PP，失败就回退读文件。——前两屏能讲出来，通过。

### 骨架与学习顺序

- 问题式 H2 ×6 + 对照源码；一句话定义加粗在第 38 行；直觉图围栏在第 40 行（第一屏实测可见，见截图）；为什么/代价（48–56）；怎么做 + 示意演算（58–81，[2,3] int8 + 长度 2 的 FP16，6 B + 4 B = 10 B，手算无误）；细节（83–89 int8 缓存）；GLM 双机（91–99）；误解（101–107）；对照源码五个 H3 顺序正确（111/145/162/170/190）。
- GLM 数字没有进基础节；GLM 一节只链接部署前提、分组和显存预算，没有重算，没有拿主线吞吐当 Netloader 收益（第 99 行明确否定）。学习顺序**通过**。
- GLM 双机为什么没开：教程命令 `--safetensors-load-strategy prefetch`、未设 load-format（核 0576b647 教程 212/282/332 行），vLLM 0fc695fc `config/load.py:29` 默认 auto——属实。开了会怎样按源码讲（每 Worker 配来源、draft 双通道、全局 barrier、量化需验一致性），没有虚构部署数字。

### 核心机制逐条核对（全部 ✓）

| 页面说法 | 核对 |
| --- | --- |
| 握手只比 rank、模型路径、TP、PP，无哈希、无 EP（64、104） | 2c59ff10 `interaction/elastic.py:362–381` required_keys 与四项比较 ✓；rank 即 `torch.distributed.get_rank()`（db701c1f `netloader.py:222`）✓ |
| MODEL 不参与握手（133–141） | 握手传 `model_config.model`（`netloader.py:360–372`），官方表写成一致性检查名——页面如实标出文档/实现差异 ✓ |
| 2 进程临时组、逐参数 wait、末尾 barrier（52、54） | `executor/elastic_load.py:67–87、134–156` world_size=2、`.wait()`、barrier ✓ |
| 发送跳过 aclnn_input_scale、接收跳过零维（79） | 同文件 84、150 ✓ |
| 候选顺序尝试；HCCL 传输失败回默认，不再轮询（81、105） | `load.py:50–77` 异常/None → 返回 None；`netloader.py:288–289` 回退 ✓ |
| int8 缓存建在后处理之前；hbm 失败降 DRAM；dram 发送前搬回 NPU（87、164） | `netloader.py:359–388`（先建 ElasticServer 后 process_weights_after_loading）；`elastic.py:272–276`；`elastic_load.py:153` ✓ |
| 监听线程串行处理（168） | `elastic.py:318–325、411–421` accept→同步 send ✓ |
| 端口 `range(1024, 65535)`、加偏移后不复检（143） | `netloader.py:314–328` ✓ |
| 报错表 8 条原文 + Finish recv / Finish elastic load | `git grep -F` 于 db701c1f 逐字命中，行号均落在所标区间 ✓ |
| 版本差异：前三提交 Netloader 目录树与指南相同 | `git rev-parse <c>:vllm_ascend/model_loader/netloader` 三者均 6ed0cdb0…，指南 blob 均 a4bb5729…；main 为 9c980588… / 4c1cb07a… ✓ |
| main：no 路径传后处理布局 + 清单 | baa023ad `elastic.py:363–371 register_transfer_manifest`、`netloader.py:510–513` ✓ |
| main 已测模型列表无 GLM-5.3-Flash | baa023ad 指南第 98 行 ✓ |
| 官方建议 temperature=0 比对输出、约 200 MB HCCL 缓冲 | 2c59ff10 指南 89、96 行 ✓ |

版本口径：v0.23 列标为维护分支 2c59ff10 且注明无 GLM 模型实现，db701c1f 单列，v0.26=2ed6cbba，main=baa023ad——正确。

### 信息清单与互链

- 新页无旧版（`p4-checkpoint` 不含该路径）。写手的站内零散提及清单（platform-plugin-registration:183、vllm-ascend-overview:119）我 grep `wiki/concepts|params|sources|src/content` 复核，完全一致，无遗漏。
- 写手的「新页信息勾选」抽 6 条到页面确认：官方场景（50）、七个字段（133–139）、两端示例（115 起）、temperature 0 比对（166）、监听与额外内存（54）、回退（81）——均在。
- 站内分工：Quantization、TP/PP、KV Pool、RFork、投机解码均一句话 + 链接，没有重讲。全库目前**没有页面链到本页**（两处零散提及待主会话改链接，toc 未登记）——不扣分，列入待办。
- frontmatter：`origin: direct`、无 rawSources（grep 计数 0）✓。

### P2

1. **draft 的 int8 缓存被强制成 hbm，页面没讲**（第 99 行 GLM 一节、第 136 行 INT8_CACHE 行）。源码 2c59ff10/db701c1f `netloader.py:360`：draft 模型只要 INT8_CACHE 不是 no 就一律用 hbm，即使配的是 dram。GLM 双机恰好是量化 + MTP，若照页面建议「重新量显存余量」时选 dram，草稿模型仍会占 HBM 副本。改法：INT8_CACHE 行补一句，GLM 一节的显存提醒里点名这一点。
2. **「控制流版本」是未定义的自造词**（第 93 行）。全库只有本页用。改法：直接写「vLLM v0.23.0（0fc695fc）的加载格式默认是 auto」。
3. **两张图有文字被连线压住**。直觉图：旧实例的虚线竖线穿过分区标题「接收完成：两边各有自己的权重」的「自」字（截图 `netloader-guide-review-zoom1.png`）；流程图：「握手失败」的红虚线横穿「接收失败」标签，而且该标签落在握手失败那支箭头上、真正的接收失败箭头在下面一支，读者会对错（`netloader-guide-review-zoom2.png`）。`wiki:diagrams --check` 没报，属于检查盲区。改法：直觉图虚线改走分区标题右侧或标题左移；流程图两支失败箭头分开进回退框，各自标签贴在自己那支线上。
4. **直觉图图注与紧接的正文段几乎逐句重复**（图注「两个实例各用一张卡…复制完成后两边各自持有权重…」与第 44 行前三句）。改法：正文第 44 行删去复述，只留「扩容或故障恢复时…」这句往下推进。
5. **供方干扰写成了定论**（第 52 行「两者会竞争显存带宽和通信资源」）。HBM 与链路共享是合理推断，但写手自己在待核里列了「供方同时推理时的干扰」没有实测。改法：改成「可能争用显存带宽和通信资源，影响幅度待核」，与页末待核口径一致。

### P3

1. 直觉图把权重画成纯色方框；示意张量账（[2,3] int8 矩阵 + [2] 缩放）只有 calc。按站内「一个张量一个方块加格子线」的画法，可在流程讲解处补一张小静态图：两块张量按顺序从供方格子搬进接收方同形状空位。
2. 第 93 行 safetensors 首次出现未解释，可加括注「一种权重文件格式」。
3. 第 97 行「另一台负责别的权重分片」可以更准：双机两组的 attention 等 TP 分片其实相同，差在 expert 分片（EP16）和全局 rank 编号（0–7 对 8–15），而且两台同时启动、彼此都还没装好——这三点才是不能互指的原因。

### 验证记录

- `pnpm wiki:audit`：退出码 0；本页 13 条来源，12 条本地 ✓，1 条教程 URL（·）；全站无效 commit / 缺文件 / 越界 / 未知仓库均 0。
- 名单口径自测（只读脚本，内存里把本页加入名单，未改 standard-pages.json）：`2524 字 · ✓行内代码 0.0/千字 · ✓角标 0 · ✓对照源码 · ✓calc 0.40/千字 · ✓相邻块 0 · ✓图先行 · ✓免责 1.4% · ✓图宽`，problems 0。
- `pnpm wiki:lint`：退出码 0，本页无报错。
- 浏览器（Playwright，1440 宽，只读访问 5193，未起停服务）：第一屏标题 + 定义 + 直觉图完整可见，pageerror 0；截图 `scratchpad/netloader-guide-review-first.png`、`netloader-guide-review-netloader-guide-flow.png`、`-zoom1.png`、`-zoom2.png`（会话 1237c9d2 的 scratchpad）。
- 未读：「怎么开」的命令块、「源码位置」正文（按纪律只 grep）；sources 区跳过。

## 修订记录（10-04）

本轮接受并修复 P2 5 条、P3 3 条，无异议项；先完成本页与检查，再处理 ai-qos。

| 审查项 | 修订结果与证据 |
| --- | --- |
| P2-1 draft 缓存 | GLM 段、INT8_CACHE 表与来源索引补明：非 no 的 draft 供方缓存模式强制为 hbm，dram 也不例外；no 保持关闭。核读 db701c1f `netloader.py:359–370`，关键赋值在 360 行；`interaction/elastic.py:264–276` 说明选中 int8 参数的 HBM 复制失败才降 DRAM。保留显存重测提醒，未把强制模式误写成复制必然成功。 |
| P2-2 自造词 | 「控制流版本」改成「vLLM v0.23.0」，默认 auto 的依据仍为 0fc695fc `config/load.py:29–34`。 |
| P2-3 连线压字 | 直觉图保留权重的虚线从 x=490 绕过第三分区标题，进入旧实例框右侧；流程图握手失败从回退框顶端进入、接收失败从右侧进入，各自标签移到对应线旁，避免原来 y=380 横线压住接收失败标签。YAML 与派生 SVG 同步。 |
| P2-4 图文重复 | 删除首图之后对图注的逐句复述，只留扩容或恢复时为何有用。 |
| P2-5 供方干扰 | 按后台发送线程与推理并存的源码行为标明「据此推断」「可能争用」，影响幅度仍列实机待核，不声称已测得干扰。 |
| P3-1 张量格子 | 新增静态 `netloader-guide-tensors` 图：供方和接收方各画 [2,3] int8 矩阵、长度 2 的 FP16 缩放张量，用先后两支箭头对应现有 6 B + 4 B 算例。没有增加真实部署数字。 |
| P3-2 safetensors | 首次出现处补「一种权重文件格式」。 |
| P3-3 双机互供 | 明确对应卡的 attention 等 TP 分片相同，专家分片与全局 rank 不同，且同时冷启动尚无已装好的供方；链接双机分组与每卡权重的唯一出处（`glm-5-3-flash-two-node.md:127–160`）。 |

信息保留复核：握手四项及校验缺口、逐参数等待、候选与回退边界、缓存筛选和 DRAM 降级、七项配置、八条报错、主模型/draft 通道与同步、四提交差异、已测模型清单及全部待核项仍在；只删除首图正文的重复叙述。

验证：`pnpm.cmd wiki:lint` 退出 0（另有 4 条既有非阻塞提示）；`pnpm.cmd wiki:diagrams --check` 退出 0，299 张图一致；`pnpm.cmd wiki:audit` 退出 0，142 页、3827 条来源，本地无效 commit/缺文件/越界/未知仓库均 0，日志 `tmp/netloader-revision-audit.log`。直接调用 `checkStandard` 检查本页，`problems=[]`；教学正文 2567 字、行内代码 0、角标 0、calc 1（0.390/千字）、免责词命中 2/72（2.78%）、无相邻块或超宽图。首图仍在第 40 行，图前数字算例/calc 均 0，三图均宽 880 px。

过程中的新图 tone 枚举错误和 SVG 尚未生成导致 lint 失败，已修正并重跑通过；没有通过放宽检查消除报错。按共同要求未起服务、未访问 5193/8790、未截图；本轮做了 spec/SVG 坐标复核，浏览器视觉复验仍交审查员，不将自动检查视为实机或视觉验收。外链未重新联网验证。

toc 与入链仍由主会话统一安排，建议沿用上面的 `platform-plugin-registration`、`vllm-ascend-overview` 两处入口。设备实测缺口仍保留页末；需用户决定的问题：无。
