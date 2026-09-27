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
