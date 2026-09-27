# 审查：wiki/concepts/learning-guide.md（阅读指南 / 知识库入口）

- 审查对象：`wiki/concepts/learning-guide.md`（99 行，工作树当前版本）
- 对照：`src/content/wiki/toc.ts`（26 行分组表逐行核对）、`wiki/concepts/glm-5-3-flash.md`、`wiki/concepts/glm-5-3-flash-two-node.md`、`wiki/concepts/one-request.md`、`wiki/concepts/concurrent-requests.md`、`wiki/concepts/request-call-chain.md`、`wiki/sources/glm-5-3-flash-baseline.md`、`wiki/TERMS.md`、`wiki/diagrams/learning-guide-route.yaml`
- 规则来源：主仓 `C:\Users\-\Desktop\infra-view-new\PLAN.md` 第 9 行与第 115–125 行的证据等级表；`src/content/wiki/evidenceMarks.ts`（`EVIDENCE_MARK_RE`、`NUMBERED_EVIDENCE_LEVELS`，被 `scripts/wiki/lint.ts:7` 引用）；`src/content/wiki/Term.tsx:11-18`（角标 tooltip 文案）
- 实际运行：`npx tsx scripts/wiki-lint.ts` → `ok wiki:lint 通过（另有 23 处待留意）`，23 条全是别的页的 `mark-flood`，本页 0 条；链接存在性用 shell 逐个 `-f` 判；免责句占比用 Python 按「。！？/换行」分句统计
- 没做的：没有在浏览器里渲染本页；没读 `wiki/HANDBOOK.md` 和 `docs/plans/`（任务要求跳过），所以「通用概念词句中小写」这条规则只对到 `TERMS.md` 与代码，没对到 HANDBOOK 原文

## 一、10 项评分

| # | 项 | 分 | 理由 |
|---|---|---|---|
| 1 | 初学者读完开头知道讲什么、从哪开始 | 2 | 第 20 行一句话定题（「一段文字……被怎样算成了回答」），第 22–28 行三条固定前提成表，第 36 行直接说「第一次读，按下面五页的顺序走一遍」，第 46 行还交代了门槛（前四页会矩阵乘法即可，第 5 页要会看 Python 调用栈）。扣分点只有 vLLM / vllm-ascend 从没解释（见 P2-5），不影响「知道从哪开始」 |
| 2 | 阅读顺序合理，每步写清「读完能回答什么」 | 2 | 五行 18 个问题逐条能对上目标页的真实小节：第 1 行对 `glm-5-3-flash.md` 的 55/77/103 行标题，第 2 行对 `glm-5-3-flash-two-node.md` 的 87/141/168/209 行，第 3 行对 `one-request.md` 的「七站」与第 4/5 站，第 4 行四问分别对 `concurrent-requests.md` 的 104/121/209/356 行，第 5 行对 `request-call-chain.md` 的 89/117/167/229 行。顺序也是「要算什么 → 放在哪 → 一条请求 → 多条请求 → 代码」，没有前置倒置 |
| 3 | 26 行分组→主线对照表 | 1 | 分组名与小节名逐行与 `toc.ts` 完全一致（7 个分组 26 个小节，一字不差）；抽查 10 行的首两页标题，9 行的主线归属成立。扣分：漏「开始学习」分组（P2-2）、「外部 KV cache 与 connector」挂错主线步（P3-6）、「组件、职责与进程」没说明主线第 5 页就编在这一节里（P3-7） |
| 4 | 链接全部指向存在的页，无已合并 id | 2 | 全页 7 条链接：`glm-5-3-flash.md`、`glm-5-3-flash-two-node.md`、`one-request.md`、`concurrent-requests.md`、`request-call-chain.md`、`rfork.md`、`../sources/glm-5-3-flash-baseline.md`，逐个 `test -f` 全部存在；`ai-qos`、`superpod`、`epd-disaggregation`、`who-owns-what`、`paged-attention`、`flash-attention-3`、`qwen-request-legacy`、`rfork-terms`、`rfork-memory` 全文 grep 均无命中 |
| 5 | 数字只写结论且与来源页一致 | 2 | 45 层 / 4096 / 154880 对 `glm-5-3-flash.md:42-44`；2 台 Atlas 800 A2、每台 8 张卡、16 张卡一套服务对 `glm-5-3-flash-two-node.md:49`；TP8 / DP2 / EP16 对同页 55–57 行（DP 的「两个调度组」释义与第 56 行「各自有自己的 scheduler」一致）；W8A8 对同页 38/79 行；vLLM 0.23.0 与「镜像里最终装的上游版本待核」对 `wiki/sources/glm-5-3-flash-baseline.md:5,103`。本页没有出现任何自行推导的算式 |
| 6 | 不出现「完整模型副本」 | 1 | 字面没有出现（grep 无命中），但第 30 行的替代说法与 `glm-5-3-flash-two-node.md:89` 直接冲突，见 P1-1 |
| 7 | 术语首次出现有中文解释、大小写合规 | 1 | MoE、TP/DP/EP、W8A8、NPU、token、KV cache、MTP、worker、HBM 首次出现都带了中文解释，第 93 行也把规则本身讲清楚了；正文里 token/prefill/decode/scheduler 确实小写，`lm_head`、`Scheduler`、`EngineCore`、`Model runner` 等大写形式全部来自 `toc.ts` 的小节名，属于照搬原文。扣分：prefill（P2-4）、decode（P3-11）、NPU 与 worker（P3-10）四处释义与 `TERMS.md` 口径不一致；vLLM / vllm-ascend / HCCL / connector 没有解释 |
| 8 | 角标说明与仓库规则一致 | 2 | 第 97 行七档释义与 `PLAN.md:117-123` 和 `src/content/wiki/Term.tsx:12-18` 几乎逐字一致；「`S`、`C`、`M` 三档带编号」与 `evidenceMarks.ts:29` 的 `NUMBERED_EVIDENCE_LEVELS = {S, C, M}` 一致；「鼠标停在角标上会显示说明」「带编号的可点」对 `Term.tsx:73-80`，「页面顶部还有一个整页的等级」对 `src/app/pages/WikiPage.tsx:261`。只差一个词（P3-9） |
| 9 | 路线图能否帮读者看清路线 | 1 | `learning-guide-route.svg` 与 yaml 同一时间已生成，坐标不越界（最大 888×494 < 900×540），入口→1→2→3→4→5 的箭头链清楚。扣分：正文表的核心信息（每组挂在哪一步）完全没进图（P3-12）；caption 的「十个分组」与侧栏实际 11 组不符（P2-2b）；note 行只排除两个分组，与正文「三个分组」不一致 |
| 10 | 免责句占比 < 3% | 2 | 脚本统计（去 frontmatter，按「。！？」和换行分句，长度 > 4）：含「不能/不等于/尚未/并非/不代表」的句子 0 / 95 = 0.0%。页面里的「不是两套」「不是课文」属于澄清句，不是免责句 |
| | **总分** | **16 / 20** | |

## 二、问题清单

### P1

**P1-1 第 30 行把「16 卡都切开」说成全部权重，与第 2 页正面冲突**

- 文件:行 — `wiki/concepts/learning-guide.md:30`
- 问题 — 本页写「权重被切开分给 16 张卡，哪一台机器上都没有完整的一份」。按这套部署，只有 288 个路由专家是按 EP16 摊到 16 张卡上的；attention、稠密层和共享专家是**每台机器各有一份**，在机内按 TP8 切成 8 份。
- 证据 — `wiki/concepts/glm-5-3-flash-two-node.md:89` 原文加粗写着「attention、稠密层和共享专家每台机器各有一份，288 个路由专家 16 张卡合起来只有一份」；同页 141 行「切法分三种。按 **EP** 切的只有路由专家……按 **TP** 切成 8 份的是 KDA 的 q / k / v / o 四个大投影」；同页 55 行 TP=8 的说明是「同一个矩阵横着切给同一台机器里的 8 张卡」。
- 影响 — 这是入口页唯一一句建立「有几份」心智模型的话，而且正是为了避开「完整模型副本」这个错误说法而写的。读者按它建立的模型在第 2 页第 89 行会被当场推翻，违反 CLAUDE.md「单一真相源」。
- 建议改法 — 换成结论口径、与第 2 页同源的一句：「占权重 86% 的路由专家按 EP16 摊在 16 张卡上，一台机器只有一半；attention 和稠密部分每台机器各有一份，在机内切成 8 份。所以两台机器不是两套各自能独立服务的副本，每一步都要通信。」

### P2

**P2-2 对照表漏掉「开始学习」分组，路线图 caption 又把分组数写成十**

- 文件:行 — `wiki/concepts/learning-guide.md:54-84`；`wiki/diagrams/learning-guide-route.yaml:3`
- 问题 — 侧栏实际有 11 个分组（`src/content/wiki/toc.ts:36-48` 的 `PARTS`，`WikiPage.tsx:135` 给每个 part 都编了中文序号），第一个是「开始学习」。本页 26 行表覆盖第 2–8 组，第 85–89 行另说了 RFork / 参数参考 / 来源与更新记录三组，唯独没交代「开始学习」这一组是什么；图注则直接写「左侧目录就按这十个分组排列」。
- 证据 — `toc.ts:37` `{ id: "guide", title: "开始学习" … }`，`toc.ts:52-55` 该组含 `learning-guide`、`glm-5-3-flash`、`one-request`、`concurrent-requests`，`buildToc` 只在 sections 为空时才丢弃分组，本组非空。
- 影响 — 读者对着左栏数不出「十个」；而且「开始学习」里正好放着主线第 1、3、4 页，最该被指认的一组反而没说。
- 建议改法 — 在 85 行那段前加一句「左栏第一组『开始学习』就是本页加主线里的三页，读完就可以跳到别的组」；图注改成「左侧目录的第一组是这条主线，其余十组按下面的位置排列」。

**P2-3 `relations: []` 让入口页底部的「接着看」接不上主线**

- 文件:行 — `wiki/concepts/learning-guide.md:11`
- 问题 — 本页 frontmatter 的 `relations` 是空数组，26 行对照表里的分组/小节名也全都不是链接。整页可点的出口只有正文里的 7 条链接，而页面底部「接着看」按反向边渲染，只会出现 `glm-5-3-flash` 一条。
- 证据 — `scripts/wiki/build.ts:64-79` 由别页的 `relations` 反推 backlinks；全仓只有 `wiki/concepts/glm-5-3-flash.md:18` 一条 `to: learning-guide`；`src/app/pages/WikiPage.tsx:409-414` 的 `WhatsNext` 在分组为空时直接不渲染。
- 影响 — 入口页的职责就是转出去，结果底部导航只有一条，且是「谁用到它」方向；`two-node`、`one-request`、`concurrent-requests`、`request-call-chain` 四页都不会出现在底部。
- 建议改法 — 给本页补 5 条指向主线的 `relations`（note 直接复用表里「读完能回答的问题」），或者至少把 26 行表的「小节」列改成指向该小节首页的链接（如 `输入表示与张量计算` → `token.md`）。

**P2-4 prefill 释义「把提示词一次算完」与第 3 页的示例矛盾**

- 文件:行 — `wiki/concepts/learning-guide.md:42`
- 问题 — 括注写「prefill，把提示词一次算完」，但本页自己在第 64 行就列了「Chunked prefill」小节，第 3 页的示例更是按 4 个 token 的预算分块算的。
- 证据 — `wiki/TERMS.md:39`「处理提示词中尚未计算的位置并建立历史状态，可以整段或分块执行」；`wiki/concepts/one-request.md:170`「第 2 站 调度：4 个 token 的预算和 15 个块号」。
- 影响 — 初学者带着「一次算完」读第 3 页，会在第 2 站直接卡住。
- 建议改法 — 改成「prefill，把提示词里还没算过的位置算出来，可以整段也可以分块」。

**P2-5 vLLM / vllm-ascend 在入口页从未解释**

- 文件:行 — `wiki/concepts/learning-guide.md:27-28`
- 问题 — 「vllm-ascend 官方教程」「vLLM 0.23.0」「执行侧按 GLM 专用镜像对应的 vllm-ascend 快照读」是这两个名字的首次出现，全页没有一句说它们是什么；第 68–72 行还有一整个分组叫「vLLM 与 Ascend 架构」。
- 证据 — 全页 grep 只在 27、28、68、69、70、71、72 行出现这两个词，均无括注；`wiki/TERMS.md` 没有这两行（所以 lint 也不会报）。
- 影响 — 面向初学者的入口页，读者不知道自己在读哪套软件的行为。
- 建议改法 — 在第 28 行源码一行里补一次括注：「vLLM（开源推理引擎）／vllm-ascend（vLLM 的昇腾适配层）」。

### P3

**P3-6「外部 KV cache 与 connector」挂到 decode 不准**

- 文件:行 — `wiki/concepts/learning-guide.md:67`
- 问题 — 该行写「decode：把历史放到引擎之外」，但这一小节的两页讲的是前缀匹配与加载，属于 prefill 前的复用。
- 证据 — `toc.ts:91` 该节 = `kv-pool`、`lmcache`、`ucm`；`kv-pool` 标题「外部 KV 池：前缀匹配、加载和完成状态」。
- 建议改法 — 改成「调度与 prefill：把历史放到引擎之外，命中了就不重算」。

**P3-7「组件、职责与进程」没说明主线第 5 页就在这一节里**

- 文件:行 — `wiki/concepts/learning-guide.md:68`
- 问题 — 该行「什么时候读」写「和第 5 页一起读」，但 `request-call-chain`（主线第 5 页）本身就编在这一节里；相邻的「贯穿案例」行就正确写了「主线第 2 页本身」。
- 证据 — `toc.ts:96` `pages: ["vllm-v1-shape", "vllm-ascend-overview", "engine-processes", "request-call-chain"]`。
- 建议改法 — 改成「主线第 5 页就在这一节里，它前面三页是同一组件的展开」。

**P3-8 对「对照源码」这一节的描述不完整，且「真实设备结论单独列出」不成立**

- 文件:行 — `wiki/concepts/learning-guide.md:32,95`
- 问题 — 第 95 行说这一节「通常有版本差异和源码位置」，实际主线两页还有「怎么开 / 会报什么错 / 开销和什么时候别开」三个固定小节；第 32 行说「哪些结论要拿真实设备才能定下来，各页会在『对照源码』里单独列出」，但第 2 页的待核项写在正文里。
- 证据 — `glm-5-3-flash-two-node.md:293-321` 与 `concurrent-requests.md:398-431` 的小节；`glm-5-3-flash-two-node.md:109` 的「**待核：**……缺一次实机验证」在正文段落中，不在 `## 对照源码` 内。
- 建议改法 — 第 95 行补上另外三个小节名；第 32 行把「在『对照源码』里单独列出」放宽成「各页用**待核**标出」。

**P3-9 `!` 角标漏掉「实验状态」**

- 文件:行 — `wiki/concepts/learning-guide.md:97`
- 证据 — `PLAN.md:123` 与 `src/content/wiki/Term.tsx:18` 都是「版本冲突、实验状态或当前禁配」，本页只写了「版本冲突或当前禁配」。
- 建议改法 — 补两个字。（同处 `I` 写成「推断或本站的编排」，比 PLAN 的定义宽，属于本站用法的扩展，可保留但最好写成「推断，包括本站的编排」。）

**P3-10 NPU、worker 的释义与 TERMS 的告诫相反**

- 文件:行 — `wiki/concepts/learning-guide.md:32,87`
- 证据 — `wiki/TERMS.md:81` NPU =「昇腾计算处理器；本库部署语境指软件可见的计算设备」，备注「软件设备、物理封装与板卡分别计数」，本页写成「昇腾加速卡」；`wiki/TERMS.md:73` Worker 备注「角色不总是独立进程」，本页写成「管一张卡、真正跑前向的进程」。
- 建议改法 — NPU 改「昇腾的计算设备」；worker 改「管一张卡、真正跑前向的执行角色」。

**P3-11 decode 释义「每次只往前走一个位置」与第 3 页的 MTP 冲突**

- 文件:行 — `wiki/concepts/learning-guide.md:42`
- 证据 — `one-request.md:455`「第二圈和第三圈：decode 步一次验证 1 + 3 个 token」；`TERMS.md:40`「普通自回归常每轮处理一个新位置，投机路径可处理多个」。
- 建议改法 — 加半句「（用上 MTP 时一步可以推进多个）」，或直接写「每次在已有历史上往前走」。

**P3-12 路线图没把「分组挂哪一步」画出来**

- 文件:行 — `wiki/diagrams/learning-guide-route.yaml:12-21,31`
- 问题 — 图里只有两排箭头（入口→第 1 页，1→2→3→4→5），十个分组盒子与主线之间没有任何连线，caption 承诺的「各展开主线的某一步」在图上看不出来；RFork/参数参考/来源与更新记录三个盒子与其余七个外观完全一致（都是 `tone: ink, style: plain`），但正文第 85 行说这三组不挂主线；第 31 行的注释又只排除了两组。
- 建议改法 — 给前七个分组各画一条到对应主线盒子的虚线（或按主线步骤分列对齐），把三个不挂主线的分组换一种 tone 单独成排，并把第 31 行改成「RFork、参数参考和来源记录不对应主线的某一步」。

**P3-13 固定前提表的数字没有来源角标**

- 文件:行 — `wiki/concepts/learning-guide.md:22-28`
- 问题 — 45 层 / 4096 / 154880 / TP8 / DP2 / EP16 / W8A8 都是 `[S]`/`[C]` 级的事实，本页只在第 22 行引导句上标了一个 `[I]`，frontmatter `sources` 也只有一条 `config.json`。lint 不报（本页无告警），但读者悬停时得到的是「推断」。
- 建议改法 — 保持「只写结论」不变，把结论的依据交给链接列那一列即可，或给模型行补一个指向 `config.json` 的 `[S1]`。

## 三、初学者视角最卡的三处

1. **第 30 行的「哪一台机器上都没有完整的一份」**。入口页教读者「16 张卡把权重全切开了」，第 2 页第 89 行却加粗告诉他 attention 和稠密层每台机器各有一份——刚建立的心智模型两页之后就得推翻，而这正是最容易绕晕、最需要一次讲对的地方。
2. **26 行表看完没处可点**。分组和小节名都是纯文本，页面底部的「接着看」又因为 `relations: []` 只剩一条反向链接。读者在表里认出「我要读 Block table 与 prefix caching」，接下来只能回左栏用眼睛在 11 个分组里找同名小节。
3. **prefill 的括注和第 3 页对不上**。带着「把提示词一次算完」进第 3 页，第 2 站标题就是「4 个 token 的预算」；同一段里的 decode「每次只往前走一个位置」在第三圈又变成「一次验证 1 + 3 个 token」。两个最基础的词在主线上各自被打脸一次。

## 四、修订记录（2026-09-27，写手按本报告修订）

改动只落在 `wiki/concepts/learning-guide.md` 与 `wiki/diagrams/learning-guide-route.yaml`（含重新生成的同名 `.svg`）。

| 编号 | 处理 | 落点 |
|---|---|---|
| P1-1 | 按 `glm-5-3-flash-two-node.md:89` 改成三分口径：attention、稠密层、共享专家每台机器各有一份并按 TP8 机内切 8 份；288 个路由专家按 EP16 摊开、16 卡合起来才有一份；每台机器是独立调度单位但跑不完整个模型 | 正文「这 16 张卡是一套服务」一段 |
| P2-2 | 表头改写成「左栏一共 11 个分组……本表覆盖前 8 组」，补「开始学习 / 阅读路线」「开始学习 / 模型与请求概览」两行；表后一句改成「剩下三个分组不在上表里」；图注改为「左侧目录的第一组就是这条主线，其余十组按下面的位置排」 | 对照表 + yaml caption |
| P2-3 | frontmatter 补 4 条 `builds-on`（two-node / one-request / concurrent-requests / request-call-chain，note 复用「读完能回答的问题」）；`glm-5-3-flash` 已有 `builds-on → learning-guide`，再写反向边会触发 `relation-duplicate`，故不补。对照表 26 个小节名全部改成指向该组首页的链接。实算 `groupRelations` 结果：先读这些 → concurrent-requests、glm-5-3-flash-two-node、one-request、request-call-chain；谁用到它 → glm-5-3-flash，五页都在 | frontmatter + 对照表 |
| P2-4 | prefill 释义改为「把提示词里还没算过的位置算出来，可以整段也可以分块」（对 `TERMS.md:39`） | 主线表第 3 行 |
| P2-5 | 部署行补「vllm-ascend（vLLM 的昇腾适配层，vLLM 是一个开源推理引擎）」 | 固定前提表 |
| P3-6 | 改为「调度与 prefill：把历史放到引擎之外，命中了就不重算」 | 对照表 |
| P3-7 | 「什么时候读」改为「主线第 5 页就编在这一节里，它前面三页是同一批组件的展开」 | 对照表 |
| P3-8 | 「对照源码」一节补齐五个固定小节名与出现顺序；「在『对照源码』里单独列出」放宽为「各页用**待核**标出」 | 怎么用一节 + 前提段 |
| P3-9 | `!` 补「实验状态」；`I` 改为「推断，也包括本站的编排」 | 角标段 |
| P3-10 | NPU 改「昇腾的计算设备」；worker 改「执行角色」 | 前提段 + RFork 条 |
| P3-11 | decode 释义改为「在已有历史上继续往前走，一步不一定只走一个位置」（避免在 MTP 释义之前先用 MTP） | 主线表第 3 行 |
| P3-12 | 路线图重排：七个跟主线的分组按列对齐到它接的那一页，五条虚线从主线盒子落下来；RFork / 参数参考 / 来源与更新记录换成 `faded` 单独成排，注释改成「这三组不跟主线的某一步走」 | yaml + svg |
| P3-13 | 模型行补 `[S1]` 指向 `config.json`（与 `one-request.md` 源码位置表同口径），其余数字仍只写结论、靠链接列承载 | 固定前提表 |

验证：`wiki:lint` 通过（仍是别页的 23 条 `mark-flood`，本页 0）；`check:content` 通过；`wiki:diagrams --check` 141 张与 spec 一致；svg 用 Playwright 截图复看，无越界与重叠。未在浏览器里渲染阅读页（本轮不起 dev server）；`src/app/pages/WikiPage.tsx:206-207` 仍硬编码旧标题「阅读指南：从模型计算走到推理服务」，`src/content/wiki/registry.json` 也还是旧标题，均超出本次可改文件范围，待另行处理。
