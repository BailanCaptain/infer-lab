# 审查 R2：learning-guide 的 4 条意见落实情况 + 分组改名

- 审查对象：`wiki/concepts/learning-guide.md`（107 行，工作树当前版本）、`src/content/wiki/toc.ts`、`src/content/wiki/toc.test.ts`、`tests/wiki.spec.ts`
- 对照：`wiki/TERMS.md`、`wiki/seeds/vllm-ascend.yaml`、`HANDOFF-LLM-WIKI.md`、`wiki/sources/glm-5-3-flash-baseline.md`、`wiki/diagrams/learning-guide-route.yaml`、`src/content/wiki/{Term.tsx,relations.ts,schema.ts,registry.json}`
- 实际运行：
  - `git -C tools/repos/vllm-ascend rev-parse` / `describe --all`、`git -C tools/repos/vllm rev-parse` / `describe --all`（6 个提交逐个解析）
  - `npx tsx scripts/wiki-lint.ts` → `ok wiki:lint 通过（另有 23 处待留意）`，23 条全是别的页的 `mark-flood`，本页 0 条
  - `npx vitest run` → `Test Files 2 failed | 113 passed`，`Tests 2 failed | 888 passed`
  - 浏览器：用户已在跑的 dev server `http://localhost:5193/#/wiki/learning-guide`（[::1]:5193），把视口设成 1440×900 使正文栏正好 1034px，用 JS 量表格与侧栏，量完已 `resize_window preset desktop` 复位
- 没做的：没读 `wiki/HANDBOOK.md`、没读 `docs/plans/` 下任何文件（任务要求跳过）；没跑 Playwright e2e（只做了等价的浏览器实测）；没有对 `db701c1f` 之外的镜像安装层做任何核实

## 一、四条意见的落实结论

| 意见 | 结论 | 主要依据 |
|---|---|---|
| 1 「怎么用」改成面向读者 | 大体落实，仍有 4 句作者口吻 | `learning-guide.md:99-107` 四段已改成「你会看到什么、遇到了怎么办」；剩余见 P3-6 |
| 2 分组表合并成 8 行 | 落实且核对无误 | 8 行 28 条链接，小节名与 `toc.ts` 逐字一致、目标页全部存在且都是该小节第一页（见二） |
| 3 新增「代码版本」一节 | 版本号全部核实无误，但缺边界、且指路对多数页不成立 | 6 个 commit 全部 `rev-parse` 通过（见三）；P1-2、P2-3 |
| 4 分组改名为「推理过程」 | 正文、代码、测试已同步，**图里还是旧名** | P1-1 |

## 二、分组表逐项核对（意见 2）

| 核对项 | 结果 |
|---|---|
| 分组数 | 8 行，对应 `toc.ts:36-48` 中 `guide/models/inference/architecture/hardware/distributed/performance/serving` 八个 part，`rfork/params/references` 三组按 `:93-97` 用散文说明——与 `toc.ts` 一致 |
| 小节名 | 28 个小节名与 `toc.ts:51-158` 的 `CURATED` 小节标题逐字一致，无漏、无多、无改写 |
| 链接目标 | 28 条链接全部指向 `wiki/concepts/` 下存在的页，且每条都是该小节 `pages[0]`（逐个 `test -f` + 对 `toc.ts` 比对）；`registry.json` 131 页中也都在 |
| 已合并 id | `ai-qos`、`superpod`、`epd-disaggregation`、`who-owns-what`、`paged-attention`、`flash-attention-3`、`qwen-request-legacy`、`rfork-terms`、`rfork-memory` 九个文件均已不存在，本页与 `toc.ts` 全文 grep 无命中 |
| 主线对应 | 8 行里 7 行成立；「推理过程」行把「采样」算进这一组，但这一组没有采样页（P3-4）。主线第 2 页在「分布式推理与部署 · 贯穿案例」、第 5 页在「vLLM 与 Ascend 架构 · 组件、职责与进程」，表里用「什么时候读」列交代了，处理得当 |
| 1034px 可读性 | **通过**。正文栏 1034px 时表宽 1034px、`scrollWidth` 无溢出、总高 510px；列宽 101 / 476 / 212 / 244；最高一行是「推理过程」81px（4 行），其余 2–3 行。没有塞爆的格子 |

## 三、版本表逐项核实（意见 3）

| 表里写的 | `rev-parse` 结果 | `describe --all` | 判定 |
|---|---|---|---|
| vllm-ascend `releases/v0.23.0`：2c59ff10 | `2c59ff1047573f40a471cf7535f01a8877344415` | `tags/v0.23.0-23-g2c59ff104` | 对。与 `wiki/seeds/vllm-ascend.yaml:13` 钉的值一致 |
| 配套 vLLM v0.23.0：0fc695fc | `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665` | `tags/v0.23.0` | 对，正是 v0.23.0 这个 tag |
| vllm-ascend `releases/v0.26.0rc`：2ed6cbba | `2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f` | `tags/v0.26.0rc1-42-g2ed6cbbaf` | 对。与 seeds:14 一致 |
| 配套 vLLM v0.26.0：568afb3a | `568afb3a13806beb53bb2e6bd518269357b237c0` | `tags/v0.26.0` | 对，正是 v0.26.0 这个 tag |
| vllm-ascend main：baa023ad | `baa023ada41a5b889cac6249845a688aab130892` | `heads/main-271-gbaa023ada` | 对。与 seeds:12、`HANDOFF-LLM-WIKI.md:246` 一致 |
| 主线执行侧 `vllm-ascend@db701c1f` | `db701c1fd31de40ab028628ee2580ae68c7fd3c0` | 无 ref（导入对象） | 对。`HANDOFF-LLM-WIKI.md:108,112` 与 `wiki/sources/glm-5-3-flash-baseline.md:105,112` 都写这个值 |

**没有记错的版本号。** 需要补的是边界，不是数字（P2-3）。另：`2c59ff10` 是当时的分支 tip，现在 `origin/releases/v0.23.0` 已走到 `1cdb8c4d`；表里写「固定的代码版本」，说法站得住，不算错。

## 四、问题清单

| 级别 | 文件:行 | 问题 | 证据 | 建议改法 |
|---|---|---|---|---|
| P1 | `wiki/diagrams/learning-guide-route.yaml:15`、`wiki/diagrams/learning-guide-route.svg:42` | 改名第 4 条没落到图：路线图里还是「推理过程与 KV cache」，而这张图就嵌在本页 `:74-76` | 全库 grep「推理过程与」只剩这两处；浏览器里 `document.querySelector('figure.wiki-diagram svg')` 的 `<text>` 取出 `"推理过程与 KV cache"` | 改 yaml:15 的 `text` 为 `推理过程`，跑 `pnpm wiki:diagrams` 重生成 svg；侧栏、正文表、图三处名字才一致 |
| P1 | `learning-guide.md:58`、`:103` | 「到该页『对照源码』下的『版本差异』查看」对读者点得到的大多数页不成立 | 表里 28 条链接的落地页中只有 `glm-5-3-flash`、`vllm-v1-shape`、`hardware-devices`、`glm-5-3-flash-two-node` 四页有 `## 对照源码`；全库 96 个 concept 页只有 17 页有，其中 15 页有 `### 版本差异`（另 2 页缺）。`prefill.md` 这种第一顺位落地页只有 4 个 `##`，没有「对照源码」 | 两条路选一条：①把话缩到事实范围——「主线五页和 RFork 各页的页末有『对照源码』，里面有『版本差异』；其余页正在补」；②先补页再写这句。不要留一句读者照做会扑空的指路 |
| P2 | `wiki/diagrams/learning-guide-route.yaml:3`（caption） | caption 写「左侧目录的第一组就是这条主线」，但第一组只有 4 页，主线第 2、5 页不在里面 | 浏览器读 `[data-testid="toc-guide"]`：阅读指南、认识 GLM-5.3-Flash、一条请求、多条请求，共 4 条；`glm-5-3-flash-two-node` 在 `toc.ts:145`（distributed·贯穿案例），`request-call-chain` 在 `toc.ts:96`（architecture·组件、职责与进程） | caption 改成「第一组是入口和模型/请求三页；主线第 2、5 页分别编在『分布式推理与部署』和『vLLM 与 Ascend 架构』里，位置见正文表」——正文表已经说对了，图别和它打架 |
| P2 | `learning-guide.md:11-23`（frontmatter relations） | 关系方向反了：4 条 `builds-on` 被渲染成「先读这些 / 本页建立在它们之上，不懂它们会读不下去」，等于叫读者先读主线 3、4、5 页再回来读入口页；顺序还被按 id 字母排成 4→2→3→5 | 浏览器里 `[data-testid="wiki-next"]` 第一组标题是「先读这些 本页建立在它们之上，不懂它们会读不下去」，含多条请求/我们的部署/一条请求/代码路径四条；`relations.ts:47` 的 `ORDER` 与 `:68` 的 `sort((a,b)=>a.id.localeCompare(b.id))` 是成因；`schema.ts:104` 规定 `builds-on` 的反向是 `enables`（渲染为「谁用到它」） | 把这 4 条边挪到对面页去写（在 `glm-5-3-flash-two-node` 等页写 `builds-on: learning-guide`），本页就只剩派生的「谁用到它」，方向就正了；顺序仍是字母序，所以读顺序只能靠正文那张五行表，别指望「接着看」 |
| P2 | `learning-guide.md:48` | 代码版本一节没写边界，读者会理解成「镜像里装的上游就是 0fc695fc」 | `wiki/sources/glm-5-3-flash-baseline.md:103` 写「基础 tag、文档 commit 和今天的 main 都不能直接等同于容器内最终代码」，`:116` 写「复制层一致不等于最终安装产物一致……上游 vLLM 实际检出内容仍未逐项检查」；`HANDOFF-LLM-WIKI.md:108` 同样写「最终镜像内上游安装产物仍未核实」 | 在 `:48` 末尾补半句：「镜像里 `vllm-ascend` 的源码已核到 `db701c1f`；上游 vLLM 按镜像元数据记的 `VLLM_TAG=v0.23.0` 取 `0fc695fc` 讲解，容器内最终安装产物还没逐项核实。」并按本页 `:105` 的角标约定给个 `!` 或 `[S]` |
| P2 | `src/content/wiki/index.test.ts:20,22` | 单元测试红：断言 `block-table` 标题以 `Block Table` 开头、正文含 `## 一句话`，两条都已不成立 | `npx vitest run` → `Tests 2 failed | 888 passed`；实际标题是 `块表：从序列位置找到缓存槽位`（`wiki/concepts/block-table.md:3`）；全库 `grep -rl '^## 一句话' wiki/concepts/` 命中 0 页（「一句话」模板 09-25 已废，`tests/wiki.spec.ts:77` 有注释）。文件 mtime 09-27 08:50，早于本轮，不是本轮引入 | 这轮既然动了 `toc.test.ts` 和 `wiki.spec.ts`，顺手把它改成现行约定（标题断言改成 registry 里的真实标题或去掉，`## 一句话` 改成 `## 对照源码`）。另一处失败 `scripts/wiki/params/scan.test.ts` 是本机 Python 版本问题，属环境，不计入 |
| P3 | `learning-guide.md:38`、`:66`、`:85` | 术语写法与 `TERMS.md` 不一致：正文写「注意力」「嵌入」，同一页的小节名却写 `Attention` | `wiki/TERMS.md:26` 统一叫法是 `attention`（「注意力、自注意力」列在「别的叫法」）；`:17` 统一叫法是 `embedding（词向量）`（「嵌入」是别的叫法）。`:72`「会矩阵乘法」也比统一叫法「矩阵乘」多一个字 | `:38`「注意力分两种」→「attention 分两种」；`:66`「两种注意力」同理；`:85`「展开嵌入、矩阵乘和注意力」→「展开 embedding、矩阵乘和 attention」 |
| P3 | `learning-guide.md:86`、`:87` | 小节名用英文、点进去的页标题是中文译名，读者会以为点错了 | 表里「Block table 与 prefix caching」→ 落地页标题「块表：从序列位置找到缓存槽位」；「Attention 与位置编码」→「注意力与 Q/K/V」 | 不在本页改。记一笔给下一轮页标题统一：按 `TERMS.md` 把 `块表`→`block table`、`注意力`→`attention` 收进页标题；本页照 `toc.ts` 写是对的 |
| P3 | `learning-guide.md:101` | 悬停描述不准，且与 `:107` 重复 | `Term.tsx:56-62` 的悬停卡渲染的是标题 + 证据等级 + `summary`，不是「释义」；`:107` 已经写对了一遍（「悬停可预览标题、摘要和证据等级」）。`Term` 只在 `WikiPage.tsx:490`（即「接着看」）用到，所以「只在接着看里」这一限定是对的 | 删掉 `:101` 后半句，只留术语写法本身；悬停这件事交给 `:107` 一处说 |
| P3 | `learning-guide.md:86` | 「推理过程」行的「展开主线的哪一步」写了「采样」，但这一组没有采样页 | `toc.ts:73-92` 的 inference 六个小节里没有采样/structured output 页；采样约束在「服务能力」行（`:91`） | 「采样与 decode」→「decode 与缓存复用」 |
| P3 | `learning-guide.md:84` | 「开始学习」行的「阅读路线」链到本页自己，点了不动地方 | 链接是 `[阅读路线](learning-guide.md)`，而读者正在这一页 | 「阅读路线」去掉链接，写成纯文字并加半句「就是你正在读的这页」 |
| P3 | `learning-guide.md:34`、`:44`、`:101` | 还剩 4 句作者口吻（意见 1 的残留） | `:34`「每一页的数字、形状和代码位置都按同一套前提写」；`:44`「读者用纸笔就能复算」「各页用**待核**标出」；`:101`「本站术语保留英文原名……每个术语第一次出现时附一句中文解释」——都是在描述内部写作约定/用第三人称称呼读者 | `:34`→「所有例子用同一套前提，换页不用重新设定背景」；`:44`→「你拿纸笔就能把这些数复算一遍；需要真实设备才能定的结论，页面上会标**待核**」；`:101`→「术语用英文原名，和源码、日志、官方文档里看到的写法一致；第一次出现时旁边有一句中文解释」 |
| P3 | `learning-guide.md:46` | 意见 3 说「新增『代码版本』一节」，落成 H3「讲解基于哪个版本的代码」，标题里没有「代码版本」四个字 | 页内标题结构：H2 这个知识库讲什么 → H3 讲解基于哪个版本的代码 → H2 按顺序读的五页主线 …（浏览器实测，4 个 H2 都带 id）。页内目录目前是 dev 试样，只在 `?toc=a|b` 下渲染（`WikiPage.tsx:88-95,294`），所以读者现在看不到大纲，H3 暂不影响导航；一旦试样转正，这一节就会缩进一级 | 可保留现名（比「代码版本」更像给读者的问句）；若要严格对齐用户措辞，改成 `### 代码版本：讲解基于哪个版本` |
| P3 | `learning-guide.md:46-58` | 新增的代码版本一节整段没有角标，同页其它段落有 `[I]`、`[S1]` | `:34`、`:62`、`:80` 都带 `[I]`，`:38` 带 `[S1]`；`:48-58` 一个都没有。`wiki:lint` 不管这个，所以不会报 | 至少给 `:48` 和版本表各挂一个角标（配合 P2「边界」那条一起改） |

## 五、越权改动核对（意见 6 对应项）

`git status --short` 当前 483 个条目，工作区压着多轮未提交改动，`git diff --stat` 无法把本轮单独切出来，**唯一可用的分隔依据是 mtime**。以 `toc.ts` 的 13:39 为界，13:37 之后被动过的非派生文件如下（不含 `*.tsbuildinfo`、`test-results/`、`dist/`）：

**授权范围内**：`wiki/concepts/learning-guide.md`（13:43）、`src/content/wiki/toc.ts`（13:39）、`src/content/wiki/toc.test.ts`（13:39）、`tests/wiki.spec.ts`（13:39）。含分组名的页面只有这几处加两张图，图没改（就是 P1-1）。

**授权范围外，但已被本次任务说明预期**：`docs/plans/2026-09-27-toc-tuning.md`（13:39）、`docs/plans/2026-09-27-mainline-rebuild.md`（13:42）——按要求没读内容。

**授权范围外、也不在预期内**：

- 主线五页：`wiki/concepts/{one-request,glm-5-3-flash,glm-5-3-flash-two-node,concurrent-requests,request-call-chain}.md`（13:50–13:57）。这五页 grep 不到任何分组名，不属于「含分组名的页面」
- 图：`wiki/diagrams/` 下 10 组 yaml/svg（`request-call-chain-*`、`concurrent-request-*`、`glm-flash-mtp-flow`、`glm-flash-indexer-flow`、`glm-two-node-request-route`、`one-request-finish-flow`），13:40–13:56
- 代码与样式：`src/content/wiki/{calc.ts,calc.test.ts,CalcBlock.tsx,tableAlign.ts,tableAlign.test.ts}`（13:48，五个同一秒，像一次性生成）、`src/app/App.tsx`、`src/app/pages/WikiPage.tsx`、`src/app/pages/dev/WikiSpecimenPage.tsx`、`src/app/wiki/PageToc.tsx`（13:56–13:59）、`src/design/wiki.css`（14:03）、`tests/wiki-style-specimen.spec.ts`（14:08）
- `package.json` / `pnpm-lock.yaml`（13:37）：内容 diff 是旧的（`wiki:refusal-probe`、katex/remark-math），更像一次 `pnpm install` 把 mtime 刷新了，不作数

**结论**：这批改动确实落在授权范围之外，但 mtime 只能证明「在同一时间窗里被动过」，不能证明就是同一个 agent 的这一轮所为——工作区里 09:30–13:00 之间还有别的轮次留下的未提交改动。要定责需要用户那边的会话记录，不能只凭 mtime 下断言。

## 六、已通过、无需改的项

- 「完整模型副本」：全库 `grep -rn 完整模型副本 wiki/ src/` 无命中；`:42` 的说法（「每台机器是一个 DP 执行组……两台机器通过 EP16 共同完成模型计算」）与 `glm-5-3-flash-two-node.md:90`（「它不是一个能单独跑完整个模型的副本」）一致
- 已合并 id：九个文件均已删除，本页与 `toc.ts` 均无引用
- 改名同步：`toc.ts:39` 的 `{ id: "inference", title: "推理过程" }`、`toc.test.ts:112` 的 `toBe("推理过程")`、`tests/wiki.spec.ts:57` 的分组名列表三处已改，`id` 仍是 `inference`（未变）
- `wiki:lint` 本页 0 条提醒

## 修订记录

2026-09-27：14 条中已改 12 条、不改 2 条。编号按第四节同级条目的出现顺序计；版本差异指路按用户要求保留。

| 条目 | 处理 |
|---|---|
| P1-1 图中旧分组名 | 已改：改为「推理过程」，定向生成 `learning-guide-route.svg`。 |
| P1-2 版本差异指路 | 已改：保留到特性页「对照源码 → 版本差异」的指路，说明各页正按此结构补齐，整理中的页可先沿来源核对。 |
| P2-1 图注分组不实 | 已改：写明第一组实际四页，以及部署、代码路径页各自所属分组。 |
| P2-2 relations 方向 | 已改：入口页移除四条前置关系，四个目标页改为 `builds-on: learning-guide`；阅读顺序以正文表为准。 |
| P2-3 镜像边界 | 已改：区分已核执行侧源码与按镜像元数据取值的上游版本，列出最终安装产物的待核项。 |
| P2-4 旧单测断言 | 不改（理由）：用户明确禁止本轮修改 `src/`、`tests/`，前端与测试由其他人处理。 |
| P3-1 术语 | 已改：句中用 attention、embedding、矩阵乘，首次出现附中文解释。 |
| P3-2 落地页标题 | 不改（理由）：报告建议下一轮统一；block-table、attention-qkv 标题超出本轮六页范围，本页小节名继续对齐目录。 |
| P3-3 悬停描述 | 已改：删去术语段的重复描述，仅在「接着看」说明标题、摘要和证据等级。 |
| P3-4 inference 组写 sampling | 已改：改为请求调度、decode 与缓存复用。 |
| P3-5 自链 | 已改：「阅读路线」用文字并指出就是当前页。 |
| P3-6 作者口吻 | 已改：前提、纸笔复算、待核、术语段改为读者可直接使用的说明。 |
| P3-7 标题 | 已改：「代码版本：讲解基于哪个版本」。 |
| P3-8 版本段角标 | 已改：边界用 `[!]`、版本快照编排用 `[I]`，全页 6 处角标。 |

验证：四项指定命令按顺序通过；PowerShell 限制 `.ps1`，实际使用同一 pnpm 的 `pnpm.cmd` 入口。Playwright 在 4173 端口实际阅读页截图并目视检查：路线图宽 900 px、最小字号 13 px，图片保存于用户指定 `scratchpad/codex-fix-shots/learning-guide-route.png`。
