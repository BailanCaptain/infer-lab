# collective-communication 审查记录

## P5 写作记录（2026-09-28，第 01 批）

### 修改目的与范围

将本页作为集合通信术语的唯一出处：定义通信前后每卡持有什么，再统一 N/M 通信量口径，最后引用固定双机部署的使用位置与字节数。只修改本页、它的两组 YAML/SVG，并新增本记录；未改其他知识页、src、scripts、tests、计划或公共派生索引，未提交 Git。

- 重绘 `collective-communication`：两张卡分别从 [a,b]、[c,d] 出发，画出 All-Gather、All-Reduce(SUM)、Reduce-Scatter(SUM)、All-to-All、Broadcast 的输入、流向和各卡输出。保留原有四操作交互演示。
- 新增 `collective-communication-flow`：A0 建组 → A4 前向 → MC2 / AllGather 二选一 → 专家计算 → 返回或归约 → 共享专家收尾。两图宽均为 880px。
- 每种操作统一说明 N 张卡、每卡输入 M 字节；区分输入载荷、贡献切片、输出切片、每卡发送量及全组传输量。Broadcast 明确 M 属于根，发送量依转发树位置而异。
- 保留归约与收集组合、浮点顺序边界、根操作、Send/Recv、SP/CP、rank/设备/进程区别和异步数据就绪规则；补 HCCL 名称和固定代码入口、三版分流差异。

### 数字与唯一出处

| 内容 | 底稿 | 正文引用的既有推导 |
|---|---|---|
| TP8、DP2、EP16 通信域；CPU DP 两个 int32 状态 | 01 §A0.2 | D 的「16 张卡怎样分组」；CPU 8 B 同时核 `vllm@0fc695fc:config/parallel.py#L683-L707` |
| 主干 218 次、91 次 TP All-Reduce、32,768 B | 02 §1.2、§9.2 | R 的「一次前向的通信账」及第 4 站 |
| MC2 每有效 token 的 dispatch ≤32,800 B、combine ≤65,536 B；finalize 每卡贡献 8,192 B | 02 §6.5、§9.2 | R 的「42 层 MoE，每卡 18 个专家」；不重推 token–expert 副本账 |
| 词表 prefill 单行 38,720 B、decode 四行 154,880 B | 02 §1.2、§9.2，并核 §7 的词表段 | R 的「最终归一化与词表投影」与通信账；保留 n=1 / n=4 条件 |
| DP2 两次收集、Reduce-Scatter 输入 99,090,432 B／输出 49,545,216 B | 补查 02 §8.1–§8.4 | E 的场景 M 整批账；宽度补齐只链接 C |
| N/M 公式与 32,768 B 代入 ring 模型 | 本页新增的通信算法估算 | 唯一放在本页；57,344 B 每卡发送和 458,752 B 全组发送均标明算法假设，不当作 HCCL 实测 |

没有修改底稿。队列只指定 §1.2/§9.2 的 MC2 账，无法给出大批 Reduce-Scatter 的实例，因此补读同一底稿 §8.4 并引用已存在的 E 推导。固定 A2 主线不选普通 ALLTOALL，MC2 副本上界不冒充一次 HcclAlltoAll 的线路量。Broadcast 的启动单次载荷未在底稿中给出，页末保留具体证据缺口。

### 核心概念的原始证据

- 五种定义、根操作及 HCCL C API 名：本轮联网核读 HCCL 官方 `CANNCommunityEdition/850/commlib/hcclug/hcclug_000009.html`，同时查阅 PyTorch distributed 文档。CANN 文档版本用于接口语义，未声称等于镜像安装版本。
- 上游组封装与设备通信器：`vllm@0fc695fc` 的 `distributed/parallel_state.py#L607-L681`、`device_communicators/base_device_communicator.py#L180-L248`，核输出形状、拼接、归约、均分要求。
- 普通昇腾路径：`db701c1f` 的 `npu_communicator.py#L23-L68`、`comm_utils.py#L26-L60`、`pyhccl.py#L98-L171`，核 All-to-AllV split sizes、握手广播与直接 HCCL 包装，明确 PyHccl 并非主干的统一入口。
- MC2 与 AllGather 分支：`db701c1f` 的 `ascend_forward_context.py#L202-L252`、`prepare_finalize.py#L193-L227 / L440-L469 / L543-L560`、`token_dispatcher.py#L150-L339`、`moe_comm_method.py#L122-L172`。
- 共享专家顺序与归约互补：`fused_moe_0_23_0.py#L663-L719`、`register_custom_ops.py#L157-L167`；图 pins 与页面 sources 对齐。
- 跨版：v0.23 `2c59ff10`、v0.26 `2ed6cbba`、main `baa023ad` 的选择器和 enable_prefill_mc2 默认值。v0.26/main 来源扩展覆盖 LoRA+EP 额外 ALLTOALL 分支；不把固定 A2 的两路选择推广成所有配置。

### 独立审查与修订

独立审查者 `/root/review_collectives` 只读核查原文备份、实际正文、YAML、源码及截图。首次发现 0 P1、2 P2、2 P3：版本表 LoRA 条件来源范围不足、首次术语解释延后、原文 CP 信息遗漏、流程图共享专家来源不足。四项均已修订。后续自查将 Reduce-Scatter 段提前出现的 R1 移到正式案例，首次 MC2 加就地解释。

复审结论：当前未发现未解决的 P1/P2/P3；五种语义、N/M 公式、MC2 边界与固定执行顺序成立；对照原文未发现剩余独有信息丢失。审查者独立看首两屏、两图及后半页，确认无可见截断、遮挡和重叠。前两屏可复述概念及等待代价。审查者检查了浏览器证据记录；浏览器操作由写手执行，未冒充审查者实操。

### 实际验证

- `pnpm wiki:diagrams --check`：通过，158 张图与 spec 一致；本页只调用既有渲染器重生成两张 SVG，未批量生成正文或其他图。
- `pnpm check:content`：通过，registry 131 页；无章节，Term 检查跳过。
- `pnpm wiki:audit`：最终通过，1550 条来源中 1459 条本地行号有效，91 条 URL 未由此命令联网验证，1291 条 raw 摘录仍待核；本页没有无效 commit、路径或行号。
- `pnpm wiki:lint`：本页无报错；最终全库仍有 1 项范围外错误：`hardware-devices.md` 的两条 e.huawei.com URL 不在来源域名白名单，另有 22 条既有非阻塞提醒。任务开始时 lint 是通过的；期间其他页面持续改动，不能把最终错误称为本页新增或已证实的初始基线错误。
- `pnpm typecheck`、`pnpm build`：通过。生产构建保留既有 Vite/插件耗时等提醒。
- `pnpm check`：类型检查与代码 lint 通过后，测试 **947 通过、3 失败，共 116 文件（113 通过、3 失败）**。失败为 `src/content/wiki/index.test.ts:20` 的 Block Table 标题断言、`scripts/wiki/params/scan.test.ts:95` 的当前 Python 不支持星号类型订阅语法、`server/reader-build.test.ts:7` 的阅读快照 revision 不一致。运行时知识页持续变化；未改范围外页面、解释器或测试断言来制造通过。不能宣称全库检查全绿。
- 公共 `wiki:build` 会改 `wiki/index.md` 和 `src/content/wiki/registry.json`，本任务禁止写这些共享派生物。因此调用同一构建模块的 `buildRegistry` / `renderIndex` 生成到截图证据目录：131 页均可解析，保留 `registry-check.json` / `index-check.md` 供协调者串行集成。
- 本页单独调用 `checkStandard`：无问题；另逐条检查所有正文站内链接及锚点，`badLinks=[]`。首图在第一 H2 的定义段后，图前无 GLM 数字或 calc；两图宽 880。正文一个 calc，无表/calc 相邻，源码区之前证据角标 0。
- 浏览器：`http://127.0.0.1:4175/#/wiki/collective-communication`，Chromium，1440×900；逐屏截图 13 张，另有两张完整图与交互终态。实际访问六个定义锚点，标题均落在视口 top=16；操作本页目录跳 Broadcast；四个交互均逐步到最终输出，并点击主线通信汇总回链。`pageerror=0`，页面宽与 scrollWidth 同为 1440，两图容器无横向溢出。
- 截图后已停止本轮 4175 服务，TCP 复查 `ECONNREFUSED`；没有操作 5193 或 8790。

### 字数、密度与证据路径

字数采用“去 frontmatter 和 Markdown 链接地址，每个汉字计 1、每个拉丁词计 1”的说明性口径：**改前 1465，改后 6327**（含源码区）。教学正文按项目 `measureStandard` 口径为 **4672 字**，行内代码 0，每千字 calc 约 0.214；含源码区全文行内代码 24，每千字约 3.79。全文证据角标 29，其中 C 为 23，比例约 79.31%。自动免责词命中正文 2/146 句，约 1.37%，必要的事实限制保留。

另存可重复的字符口径：去 frontmatter 和空白、保留 Markdown 标记及链接文本的正文非空白字符 **2391 → 11053**，教学部分 7963。该口径不是上面的汉字/英文词字数。

截图和全部命令日志：

`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\13898c74-f916-4e2c-8924-fe9bf130f160\scratchpad\p5\collective-communication\`

包含 `before.md`、`screen-01.png`～`screen-13.png`、`figure-1.png`、`figure-2.png`、`interactive-final.png`、`browser-evidence.json`、`page-check.json`、`service-closed.json` 和各命令日志。

### 稳定引用接口

后续页面引用以下锚点，不复制术语定义：

- `collective-communication.md#all-reduce`
- `collective-communication.md#all-gather`
- `collective-communication.md#reduce-scatter`
- `collective-communication.md#all-to-all`
- `collective-communication.md#broadcast`
- `collective-communication.md#mc2`

### 取舍、底稿疑点与待决事项

保留全部必要概念与部署数字，篇幅因补足五种操作的定义、公式、HCCL 对照及版本边界而增加。无 NPU 实测；Broadcast 的部署字节数、MC2 同目的卡副本是否合并和底层链路流量继续待核。

仅报告、不改底稿：02 §6.4 的“任何 chunked prefill 混入就翻到 ALLGATHER”过宽，固定选择器实际按最大 token 数与容量判断；02 §9.2 的词表 154,880 B 和 ≤7.3 MiB 对应 n=4 的验证步，R1 prefill n=1 应引用既有 R 页的 38,720 B 及约 7.15 MiB。§9.2 的总量和 §8.4 的全组数含混合载荷口径，不宜直接称为网卡实测流量。队列缺 Broadcast 字节证据、Reduce-Scatter 数字需补读 §8.4，均已明确记录。

本页未解决的 P1/P2：无。需要用户决定的问题：无。全库 lint/测试失败交由相应范围的维护者处理，本页交付不代表全库验收通过。

## P5 审查（09-28）

独立审查员：Claude Opus 5.5 子会话，只读页面与底稿，未改页面。**评分 9 / 10。核心概念无错，无 P1，P2 一条（公式口径提示缺失），P3 三条。**

### 核心概念逐条核对（全部正确）

以页面第 66 行的口径「N 张卡，每张卡的输入张量为 M 字节」判定。

| 操作 | 通信前 / 通信后（页面 84–116 行） | 每卡发送量 | 判定 |
|---|---|---|---|
| All-Reduce | [a,b] / [c,d] → 两卡都 [a+c,b+d] | 2(N−1)M/N，两阶段 ring | 对；页面明确写“二来自两阶段，不是收发相加” |
| All-Gather | [a,b] / [c,d] → 两卡都 [a,b,c,d] | (N−1)M（M 为本卡分片） | 对 |
| Reduce-Scatter | [a,b] / [c,d] → 卡 0 [a+c]、卡 1 [b+d] | (N−1)M/N（M 为完整输入） | 对 |
| All-to-All | [a,b] / [c,d] → 卡 0 [a,c]、卡 1 [b,d] | (N−1)M/N，本地留 M/N | 对；变长走 All-to-AllV，页面 110 行已排除等分公式 |
| Broadcast | 根 [a,b]、其余接收空间 → 两卡都 [a,b] | 依树位置；全组 (N−1)M | 对；78 行明确禁止把全组平均当根发送量 |

全组传输量四项与每卡发送量 × N 自洽（2(N−1)M、N(N−1)M、(N−1)M、(N−1)M）。

**All-Reduce = Reduce-Scatter + All-Gather** 在 120–122 行讲到，并正确处理了口径：第二步每卡输入已是 M/N，两步相加 2(N−1)M/N，等于一次 All-Reduce；同时说明浮点加法次序不保证逐位相同。归约/收集的误用（All-Gather 后本地求和、Reduce-Scatter 退化成本地切片）在 124、200–208 行都有反例。

**MC2 与 expert-parallel.md 一致。** 本页 169–175 行与 EP 页第 179、197、203、312 行对照：都定义为昇腾上计算与通信协同的一类实现、具体指 MoE dispatch/combine、不是第六种集合通信语义；容量条件（每卡专家 ≤24、EP ≥16、最大 token ≤128）与“MC2 combine 已合齐路由贡献所以共享专家单独归约 / AllGather 路径留到最后一并归约”两页说法相同。本页 175 行区分 AllGather 路线与 All-Gather 操作，EP 页第 179 行有同样的区分，无漂移。

### 部署数字与底稿核对（一致）

- 01 §A0.2：TP8 机内 [0..7]/[8..15]、8 对跨机 DP2、EP/MC2 组 16 rank、CPU gloo 组两个 int32 → 页面 139、141 行的分组与 **8 B** 控制载荷一致。
- 02 §1.2：218 次（1 + 45 + 3 + 42×4 + 1），两条路径每层 4 次 → 页面 60、183 行的“218 个通信调用边界”“每层四个边界、attention 另计”一致。
- 02 §9.2：TP8 All-Reduce 91 次 × 32,768 B、MoE finalize 每卡 8,192 B、lm_head n=4 时 154,880 B、dispatch ≤32,800 B、combine ≤65,536 B、合计 ≤7.3 MiB → 页面 149、163、165、173、208 行逐项一致；prefill n=1 的 38,720 B 由 §1.2 的 n × 19360 × 2 B 推出，正确。
- 场景 M 四行载荷自查算术：6048×4096×2 = 49,545,216；6048×288×4 = 6,967,296；12096×4096×2 = 99,090,432；47.25 MiB = 49,545,216 ÷ 1024²。页面 196 行点明底稿以输出切片记 47.25 MiB、读公式要换回输入口径，处理得当。
- 两张图（`wiki/diagrams/collective-communication.yaml`、`collective-communication-flow.yaml`）的标签与正文一致；流程图两列各 4 个通信节点，与 218 次的记法对得上。

### 机械检查

- `pnpm wiki:audit`：审计 130 页 / 1562 条来源，本页 26 条来源行号全部有效，**本页无报错**。全局唯一失败是 `concepts/cann-hccl.md [schema] relations.kind 收到 'related'`，与本页无关。
- 锚点：用 `src/content/wiki/anchors.ts` 的 `createSlugger` 对本页标题实跑，生成 `all-reduce`、`all-gather`、`reduce-scatter`、`all-to-all`、`broadcast`、`mc2` 六个目标全部存在；review 文件登记的六个稳定锚点、`cann-hccl.md` 指向的 `#放到-glm-双机一个-token-会在哪里通信` 与 `#mc2` 均可解析。本页 20 个出向 md 链接 + 4 个页内锚点全部解析，未解析 0。
- 写作标准指标（用 `scripts/wiki/standard.ts` 的 `measureStandard` 实跑）：行内代码 0 / 千字（上限 13）、calc 1 个即 0.21 / 千字且每节 ≤1、对照源码之上角标 0、五个 H3 齐全且顺序正确、hedge 比 0.0137（上限 0.03）、无超宽图、图不迟于第一节。本页目前不在 `scripts/wiki/standard-pages.json` 强制名单内，但六项按名单阈值判定全部达标。

### P1

无。

### P2

1. **通信量表缺一句口径提示（第 70–78 行）。** 表内 M 按“每卡输入”定义，因此 All-Gather 的 M 是分片、Reduce-Scatter 的 M 是完整张量。页面内部自洽，但读者横向对比表中“每卡发送量”会得到 All-Gather 比 Reduce-Scatter 贵 N 倍的错觉，且与外部资料常用的完整张量口径（两者都是 (N−1)M/N）表面矛盾。影响：初学者拿别处的公式对照本页会以为其中一边写错。复现：只看第 70–78 行的表，不看 122 行的组合说明。建议在表下补一句——若以完整张量为 M，All-Gather 与 Reduce-Scatter 的每卡发送量都是 (N−1)M/N，本表的 All-Gather 的 M 指分片。

### P3

1. 第 64–78 节（三本账 + ring 公式表）排在五种操作定义之前，初学者第二屏就撞上公式；建议把该节移到五个 H3 之后，或在表前加一句“先看下面五个定义，再回来读公式”。
2. 第 175、187 行两处链到 `concurrent-requests.md` 页首，而该页存在更贴切的锚点（`#示例场景-m-与变体-m′`、`#第-4-站-moe通信6048-个-token-把两台机器一起推过-128-的门槛`）；建议补锚点。
3. 本页已按 P5 深改并全项达标，可考虑加入 `scripts/wiki/standard-pages.json` 名单，使指标由 `wiki:audit` 强制，防止后续回退（需用户点头，不在本次审查范围内）。

### 本次审查的范围与未做项

按更窄读法执行：正文分三段读（46–63、64–136、137–209），「对照源码」（210–266）只用 grep 核 H3 齐全与顺序、`版本差异` 含 v0.23 / v0.26 / main 三词，并读了 262、266 两行的来源归属与待核；未读该节正文与代码块。frontmatter 的来源清单区在第一次读取时被安全分类器拦下，此后未再读该区域，本页 26 条来源改由 `wiki:audit` 的行号校验结果判定，**未逐条人工核对来源摘录语义**。未读 HANDBOOK、`docs/plans/`、`wiki/TERMS.md` 全文。**未做浏览器实测**（未起前端服务，本轮结论不含渲染验收）。

## P5 修订记录（09-28，Opus 5.5 接手）

接手时本页没有未提交改动（`git diff` 为空），P2/P3 均未开始，本轮从头修。

- **P2 已关闭**：通信量表（第 112–118 行）加最后一列「按完整张量 S 换算」，表下第 120 行补口径提示：除最后一列外，M 一律按每卡输入计，与后文 GLM 各处的载荷（All-Reduce 输入、All-Gather 本卡贡献）同一口径，所以 All-Gather 的 M 是每卡分片，Reduce-Scatter 的 M 是完整张量，直接横比会误以为收集贵 N 倍。改用外部资料常用的完整张量 S 后（All-Gather 的 S=NM，其余 S=M），All-Gather、Reduce-Scatter、等分 All-to-All 每卡都发 (N−1)S/N，All-Reduce 是前两者之和。第 80、88 行的 All-Gather、Reduce-Scatter 定义处各加半句“这里的 M 是每卡分片／完整张量”。选择保留“每卡输入”作为主口径、另列 S 换算，而不是把全页改成 S：因为第 141–202 行的 GLM 载荷（8,192 B、38,720 B、49,545,216 B、99,090,432 B 等）和 TP 页第 171 行都按输入／本卡贡献记，整页换口径会让这些数字与公式对不上。
- **P3-1 已关闭**：公式表挪到五个定义之后。原 H2「通信量里的 N 和 M 到底数什么？」的 N、M 定义留在新 H2「五种操作各让每张卡得到什么？」（第 64 行）开头，五个 H3 跟在它下面；三本账、公式表和接收量说明组成「通信量里的 N 和 M 到底数什么？」（第 108 行），放在五个定义之后、「归约和收集怎样组合」之前。All-Reduce 小节首次提到 ring 时就地加注“每卡只向相邻卡逐轮传块”。全库没有指向旧 H2 锚点的入链（grep 核过），6 个稳定锚点 `#all-reduce`、`#all-gather`、`#reduce-scatter`、`#all-to-all`、`#broadcast`、`#mc2` 的标题都没改。
- **P3-2 已关闭**：第 179 行链接改为 `concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛`，第 191 行改为 `concurrent-requests.md#示例场景-m-与变体-m`。两个锚点都用 `src/content/wiki/anchors.ts` 的 `headingSlug` 实算得到。审查建议里的 `moe通信` 少了一个连字符，目标标题“MoE 通信”中间有空格。
- **P3-3 未做**：是否加入 `standard-pages.json`，要由用户决定。
- 数字未改，内容未删；公式只增加 S 换算列，原有 M 公式一字未动。

**验证（本轮实跑）**：`pnpm wiki:lint` exit 0；`pnpm wiki:audit` exit 0（本页 26 条来源，行号全部有效）；本页 `checkStandard` problems=[]（4,946 字，行内代码 0，calc 0.20/千字，相邻块 0，免责 1.3%）；25 个站内链接和锚点全部能解析；`pnpm wiki:diagrams --check` 163 张图一致。未做浏览器验收。

## 用户反馈修订（09-29）

用户反馈：旧动图只是数字在框里换来换去，看不出机制。本轮按 `basics-standard.md`（含 09-29 新加的「总原则」）重做本页的动图和基础部分；GLM 双机、大批输入、常见误解、对照源码几节的内容原样保留。

### 参考了哪些做法（只学讲法，文字和图都是我们自己的）

- **鲜枣课堂《到底什么是 All-Reduce、All-to-All？》**（https 证书不匹配，改用 http 取到正文，图只有占位没有看到）：先分「点对点 / 一组一起通信」；原语按一对多 → 多对一 → 多对多 → 加上归约来排，每个新原语用已讲过的来定义（Scatter 与 Broadcast 只差整份还是切块；Gather 是反向的 Scatter；All-Gather ≈ Gather + Broadcast；Reduce-Scatter ≈ Reduce + Scatter）；All-to-All 用「卡 i 第 j 块 → 卡 j 第 i 格」一句规则加「行列互换」直觉，并与 All-Gather 对比；ring 拆成两段，逐步说「发哪一块、收到后做什么」。本页照这个顺序排了八个 H3，但例子换成推理（TP 部分和、EP 派发与返回），不用它的训练例子。
- **AMD ROCm《vLLM MoE Playbook》**：每种并行一张图、固定 4 卡；每个通信原语紧跟「谁在用它」。本页每个原语末尾都写「推理里」：TP 行切后的部分和 → All-Reduce，EP 按目的地交换 → All-to-All（A2 上由 MC2 实现），只链接 TP / EP 页，不重推它们的数字。
- **知乎 p/2003423046342554380**：WebFetch 返回 403，未读。
- 笔记在会话 scratchpad 的 `collective-communication-refnotes.md`。

### 新动图演的是什么

所有图用同一个新图元「集合通信分镜」（见下），4 张卡排成一圈（上排卡 0、卡 1，下排从右到左卡 2、卡 3），每卡一个张量画成方块加格子线、切成 4 块。页面上一次显示一格，按「下一步」或「播放」：

1. 当前格先显示每张卡手里有什么；这一步要发的块描紫色粗框，要落进的块描紫色虚框，箭头从源卡指向目的卡，要发的数据块（紫色小块，写着它的值）停在箭头上。
2. 播放时每个数据块从源块出发，沿箭头飞到目的块。
3. 落地后换到下一格：刚写入的块变成青色实心，加齐的数直接显示和；每块下面一排圆点（一张卡一个）变实心，表示这块里已经有哪几张卡的数。
4. 结果只算一部分的输入（Reduce-Scatter、Scatter、Gather、Reduce 后留下的旧块）变成灰字。

数用 [1, 2, 3, 4] × 10 的 k 次方（卡 k），加完的数位直接说明加进了哪几张卡（11 = 卡 0 + 卡 1，1111 = 四张都加齐）。

| 图 | 演什么 |
|---|---|
| collective-communication | 首节：两张卡各有一半的部分和 [1, 2] / [10, 20]，互发后都得到 [11, 22]（最小的 All-Reduce） |
| collective-communication-broadcast / scatter / gather / all-gather / reduce / reduce-scatter / all-to-all | 每个原语一步：通信前 → 谁把哪一块发给谁 → 通信后 |
| collective-communication-all-reduce | 两步：先 Reduce-Scatter（卡 k 得第 k 块的和），再 All-Gather |
| collective-communication-ring | ring All-Reduce 共 6 步：前 3 步每卡只把 1 块发给下一张并相加（圆点一步多一个，11 → 111 → 1111），后 3 步把加齐的块沿环传一圈覆盖；最后一格每卡 [1111, 2222, 3333, 4444] |

正文结构：首节先讲为什么多卡需要通信（拆开后每卡只有一部分）、什么是集合通信和 rank，再用两卡例子和图；然后是原有的「为什么算完还要等」；再是八个原语（一句话定义 → 分镜 → 例子和通信量 → 推理里谁在用）；然后新增「ring All-Reduce 每一步在传什么？」（分镜 + 1 个 calc：4 卡时每卡共发 1.5 M，对应 2(N−1)M/N）；再接原有的通信量表、GLM 双机等。

### 新增的组件（只做加法）

改前 `git status` / `git diff` 确认 `scripts/wiki/figure.ts`、`src/content/wiki/WikiDiagram.tsx`、`src/design/wiki.css` 没有别人未提交的改动。`figure.ts` 的 diff 只有新增行（+338，−0）。

1. **figure 图元 `exchanges`（集合通信分镜）**，`scripts/wiki/figure.ts`：schema、`exchangeStates`（按步骤算出每格状态）、`exchangeLayout`、paint 里的「集合通信分镜」一段、`figureWords` 收词。块里的数由渲染器按步骤算出，作者只写初值和收发；收发越界、源块为空、add 到空块、同一块被 copy 两次、自己发给自己、和别的零件同图、卡排超过两排，都记成画法问题。
2. **播放器 `src/content/wiki/DiagramPlayer.tsx`**：SVG 里有分镜时，裁到当前一格，按钮「上一步 / 播放 / 下一步」，数据块沿 SVG 里写好的路线飞。不认识具体的图，其他图不受影响（没有分镜就不渲染）。播放状态按图 id 记在组件外，正文重渲染导致图重新挂载时接着播。
3. **`WikiDiagram.tsx`**：图下的旧 `CollectiveDemo` 挂载点换成通用的 `DiagramPlayer`；`{__html}` 对象改为跟着 `safe` 缓存。原因是 React 19 只要这个对象换了就重写 innerHTML，滚动提示的状态一变就会冲掉播放器裁好的画布（浏览器里实测复现过，改后消失）。静态图的输出不变。
4. **`wiki.css`**：新增 `.wiki-anim-*` 按钮样式。

**`exchanges` 用法**（渲染器旁没有说明文档，HANDBOOK 本轮不读，所以写在这里）：

```yaml
layout: figure
id: demo-exchange
caption: 两张卡互发后按位置相加。数为示意。
size: [600, 328]          # 高度 = at.y + 格数 × 每格高；不够时 wiki:diagrams 报「画到了画布外」
exchanges:                # 一张图最多一个，且不能再放别的零件（播放器按格裁切）
  - at: [40, 8]
    cards: [卡 0, 卡 1]    # 按环的顺序；3 张以内排一排，再多分两排（第二排从右往左）
    slots: 2              # 每卡几块；cell: [宽, 高] 默认 [52, 34]；gap: [横, 竖] 默认 [150, 96]
    dots: true            # 每块下面画「这块里有哪几张卡的数」
    tag: 数为示意
    start: [[1, 2], [10, 20]]            # null 是空的接收位置
    steps:
      - title: 交换：各把两块发给对方，对方加进同位置
        moves:                            # [卡, 块]；op 默认 copy（覆盖），add 是加进去
          - { from: [0, 0], to: [1, 0], op: add }
          - { from: [0, 1], to: [1, 1], op: add }
          - { from: [1, 0], to: [0, 0], op: add }
          - { from: [1, 1], to: [0, 1], op: add }
        # keep: [[0, 0]]                  # 可选：这一步后只有这些块算结果，其余有数的块变灰字
    end: 交换后：两张卡都是 [11, 22]
```

同一步里的收发同时发生，全按这一步之前的值算；多条 add 可以落在同一块（直接归约）。

### 清单勾选结果

动笔前把旧版 46–212 行列成 F1–F70（会话 scratchpad 的 `collective-communication-facts.md`），写完逐条勾选：

- 原样保留：F5–F14、F32–F36、F43–F70（「为什么」、通信量、GLM 双机、大批输入、常见误解、对照源码）。
- 保留并把例子换成 4 卡：F15–F31（五种原操作的定义、公式、边界句一句不少）。
- 挪位置：F17 ring 公式、F37–F39（Reduce-Scatter + All-Gather = All-Reduce、推迟 All-Gather、序列并行 / 上下文并行）挪到 ring 一节；F42（设备 / 进程 / rank）挪到首节；F41 与 Send/Recv 例子挪到八种操作末段。
- 改写：F3 图整体替换；F4 五操作并列的一句话总结并入各 H3 首句；F40 根操作表由 Scatter、Gather、Reduce 三个 H3 取代。
- 新增：Scatter / Gather / Reduce 小节、ring 一节和 1 个 calc、通信量表下一句口径说明、误解「All-Reduce 就是 ring」一条；frontmatter 的 summary、aliases（加 Scatter、Gather、Reduce、ring All-Reduce）、updated 改到 09-29。
- 删除的事实：无。入链锚点（#all-reduce、#all-gather、#reduce-scatter、#all-to-all、#broadcast、#mc2、#两张卡交换以后各自手里多了什么、#大批输入为什么改用-reduce-scatter、#放到-glm-双机一个-token-会在哪里通信）标题都没改，本页和全部入链页 0 条坏链。

### 实际验证（本轮实跑）

- `pnpm wiki:lint`：exit 0，输出里没有本页。
- `pnpm wiki:diagrams --check`：exit 0，「213 张图与 spec 一致」，本页 11 张图 0 问题、0 提醒。
- `pnpm wiki:audit`：exit 0；本页「写作标准 6925 字 · 行内代码 0.0/千字 · 角标 0 · 对照源码 ✓ · calc 0.29/千字 · 相邻块 0 · 图先行 ✓ · 免责 1.0% · 图宽 ✓」。
- 字数：写作标准口径 4,946 → 6,925 字；audit 全文口径 12,890 → 17,243 字。
- 单元测试：`scripts/wiki/figure.test.ts` 27 条全过（新增 4 条：ring 状态、同时发生与 keep、报错、分镜结构与路线）；新增 `src/content/wiki/DiagramPlayer.test.ts` 3 条全过。`vitest run scripts/wiki src/content/wiki`：700 过、1 失败，失败项是 `params/scan.test.ts`，原因是本机 Python 版本低于上游要求，与本轮无关。`pnpm typecheck` exit 0；改动文件 `biome check` 无错误（wiki.css 剩下的 noDescendingSpecificity 警告都是旧规则）。
- 浏览器：Playwright 桌面 1440 宽打开 http://localhost:5193/#/wiki/collective-communication，11 张图都渲染，10 张分镜都带播放按钮，控制台无报错。ring 图从第 1 格点到第 4 格，飞行中 4 个块都带位移；再点「播放」自动走到 7 / 7。截图：cc-shot-1.png（第一屏）、cc-anim-1/2/3.png（ring 的开始、第 3 步飞行中、结束），在会话 scratchpad。

### 取舍与遗留

- 旧的 `src/content/wiki/CollectiveDemo.tsx`、它的测试和 `wiki.css` 里的 `.wiki-collective*` 样式已不再被引用，但文件不是本轮写的，按规矩没有删，由用户决定。
- `WikiPage.tsx` 把 react-markdown 的 `components` 写成内联对象，页面每重渲染一次（快照刷新、面板开合、dev 下 wiki 文件变动）正文里的图就整体重新挂载。静态图看不出来；播放器靠「按图 id 记住播到哪」接着播，正在飞的那一步会从头再飞一次。根治要在 WikiPage 里缓存 `components`，超出本轮范围，未改。
- 按「每张卡直接发给需要它的卡」画的原语图只表示结果归属；实际算法另见 ring 一节，页面已写明。
- 本页 P1/P2：本轮未发现。独立审查尚未进行。

## 用户反馈修订审查（09-29）

独立审查员（Opus 5.5），只审不改。依据 `basics-standard.md`（总原则 + 第 1–14 条）、写手「用户反馈修订（09-29）」一节、信息清单 `collective-communication-facts.md`、参考笔记 `collective-communication-refnotes.md`。截图与脚本在会话 scratchpad：`cc-review-*.png`、`cc-review*.mjs`。

**结论：8/10。动图能看出「谁把哪一块发给谁、结束后每张卡手里有什么」，不再是数字在跳。页面 P1 0 条、P2 3 条；代码 P1 0 条、P2 1 条。**

### 页面

#### 学习顺序与逐节初学者检验（GLM 之前 5 个 H2，5 节都讲得出）

| H2 | 初学者读完能讲出的一句话 | 结论 |
|---|---|---|
| 两张卡交换以后，各自手里多了什么？ | 模型拆到几张卡上以后，每张卡只有一部分结果；集合通信约定一组卡怎样交换、拼接或相加，结束后各自拿到什么；两张卡各有部分和 [1,2] 和 [10,20]，互相发过去再相加，都变成 [11,22]。 | 通过（先讲为什么要通信，再讲是什么，最后演示；部分和的来由见 P2-2） |
| 为什么算完还要等其他卡？ | 缺分片就要收集，只有部分和就要归约，下一步在别的卡上就要把数据送过去；数据没到，计算只能等。 | 通过（GLM 数字见 P2-1） |
| 八种操作各让每张卡得到什么？ | 每种操作有一句话定义、一张分镜图、示意数的前后状态，以及推理里谁在用它。 | 通过（开头的分类框架见 P2-3） |
| ring All-Reduce 每一步在传什么？ | 4 张卡连成一个环，前 3 步边传边加，后 3 步把加齐的块传一圈；每张卡共发 1.5 M，也就是 2(N−1)M/N。 | 通过 |
| 通信量里的 N 和 M 到底数什么？ | 要分清三本账；表里的 M 是每卡输入，外部资料常用完整张量 S，两种口径不能直接横比。 | 通过（数值演算见 P3-4） |

#### 动图（最重要）

- 看了写手截图 cc-shot-1、cc-anim-1/2/3；又用 Playwright（1440×900）在 http://localhost:5193/#/wiki/collective-communication 逐张操作 9 张原语分镜和 ring 图，存了开始、飞行中、结束三帧：`cc-review-{cc,broadcast,scatter,gather,all-gather,reduce,reduce-scatter,all-reduce,all-to-all}-{1,fly,2}.png`，ring 第 4 帧、第 5 帧和第 4 步飞行中是 `cc-review-ring-{4,5,fly4}.png`。
- **能看出谁发给谁：是。** 每格先画出各卡手里的块；要发的块描紫色粗框，要落进的位置描紫色虚框，带着数值的紫色块停在箭头上，播放时从源块沿箭头飞进目的块。落地后，刚写入的块变成深青色，用过的输入变成灰字，圆点表示这块已经加进了哪几张卡的数。不看文字也能跟住 Broadcast、Scatter、Reduce、ring 的每一块；All-Gather、All-to-All、All-Reduce 第 2 步各有 12 条箭头，比较密，但每条箭头上的块值和源、目的框一一对应（见 P3-5）。
- 各格状态逐个手算核对，全部正确。ring 第 1 步发出 1、20、300、4000；第 3 格（第 2 步后）卡 0 是 [1, 2, 3303, 4004]、卡 1 是 [11, 20, 30, 4044]、卡 2 是 [111, 220, 300, 400]、卡 3 是 [1000, 2220, 3300, 4000]；Reduce-Scatter 3 步后，卡 0 到卡 3 依次有 2222、3333、4444、1111（与正文第 183 行一致）；All-Gather 最后一步写入卡 0 第 2 块、卡 1 第 3 块、卡 2 第 0 块、卡 3 第 1 块，最终每卡都是 [1111, 2222, 3333, 4444]。All-to-All 结果卡 0 为 [1, 10, 100, 1000]，行列正好互换。Reduce-Scatter 结束后卡 k 留 1111×(k+1)。Scatter 结束后卡 k 得到 k+1。
- 核对了原语的前后状态：对照 NCCL / HCCL 的定义，Broadcast、Scatter、Gather（按 rank 排列）、All-Gather、Reduce（SUM/MAX/MIN）、Reduce-Scatter、All-Reduce、All-to-All（卡 i 的第 j 块发给卡 j 的第 i 格）都对。ring All-Reduce 共 2(N−1)=6 步，每步每卡发 1 块；第 s 步卡 k 发第 (k−s) mod 4 块，All-Gather 段错开一格，都对。calc 里 2×3÷4 = 1.5 M 也对；通信量表 5 行公式逐行核过，都对。

#### 是否照抄参考

- 用 http 取回鲜枣课堂原文正文，与本页正文做 8 字 / 12 字片段比对：共同片段只有英文原语名和 collective communication，**没有 8 字以上的中文措辞重合**。例子换成了推理场景（TP 部分和、EP 派发），示意数用 ×10ᵏ，这套示意数是本页自己的。原语的出场顺序（一对多 → 多对一 → 多对多 → 归约）、All-to-All 的「第 i 块给卡 i」规则和转置直觉，与参考相同，但这些是 MPI / NCCL 教材的通行讲法，属于标准第 9 条允许的「学怎么讲」，**不记问题**。

#### 信息不丢、锚点、GLM 数字、audit

- 从清单里抽了 F6、F12、F19、F26、F30、F36、F41、F47、F55、F63、F68，共 11 条，新版都在（F6 在第 60 行，F12 在第 68 行，F19 在第 118 行，F26 在第 168 行，F30 在第 86 行，F36 在第 216 行，F41 在第 170 行，F47 在第 230 行，F55 在第 256 行，F63 在第 285 行，F68 在第 290 行）。`git diff` 删掉的行有这些去处：两卡字母例子换成了 4 卡数值例子；「归约和收集怎样组合」这一节挪进 ring 一节（第 196–200 行）；根操作表由 Scatter、Gather、Reduce 三个 H3 取代；Send/Recv 挪到第 170 行。没有丢失事实。
- 锚点：全库指向本页的锚点有 all-reduce、all-gather、reduce-scatter、all-to-all、broadcast、mc2、两张卡交换以后各自手里多了什么、放到-glm-双机一个-token-会在哪里通信、大批输入为什么改用-reduce-scatter，页内还有 ring-all-reduce-每一步在传什么、通信量里的-n-和-m-到底数什么，全部能解析。已删掉的「归约和收集怎样组合」「五种操作」两个旧锚点，没有入链。
- `pnpm wiki:audit`：exit 0。本页「写作标准 6925 字 · ✓行内代码 · ✓角标 0 · ✓对照源码 · ✓calc 0.29/千字 · ✓相邻块 0 · ✓图先行 · ✓免责 1.0% · ✓图宽」，**通过**。
- `pnpm wiki:diagrams --check`：exit 0，「215 张图与 spec 一致」（写手跑时是 213 张，期间别的写手又加了图），本页 11 张图没有提醒。

#### P1

无。

#### P2

1. **基础节里仍有 GLM 部署数字（标准第 12 条）**。
   - 位置：第 66 行，「为什么算完还要等其他卡？」整段在讲 GLM 双机主干的 **218 个通信调用边界**；第 156 行，All-Reduce 小节写了「CPU 上的 DP 状态同步也用一次 8 B 的 All-Reduce」。09-29 排查已经点过这一节，本轮原样保留了。
   - 问题：「为什么」一节是基础节，初学者在这里还没见过 GLM 双机，218 和 8 B 是先用后讲。
   - 改法：第 66 行改成不带数字的一句，例如「真实部署里，一次前向会经过上百个这样的交接点，逐项清单见 GLM 双机一节」，218 挪进 GLM 一节，那里原本就有次数账；第 156 行删掉「8 B」，只留「DP 状态同步也会用 All-Reduce，见 GLM 双机一节」。
2. **首个例子只断言部分和，没有演示它从哪来**。
   - 位置：第 52 行「每张卡只乘了一半的权重：卡 0 得到 [1, 2]，卡 1 得到 [10, 20]」。
   - 问题：「一半的权重」没有说是按哪一维切。初学者如果理解成按列切，就会以为两份结果应该拼接而不是相加，这恰好是 All-Gather 和 All-Reduce 的分界。图下图注说「两张卡各算出一半的结果」，也会加重这个误解。09-29 排查要的「一个矩阵按行切、各算部分和、相加才对」的小演算，本轮仍缺。
   - 改法：在第 52 行前加一个 2–3 行的 calc，例如 x = [1, 1]，W 的第 1 行给卡 0、第 2 行给卡 1，卡 0 算出 x₁·W₁ = [1, 2]，卡 1 算出 x₂·W₂ = [10, 20]，相加得 [11, 22] = x·W。再用一句话对照：按列切得到的是拼接关系，对应 All-Gather。图注改成「各算出一份部分和」。
3. **「三件事」的分类框架区分不了几组操作**。
   - 位置：第 60 行说八种操作是「谁发、拼还是加、结果给一张卡还是每张卡」这三件事的不同组合。
   - 问题：按这三个维度，All-Gather 与 All-to-All（每卡都发、不求和、每卡都拿）落在同一格，Reduce-Scatter 与 All-Reduce 也落在同一格，Broadcast 与 Scatter 也分不开。读者拿这个框架去归类会卡住，核心分类讲得不准。
   - 改法：第三件事改成三个取值：「结果只给一张卡 / 每张卡一整份 / 每张卡各一片」。这样八种操作正好各占一格，可以附一张 8 行小表或一句话逐一对应。

#### P3

1. 第 58 行「点『下一步』看数据块沿箭头飞到对方卡上」是界面操作说明，属于页面上的元说明，建议删掉，只留颜色图例；「数为示意」在图角旁注、图注、正文里重复出现 3 次，留一处即可。
2. 第 185 行「所有卡之间的链路同时在用」容易读成两两之间的全部链路，建议改成「环上每一段链路同时在用」。
3. 原语图里，接收方也画成 4 格（Scatter 只填第 k 格，Gather 的输入只占第 k 格），相当于按 in-place 缓冲来画。这没有错，但正文第 92 行说「每张卡只拿到属于自己的那一块」，可以在图例里补一句「空格只是占位」。
4. 通信量一节讲 M 和 S 两种口径时没有代一次数。可以直接用本页 4 卡 × 4 块的例子：All-Gather 的 M 是 1 块、每卡发 3 块，Reduce-Scatter 的 M 是 4 块、每卡也发 3 块，换成 S 以后都是 (N−1)S/N。
5. All-Gather、All-to-All、All-Reduce 第 2 步各有 12 条箭头，对角线上的块值挤在交叉点附近；圆点半径 2.4 px，偏小。可以考虑把对角箭头上的块往各自源端挪一些，圆点加大到 r≈3。

### 代码（scripts/wiki/figure.ts、figure.test.ts、WikiDiagram.tsx、DiagramPlayer.tsx、DiagramPlayer.test.ts、wiki.css）

#### 只做加法：是

- `git diff --stat`：figure.ts +338 / −0，4 个 hunk 全是 `exchanges` 的 schema、`exchangeStates`、`exchangeLayout`、paint 分支和 `figureWords` 收词。`spec.exchanges` 默认为 `[]`，其他图不会走到这些分支。wiki.css 只新增 `.wiki-anim-*`。
- WikiDiagram.tsx 有两处行为变化，都影响所有图，但结果无害：一是 `{__html}` 对象改为跟着 `safe` 缓存，只是少了一次重写；二是每张图都挂一个 `DiagramPlayer`，没有分镜时 `bands` 为空，返回 null。`pnpm wiki:diagrams --check` 显示 215 张一致，静态输出没有变化。

#### 播放器边界（Playwright 实测，脚本 `cc-review.mjs edge/reduced`）

- 步数 0 或 1：`bands.length < 2` 时不渲染按钮（DiagramPlayer.tsx:205）。schema 要求至少 1 步，所以至少有 2 格，这条分支实际走不到。
- 多个播放器：点 ring 的「下一步」，Broadcast 仍是 1 / 2，互不影响。
- 播放中按「上一步」：停止播放并退一格，按钮回到「播放」，没有残留位移，正确。
- prefers-reduced-motion：点「下一步」67 ms 就换格，全程没有位移；「播放」仍按 1.1 s 一格往下走，合理。
- 快速连点：真实的双击，第二下点到的按钮已经禁用。同一个任务里用脚本连发 5 次 click，最后只前进 1 格，状态一致；但被打断的 4 次飞行各自执行了 `setBusy(false)`，飞行中按钮又变回可点（见 P3-2）。

#### P1

无。

#### P2

1. **键盘连按「下一步」会丢焦点**。
   - 位置：DiagramPlayer.tsx:239 `disabled={atEnd || busy}`。
   - 复现：Tab 到 ring 图的「下一步」按 Enter，飞行期间按钮被禁用，焦点掉到 `BODY`；2.6 s 后再按 Enter 没有反应（计数停在 3 / 7）；此时按 Tab，焦点跳到图后面正文里的「序列并行」链接。
   - 影响：键盘用户每走一步都要 Shift+Tab 再 Tab 回到按钮，没法连着看完 6 步。走到最后一格时按钮同样被禁用，焦点也会丢。
   - 改法：飞行期间不要设 `disabled`，改用 `aria-disabled` 加上在 `advance` 里直接忽略（`busy` 已经在拦了）。只在 `atEnd` 时真正禁用，并在到达最后一格时把焦点移到「从头播放」。

#### P3

1. **页面加载后约 2 s 内点「下一步」会被吞掉**。
   - 现象：页面加载后约 2 s，11 张图会整体重新挂载一次（用 MutationObserver 实测只有这一次，之后 60 s 内没有再挂载）。这段时间里按「下一步」，飞行会被丢弃，新实例从 `memory` 恢复的是旧的 step，而且 `playing=false`，所以这一下没有任何效果。
   - 复现：`cc-review-rs.mjs` 里 reduce-scatter 第一次点击前后都是 1 / 2，remounts 计数为 11；等 6 s 后再点就正常。
   - 写手记录里说「正在飞的那一步会从头再飞一次」，这只在「播放」状态下成立。
   - 根因是 WikiPage 的 `components` 写成内联对象，写手已列为遗留。建议至少把记录改准，或者在 `memory` 里也记下「有一步正在飞」，重新挂载后接着飞。
2. 被打断的飞行会执行 `setBusy(false)`（DiagramPlayer.tsx:189），把正在进行的那趟飞行的 busy 也清掉。真实用户点不出这个情况，但可以只让「当前这一趟」清 busy，例如比较 token。
3. `memory` 是模块级的（第 66 行），离开本页再回来，图会停在上次的格子上：实测离开前是 2 / 7，回来还是 2 / 7。它本来是为「重渲染」设计的，但对「重新访问」也生效，读者回来时看到的是中间状态。建议在页面卸载时清掉，或者按页面访问来区分。
4. 测试覆盖：figure.test.ts 新增的 4 条覆盖了分镜的状态推演、同一步同时发生、keep、各类报错、SVG 结构和路线；DiagramPlayer.test.ts 只测了 `parseRoute`、`pointAlong`、`ease` 这几个纯函数，**步进逻辑（busy / 禁用 / 恢复 / 减少动效）没有自动测试**。仓库没有 jsdom / testing-library，建议把步进状态机抽成纯 reducer 再测。
5. **死代码待清理**：`src/content/wiki/CollectiveDemo.tsx` 现在只被它自己的测试 `CollectiveDemo.test.ts` 引用，`wiki.css` 第 2222–2295 行的 `.wiki-collective*` 也已经没人用。`docs/wiki-assets-and-attribution.md:12` 还把它列为「通信分步演示」，这是过时的说明。删不删由用户决定。

#### 测试结果

`npx vitest run scripts/wiki/figure.test.ts src/content/wiki/DiagramPlayer.test.ts`：2 个文件，**30 条全过**（figure 27 条，player 3 条）。typecheck 和 eslint 由主会话跑过，本审查没有重复。

## 用户反馈修订审查后修订（09-29）

按上一节审查意见修改：页面 P2 3 条、代码 P2 1 条全部关闭，页面 P3 5 条、代码 P3 5 条也都处理了。动图的画法和交互保持不变。

### 页面 P2

1. **基础节不再放 GLM 部署数字**：「为什么算完还要等其他卡？」第 73 行改成不带数字的说法，说明真实部署要经过很多交接点，具体次数链接到 GLM 一节。「218 个通信调用边界」和「218 不是网络包数」两句挪进 GLM 双机一节的第二段（第 248 行），完整次数账的链接一并带过去。All-Reduce 小节删掉「8 B」，只保留「DP 状态同步也会用 All-Reduce」加链接，8 B 仍在 GLM 一节第 250 行。
2. **补上部分和从哪来**（第 52–58 行，按列切的对照在第 65 行）：用示意数 x = [1, 2]，W 的两行是 [1, 2] 和 [5, 10]，先算完整结果 x·W = 1 × [1, 2] + 2 × [5, 10] = [11, 22]；再把 W 按行切给两张卡，卡 0 算出 [1, 2]，卡 1 算出 [10, 20]，两份相加才是 x·W。图后补一段按列切的对照：卡 0 得到 11，卡 1 得到 22，每张卡手里已经是完整结果的一个数，只要拼起来，对应 All-Gather。首图图注改为「各算出一份部分和」。Reduce 小节也补了一句：4 张卡的数就是按行切出来的 4 份部分和。审查建议用 calc 块，没有采用，改成正文加两条列表：页面第一个 calc 如果放在第一张图之前，会触发 audit 的「图先行」规则。
3. **三个问题能把八种操作分开**：第 67 行把第三问改成三个取值，「只给一张卡 / 每张卡同样的一整份 / 每张卡各不相同的一份」。「八种操作」一节开头（第 85 行）加了一张 8 行对照表（谁拿出数据、到了对方手里、结果给谁），表下一句点出三对最容易混的：Broadcast 与 Scatter、All-Gather 与 All-to-All、Reduce-Scatter 与 All-Reduce。

### 页面 P3

1. 删掉「点『下一步』看……」这句界面操作说明。10 张图的图注去掉「数为示意」，保留图角的旁注和正文里的首次说明。
2. 「所有卡之间的链路同时在用」改为「环上每一段链路同时在用」（第 207 行）。
3. 图例补一句：空白格子只是占位，表示这张卡手里没有这一块。
4. 通信量一节在 M / S 口径段后代一次数（第 238 行）：All-Gather 的 M 是 1 块，每卡发 3 块；Reduce-Scatter 的 M 是 4 块，每卡也发 3 块；换成 S = 4 块都是 (N−1)S/N；All-Reduce 合计 6 块，即 1.5 M。
5. 渲染器里的圆点半径从 2.4 改为 3，间距从 7 改为 8。斜线上双向的块放在 0.2 处（原来是 0.3），离自己的源端更近，交叉点附近不再挤。

### 代码 P2：键盘焦点

- `DiagramPlayer.tsx`：飞行期间「下一步」不再设 `disabled`，改为 `aria-disabled="true"`，点击时直接忽略。只有走到最后一格才真正禁用。按「下一步」走到头、按「上一步」退到头时，焦点移到主按钮（「从头播放」或「播放」）。按钮状态和焦点去向抽成纯函数 `controlState`、`focusAfter`。
- `wiki.css`：`[aria-disabled="true"]` 与 `:disabled` 用同一种淡化样式，悬停不高亮。
- 测试：`DiagramPlayer.test.ts` 新增 3 条：飞行中不真禁用、到头才禁用；到头或退到头时焦点交给主按钮；重新挂载时接着播。
- 实测（`cc-keys.mjs`，Playwright 1440 宽）：焦点放在 ring 图的「下一步」上，连按 6 次 Enter。每次飞行中焦点都还在「下一步」，此时 aria-disabled=true；落地后计数依次是 2/7 … 6/7；第 6 次落地后焦点移到「从头播放」，计数 7/7。

### 代码 P3

1. **加载后约 2 s 内点「下一步」被吞**：memory 里加记「卸载时有一步正在飞」，重新挂载后补飞。实测（`cc-early.mjs`）：加载后立刻点 reduce-scatter 的「下一步」，期间正文重挂 18 个节点，6 s 后是 2/2。
2. **被打断的飞行清掉别人的 busy**：`advance` 记下自己这一趟的代号，只有代号没变时才清 busy、才前进。暂停和「上一步」自己负责清 busy。
3. **离开本页再回来仍停在旧格子**：卸载时记下时刻，卸载超过 1 s 再挂载就从第 1 格开始；同一次阅读里的重挂载接着播。只有写过记录的实例才记卸载时刻：开发模式下 StrictMode 会先把刚挂上的实例卸一次，这一次如果记了，回来的时候会误判成「刚卸载」。实测（`cc-revisit.mjs`）：走到 2/2，换到 tensor-parallel 页再回来，是 1/2。
4. **测试覆盖**：见代码 P2 新增的 3 条。仓库没有 jsdom，所以把步进规则抽成纯函数来测，DOM 上的焦点和飞行靠上面的 Playwright 脚本实测。
5. **死代码**：先 grep 确认 `CollectiveDemo`、`collectiveResult`、`.wiki-collective*`、`wiki-transfer-pulse` 在 src、scripts、tests、server 里都只有它们自己在用，然后删除了 `src/content/wiki/CollectiveDemo.tsx`、`CollectiveDemo.test.ts`，以及 `wiki.css` 里这组组件的 75 行样式。`docs/wiki-assets-and-attribution.md:12` 那条过时说明按「不动别的」的要求没改，留给用户。

### 验证（本轮实跑）

- `pnpm wiki:lint`：exit 0，输出里没有本页。
- `pnpm wiki:diagrams --check`：exit 0，「220 张图与 spec 一致」，本页没有提醒。
- `pnpm wiki:audit`：exit 0。本页写作标准 7,510 字，行内代码 0.0/千字，角标 0，对照源码 ✓，calc 0.27/千字，相邻块 0，图先行 ✓，免责 0.9%，图宽 ✓。
- `pnpm typecheck`：exit 0。
- `npx vitest run scripts/wiki/figure.test.ts src/content/wiki/DiagramPlayer.test.ts`：2 个文件 33 条全过（figure 27 条，player 6 条）。改动文件跑 `biome check` 无错误，警告从 15 条降到 14 条，删掉的是旧 `.wiki-collective` 那一条。
- 锚点：本页和所有入链页用 `anchors.mjs` 核过，0 条坏链。
- 截图已重拍（会话 scratchpad）：cc-shot-1.png 是第一屏，能看到部分和的示意演算；cc-anim-1/2/3.png 是 ring 图的开始、第 3 步飞行中和结束（7/7，焦点在「从头播放」）。控制台无报错。

遗留：`WikiPage.tsx` 的 `components` 仍是内联对象，页面一重渲染，图就整体重新挂载。播放器已能接着播，根治不在本轮范围。本页 P1/P2：无。
