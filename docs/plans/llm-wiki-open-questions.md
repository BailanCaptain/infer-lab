# LLM Wiki 未决问题与决策台账（2026-09-11）

用户 2026-09-10 至 09-11 集中提了一批问题，涉及四个 feature。本文件把它们按主题归并，每条记：**问的什么 / 查到的事实 / 结论 / 落在哪 / 状态**。这是问题的台账，不是设计文档——设计在各自的 feature 与 plan 里。

---

## 零、先说官方文档这件事（09-11 查清）

用户给了官网地址 <https://docs.vllm.ai/projects/ascend/en/latest/>，指出它可选版本且会更新。查证结果：

| 事实 | 值 |
|---|---|
| 官网内容来源 | 就是仓库的 `docs/source/`，Sphinx 渲染 |
| 本地已有的 md | 152 个（tutorials 55、user_guide 46、developer_guide 33、community 8，加顶层若干）|
| 版本选择 | **26 个活跃版本**（ReadTheDocs API `count=26`）。分支版：`latest`、`main`、`v0.26.0rc1`、`v0.24.0rc`、`v0.23.0`、`v0.22.1rc`、`v0.21.0rc`、`v0.20.2rc`、`v0.18.0`、`v0.13.0`、`v0.11.0`、`v0.9.1`、`v0.7.3`、`v0.7.1`；另有 12 个 tag 版 |
| URL 规律 | `https://docs.vllm.ai/projects/ascend/en/<版本>/<路径>.html` |
| 本地覆盖到几个 | 目前只有 `main` 与 `releases/v0.23.0` 两份工作树（AC9 建的），官网有 26 个 |

> **更正（09-11）**：我第一次只看了页面横幅上的两个版本就下结论，被用户指出漏了 v0.26。正确做法是查 ReadTheDocs API：
> `https://app.readthedocs.org/api/v3/projects/vllm-ascend/versions/?active=true&limit=50`
>
> 这条更正带出一个设计影响：**文档本身也有版本谱系**。「这个参数在文档里什么时候消失」与「在代码里什么时候消失」是两个问题，答案还经常不一致——之前查到 7 个参数全树无记载、`layer_sharding` 只在一篇教程里被提过一句，就是这种不一致。F002 的谱系要同时覆盖代码与文档两条线。

**重要发现：`docs/source/llms.txt`**（53 行）是上游**专门为 LLM 准备的官方索引**，逐节给出 canonical URL，还说明了 markdown 孪生页的取法（`latest/_sources/installation.md`）。里面点名的「支持矩阵」两页（`supported_models` / `supported_features`）正是结构化事实表。

这三件事直接影响后面几条决策：本地读文件与读官网**内容同源**，但我们缺的是**把 URL 一起记下来**，以及**按版本区分**。

---

## 一、数据来源与覆盖

### Q1 · 当前 feature 包含 vllm-ascend 的所有 PR 和 issue 吗？

**不包含。** 实测规模 12,074 PR / 4,188 issue（编号到 #16285）。全量转 wiki 页按每页 2.5 美元要约 4 万美元，不成立。

**结论**：拉成**检索语料**（纯文本、不过 LLM、零额度），只有触及核心特性的 PR 才升级成页。
**落在**：[F003](../features/F003-github-corpus.md) AC1–AC6。**状态**：未开工，等 GitHub token。

### Q2 · 你到底在哪抓的？没看官方文档吗？

**抓的是本地克隆的仓库**（`tools/repos/vllm-ascend`，钉 `28bf3a2e`），提取 agent 的 `--add-dir` 指向它，能读整个仓库**包括 `docs/`**。

实际引用分布（11 页 174 条来源）：

| 来源 | 条数 |
|---|---|
| `vllm_ascend/**.py` | 155 |
| `docs/**.md` | 17 |
| `csrc/` | 2 |

所以文档在用，只是少。**但发现一个真缺陷**：

```
evidence 分布：C（源码）10 页 · I（推断）1 页 · S（官方文档）0 页
sources 里的 https:// URL：0 条
```

HANDBOOK 规定 `evidence: S` 要求 sources 是 `https://` 官方 URL，而 agent 读的是本地文件，写出来是 `vllm-ascend@28bf3a2e:docs/source/...md#L12-L20`——**内容来自官方文档，标签却记成了源码 C**。与「推广结论仍标 C」同一类的标签失真。

**结论**：引用 `docs/` 时 evidence 标 `S`，且 sources 同时给本地行号与官网 URL（用 llms.txt 的 canonical 形式，带版本号）。
**落在**：HANDBOOK 已改（见 Q10），AC5 重跑时在页面上生效。**状态**：规则已就位，待重跑。

### Q3 · 文档搜得不全吧？

**是。** 152 个文档只被引用到 9 个。根因：seeds 的 `entry` 全指向 `.py`，agent 是顺着源码摸过去才偶然读到文档的，不是主动去查。

**结论**：seeds 的 `entry` 同时列 `.py` 与对应的 `docs/` 文件，让 agent 两头读；并把 `llms.txt` 注入提取 agent 的系统提示当地图。
**落在**：HANDBOOK「提取」已补规则；seeds 的 `entry` 待改。**状态**：规则已就位，seeds 待改（AC5）。

### Q4 · vLLM 上游文档

当前只克隆了 vllm-ascend，`docs.vllm.ai` 主站一条没有。很多概念（PagedAttention、chunked prefill、prefix caching）的权威解释在上游。

**结论**：AC5 第二步克隆 vllm 上游（原计划就写了「vllm 到第二步需要时再克隆」）。**状态**：待做。

---

## 二、版本与谱系

### Q5 · `layer_sharding` 哪个版本移除、哪个 PR、哪些分支还有？

**已能回答，且全靠本地 git，不用 API、不花额度**：

> 由 PR **#11953**（提交 `89601215`，2026-07-15，`[Refactor] remove layer sharding`）移除。
> 已移除的分支：`main`、`releases/v0.24.0rc`、`v0.25.1rc`、`v0.26.0rc`、`v0.27.1rc`；tag 从 `v0.24.0rc1` 起。
> 仍保留：`releases/v0.23.0`（14 个文件，核心实现 `vllm_ascend/ops/layer_shard_linear.py`）及更早的 v0.18.0（9）、v0.13.0（8）。

**落在**：[F002](../features/F002-param-lineage.md) AC3。**状态**：机制已验证，脚本未写。

### Q6 · 一个 repo 钉一个 commit 很不好

**用户判断正确。** 分支分布非单调（v0.24 没了、v0.26.0rc 又有 1 处），单一版本号会说谎。

**结论**：改成一个 repo 钉一组 ref，feature 可声明适用 ref。
**落在**：F001 AC9。**状态**：**已完成**（提交 `7e9c45f`）。

### Q7 · 部分克隆的隐患

实测：`--filter=blob:none` 跨分支 `git grep` **静默漏文件且不稳定**——v0.18.0 部分克隆数出 1、完整克隆是 9；v0.23.0 部分克隆先后给出 11 和 13、完整是 14。同一条命令在不同时刻给出**两个不同的错误答案**。

**结论**：改完整克隆。**状态**：**已完成**（同 AC9）。

---

## 三、知识质量与表达

### Q8 · 证据等级用户看到会不会有点蒙？

**会。** 原来只有一个字母 `C`，中文解释藏在 `title` 里，触屏根本看不到。

**结论**：分场景给不同密度——页面头部写「`C` 源码实证」，首页给七档图例，空间紧的地方（悬停卡、聊天）保留字母 + tooltip。
**状态**：**已完成**，3 条 Playwright 验收通过。

### Q9 · 拉取的知识本身有图会保留吗？图少是不是大缺陷？

**是缺陷。** 实测：上游 `docs/` 有 37 个图片文件、21 处图片引用、2 个 mermaid；**我们 11 页零张图**，HANDBOOK **关于图的规则零条**。

根因两层：提取来源是源码，源码没图；HANDBOOK 的四节结构根本没给图留位置。

**结论**：主线是**让 agent 画 mermaid**（结构关系用图讲，且是纯文本，能进 git、能 diff、能 lint），不搬上游 PNG（许可问题 + 源码路径碰不到）。
**落在**：F001 AC11。**状态**：AC 已立，未实施。

### Q10 · HANDBOOK 的页面格式太差劲

**用户判断正确，已查行业实践**（[Diátaxis](https://diataxis.fr/)、[Kubernetes 页面类型](https://www.kubernetes.io/docs/contribute/style/page-content-types/)）。

现行四节的问题：

1. **混模式**——`是什么`/`常见误解` 是 explanation，`形状与数值`/`在哪一步出现` 是 reference，Diátaxis 核心主张是四类必须分开
2. **没有出口**——K8s concept 页强制 What's Next（≤5 条），我们有 `related` 却在正文没落点
3. **没有前置知识**
4. **没有 worked example**——试点里 `slot = 3×128+2 = 386` 是 agent 自发写的，规则没要求
5. **`是什么` 只给两三句**，做不到 Diátaxis 要求的 make connections / bigger picture / counter-examples
6. **没有图**（同 Q9）

新方案（按页类型分模板，骨架取 overview → body → what's next）：

```
## 一句话            ← overview，悬停卡直接用
## 为什么需要它       ← 解释：不存在会怎样
## 怎么工作           ← 解释 + mermaid 图
## 拿真实数字走一遍    ← worked example，Qwen3-0.6B 真实维度
## 事实表             ← 参考：形状/默认值/行号，可扫读不夹叙述
## 常见误解           ← 保留，试点验证有效
## 接着看             ← ≤5 条，来自 related
```

特性页多一节 `## 什么时候该开`；参数页以事实表为主（正好接 F002 的脚本生成区）。前置知识进 frontmatter 的 `prerequisites`，渲染在页顶。

**状态**：**HANDBOOK 已改**（2026-09-11）。四片同步改动：

- 「页面格式」重写：七节结构 + 参数页五节 + `prerequisites` 字段 + 三种 sources 写法（源码 / 文档本地副本 / 文档线上 URL）+ 引用文档必须标 `S` 且两个地址都给。
- 「提取」补四条：文档与源码一起读、`llms.txt` 当地图、该画图就画图、事实表里不写解释句。
- 「整合」补一条：检查 `## 接着看` 是否超五条或只是原样倒 `related`。
- 「Lint」补六条规则：`missing-section`、`whatsnext-overflow`、`diagram-identifier`、`prerequisites-missing`、`doc-evidence`。

现有 11 页仍是旧格式，`wiki:lint` 通过（新规则的代码还没写）。**新格式要等 AC5 重跑才在页面上生效**；lint 新规则的实现列入 AC11。

---

## 四、关联与检索

### Q11 · wiki 之间有联系，回答能体现吗？

**图很密但没用上。** 实测 11 页 70 条 `related`、平均每页 6.4 条、密度 64%、无孤立页——但这个图**只用来渲染右栏列表**，问答链路完全没用（`retrieve()` 返回扁平列表，chat 的 stdin 只给候选清单）。

**结论**：`retrieve()` 做一跳图扩展，标明「因为与 X 相关」；chat 把关系写进 stdin；回答末尾附「接着看」。
**落在**：F001 AC12。**状态**：**检索侧已完成**（19 个测试过），chat 与 UI 侧待做。

### Q12 · 要不要向量检索？

**不要。** 分场景看它不是最优解：参数问题是按名字精确查表，语义相似反而会捞进相近但不同的东西；概念页几百页规模 index + grep 够用。代价是嵌入模型、向量库、重嵌入流程，还会成为第二个真相源，与「单一真相源」冲突。

**唯一改口条件**：F003 AC4 实测 10 条真实 traceback 命中不到 7 条，那时只给 issue 语料加向量，不碰 wiki 页。
**状态**：**已决策**，写进 F001 Out of scope 与 F003 AC4。

---

## 五、闭环（越用越聪明）

### Q13 · agent 怎么查？查不到怎么办？会自动写 wiki 给人审吗？交叉审视、建链、死链定期审查有吗？能手动 drop 资料吗？

**诚实回答：F001 是一次性生产，不是闭环。** 逐条差距见 [F004](../features/F004-knowledge-loop.md) 的 Why 表。手动投喂**完全没有**。

**结论**：立 F004，9 条 AC。**状态**：feature 文档已写，plan 待写（等 AC7/AC8 落地后形态才确定）。

### Q14 · 深度参考 Multi-Agent，看漏掉什么

逐个读了 `adaptive-recall`、`viewfinder`、`llm-compile`、`cross-file-dedupe-lint` 源码，补了四个半：

| 机制 | 已补到 |
|---|---|
| 检索够不够由 LLM critique 判，不用阈值 | F004 AC3 |
| **回答必须带引用**（judge-block） | F001 AC7 ✅ 已实现 |
| 结论被推翻要留痕（tombstone/superseded） | F004 AC7 |
| 页面衰减检测（jaccard drift） | F004 AC8 |
| 跨页内容重复 lint | F004 AC9 |
| 覆盖率的诚实分母 | F002 设计决策 |

「有意不搬」的也逐条写明了理由（写入账本、崩溃恢复、ACL 租约、嵌入召回、handoff 改写）。

---

## 六、工程与风险

### Q15 · F004 后做会不会对 F001/F002/F003 改动很大？

**不大。** 唯一机械重构是把 `runExtractPhase` 拆成 `runBatch`（十行，现有测试继续有效），而且**F002 AC2/AC5 就需要它**，F002 先做则 F004 白捡。

其余共享点（HANDBOOK 切片、sanitize、调度器、lintPages 纯函数）都是增量，不改既有代码。
**状态**：已评估并写进各 feature 的依赖。

### Q16 · 你说的两个风险项

| # | 风险 | 状态 |
|---|---|---|
| **R1** | AC7 跳过 AC10 内联 grep → F004 AC3、F003 AC4 都要重写聊天层 | **已消除**——AC7 与 AC10 同批落地，检索唯一入口是 `src/content/wiki/retrieve.ts` |
| **R2** | 整合 agent 读全量页，AC5 放量会撞上下文（11 页 96 KB，160 页约 1.4 MB）| **未处理，AC5 开跑前必须做** |
| R3 | 放量成本约 300 美元等值 | 待用户决定 |
| R4 | 阅读页目录全量渲染，250–300 页后需折叠与搜索 | 待触发 |
| R5 | 知识表达单薄（零图、related 未用于问答）| AC11 / AC12 |

### Q17 · GitHub 拉取失败前端会有提示吗？

**会。** 三处：`#/wiki` 的同步状态条、参数页的版本横幅、知识库过期提醒。脚本本身也硬失败（非零退出 + 写 `log.md`）。
**落在**：数据在 F002/F003，显示在 F001 阅读页。**状态**：未实施。

---

## 当前进度一览

| Feature | 状态 |
|---|---|
| **F001** | 12 条 AC 完成 8 条（AC1–4、6、7、9、10）。剩 AC5 灌种（要额度 + 先解 R2）、AC8 存进 wiki、AC11 图、AC12 关系（检索侧已完成）|
| **F002** | feature + plan 已写（333 行，15 条锚点核验）。未开工 |
| **F003** | feature 已写。plan 待写，等 GitHub token |
| **F004** | feature 已写（9 条 AC）。plan 待写 |

分支 `feat/llm-wiki`，main 未动。`pnpm check` 221 测试全过。

## 等用户拍板的三件事

1. **HANDBOOK 页面格式**要不要按 Q10 的新方案改（改完现有 11 页需重跑才一致）
2. **AC5 批量灌种的额度**（约 300 美元等值，跨多个额度窗口）
3. **GitHub token**（给了才能写 F003 的 plan）


---

## 七、检索的宽松匹配（09-11 用户指出）

用户原话：

> 你这个查不到可能是因为你用了全词匹配！文档中可能不是这样的形式。包括用户问也希望，我可能就问 layer share 是什么，难道就查不到了吗

**判断成立，而且我在两个地方都犯了同一个错。**

### 错误一：数「哪些参数没文档」时用了精确匹配

| 参数 | 精确匹配命中 | 宽松匹配命中 |
|---|---|---|
| `layer_sharding` | 1 个文件 | **2 个**（漏了 `release_notes.md`）|
| `mix_placement` | 0 | **1**（文档写作 `Mix placement`）|

「8 个参数全无记载」应更正为 **7 个**。

更要紧的是漏掉的那份文件：**`docs/source/user_guide/release_notes.md`，2267 行、1137 个 PR 链接、39 个版本小节**，是官方按版本组织、带 PR 号的变更史。它写 `Layer sharding.`，我的精确匹配全程看不见。这是 F002 谱系的一等来源，已写进 F002 的设计决策。

### 错误二：`retrieve()` 也只认精确写法

学习者不会照着 id 打字。已修：

- 标识符压平成无分隔符小写形式（`layer_sharding` / `Layer Sharding` / `layer-sharding` → `layersharding`）
- 按**公共前缀**判同一个东西，不用严格前缀——`layershare` 与 `layersharding` 在第 10 位就分叉，严格前缀判不出来
- 提问里夹着标识符时（「layer share 是什么意思」）逐个拉丁片段再试
- 宽松命中标 `how: "fuzzy"`，不冒充精确命中
- 防误命中：长度 2 的拉丁片段只按整段匹配（`kv` 是 `kv-cache` 的一整段，有意义；`la` 只是 `layer` 的一截，是噪声）

8 个新测试，全绿。
