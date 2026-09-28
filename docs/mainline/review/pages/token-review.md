# token：P5 写作与独立审查记录

## P5 写作记录（2026-09-28，第 02 批）

### 修改目的与范围

把原来的分词概览深化为 A1 入口教学页：先让初学者看清“消息 → 模板 → 分词 → 编号”，再区分编号、位置、嵌入，最后沿 R1 交接到引擎。主机 CPU／内存负责文本处理与请求记录，设备内存负责后续张量、权重及历史状态，两笔账分别说明。

只修改 `wiki/concepts/token.md`、它引用的 `token-split.yaml/svg`，新增 `token-entry-flow.yaml/svg` 和本记录；不改依赖页、计划、src、scripts、tests，不提交 git。验证辅助文件在 `tmp/token/`。首图为 840×300，流程图为 840×660，均手写 figure spec、由仓库渲染器生成 SVG。

第一屏包括问题式 H2、定义、机制图，以及设备／内存／token／矩阵／平台契约的简短衔接。第二屏说明词表与序列长度的取舍、入口成本与设备成本，并用三行表区分 ID、位置、嵌入。后续保留模板、完整上下文计数、反分词、流式增量、长度限制、未知字符和特殊标记等内容，新增常见误解和固定源码查阅区。

### 数字、依据与信息保留

- R1 的输入列表长度 4、位置 0–3，来自 `docs/mainline/01-deploy-entry-schedule.md` §A1「在我们部署下的具体数字（R1）」及 `one-request.md` 的 R1 定义。它是完成模板和分词后的教学设定，未声称首图中文被实测为 4 token。
- 154880 沿用已核模型维度，引用固定 revision `690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json`。本轮读取了来源基线批已下载的 `scratchpad/p5/glm-5-3-flash-baseline/config-690b7052.json`，其 `text_config.vocab_size` 确为 154880；本轮 web 与直接下载重试不可达，不将缓存读取说成重新在线下载成功。
- 原页以假设编号 5012、233、87、4090 示范切分，现改为 p₀…pₙ₋₁，保留“词表编号与位置不同、编号可重复”的全部含义，避免假数字被误认成 GLM 实测。
- 原页“R1 最多输出 3 token”与当前底稿第 8 行“prompt 4 个 token，一直生成到结束”及现主线的 MTP 设定冲突。新页不再传播这个旧上限，明确草拟数与输出上限不同；未修改底稿、R/K 页或队列。旧 y₀…y₂ 只是输出序列符号，其生成含义由当前主线第 5 站承接。
- 单请求形状、块数、字节与通信推导留在 R；函数全链留在 K。本页没有重复计算设备容量，也没有给 Python 整数列表编一个设备字节数。
- 对比修改前备份 `tmp/token/token-before.md`：子词算法、BPE 论文、词表维度、未知字符条件、模板重复特殊标记、历史上下文、ID 与位置、输出还原、流式边界、三种长度概念及待核均保留；来源角标统一后移。

### 核心概念的实际核对

1. 在线阅读 Transformers `tokenizer_summary`、`chat_templating` 与 Sennrich 等人的原论文摘要 `arxiv:1508.07909`，核实子词表示、字节与字符边界、聊天格式和重复特殊 token 条件。
2. 用本地上游 git 对象核对 `vllm@0fc695fc` 的渲染入口、HF 模板包装函数、`AsyncLLM.add_request`、DP 客户端、增量反分词器及输入校验。核实先登记输出再发送、指定组／负载选组的分支、停止字符串缓冲，以及编号校验只检查上界。
3. 分别读取 `0fc695fc`、`568afb3a`、`84030bbe` 的 ModelConfig 与 HF 模板实现，确认三版模型路径／auto／skip=false 的默认值；v0.26 与 main 的可选 assistant mask 默认 false，需模板标记及分词器结果共同支持。verified 仅代表页内文本分词契约和比较项，不代表三版都验证了 GLM 双机部署。
4. 阅读 `vllm-ascend@db701c1f` runner 的 L814–1225：主机组织本步编号、准备设备输入；普通非 PCP 路径的 positions 在设备上相加生成。图不再把所有位置张量描述成主机拷入。

页面 sources 给出上述路径与固定行号。通用文档与论文在线可读；本轮未逐个联网打开所有 GitHub 行号 URL，本地对象读取不冒充外链可达验证。

### 独立审查与修订

按写作标准委派独立审查者 `/root/review_token`，只读页面、两图、改前备份与固定源码；不是写手自查替代独立审查。

| 级别 | 位置与影响 | 修订与复核 |
| --- | --- | --- |
| P2 | 入口图 A3 原文使人误以为 positions 一律由主机复制，且 source17 未覆盖实际设备位置计算 | 改为“准备设备上的编号与位置张量”；来源扩至 L1225；审查者回读源码及实际渲染确认关闭 |
| P3 | 版本表未明确 assistant mask 的模板条件 | 补 generation 标记与分词器返回 mask 的条件，扩源码范围至返回／回退分支；关闭 |
| P3 | 编号越界报错的描述容易被读成所有非法编号均被入口兜住 | 明确最大输入编号、两种词表上界取较大值，仅检查上界；关闭 |

独立审查无 P1；上述 1 个 P2、2 个 P3 均闭环。审查者分别查看有效 `initial.png`、`screen-02.png`、`screen-03.png`、`figure-2.png`：能复述是什么、主机成本与后续设备成本；两图文字和箭头清楚，无裁切或重叠。

### 字数与格式自查

沿用 `scripts/wiki/standard.ts` 的字数口径：汉字数＋拉丁单词数，排除 frontmatter 与围栏内容。全文包含源码区，教学正文截止“对照源码”之前。

| 项目 | 改前 | 改后 |
| --- | ---: | ---: |
| 教学正文 | 1270 字（原页无源码区） | 2280 字 |
| 含源码区全文 | 1270 字 | 3438 字 |
| 教学正文行内代码 | 5 处 | 0 处 |
| 教学正文证据角标 | 7 处 | 0 处 |
| calc | 0 | 0 |

首图前没有具体部署数字或 calc；全页 18 个证据标记，C 为 13 个，占 72.2%，低于 80%。本页没有新增数字推导，因而无需 calc。两图均宽 840px。直接调用 `checkStandard` 检查本页，问题数 0，未修改强制名单或 skip 规则。统计完整输出见 `tmp/token/metrics.json`。

### 浏览器证据与限制

服务仅启动在 4173，使用 strictPort；没有操作 5193 或 8790。浏览器连接器无可用浏览器，Computer Use 返回 **“Computer Use was not approved to use Google Chrome”**，未给详细原因；停止桌面输入，改用隔离 headless Chromium 的本地测试。桌面 Chrome 验收仍待补，不能把隔离测试表述成桌面通道已获准。

1440×1000 实际浏览器验证：

- `screen-01.png` 至 `screen-06.png` 覆盖全页，写手逐张查看；另保存 `figure-1.png`、`figure-2.png`。
- 页面宽与滚动宽均为 1440；两个表格各自 clientWidth=scrollWidth，分别为 515 和 1034；无横向溢出、无 pageerror。
- 16 个去重站内目标及所有指定锚点都存在。实际点击 A1 入口链接后落在目标标题，标题 y=16px，保存 `clicked-a1.png`。
- 并行写手曾使全库快照临时不合法；读取到合法快照并加载字体后，将隔离浏览器设为 offline，固定同一份页面快照完成截图与站内 hash 导航，避免其他页面的 HMR 干扰。未屏蔽页面报错、修改源内容或伪造截图。
- 首次渲染发现本轮 PowerShell UTF-8 BOM 使 frontmatter 被展示为正文，已将本页与两份 YAML 写为无 BOM UTF-8；最终截图确认修复。

截图目录：`C:/Users/-/AppData/Local/Temp/claude/C--Users---Desktop-infra-view-new/13898c74-f916-4e2c-8924-fe9bf130f160/scratchpad/p5/token/`。机器可读浏览器结果为该目录的 `browser-check.json`。`initial.png` 最终为有效首屏，验收以 screen 系列及 browser-check 为准。

### 校验记录

- `pnpm.cmd check:content`：通过，registry 131 页。
- `pnpm.cmd wiki:diagrams --check`：最新通过，163 张图与 spec 一致；本页两图额外定向通过 figureProblems。
- `pnpm.cmd wiki:audit`：最新通过，131 页、1621 条来源，1523 条本地行号有效，无无效提交／缺文件／行号越界；不包含 URL 可达性和结论语义担保。
- `pnpm.cmd wiki:lint`：最后运行剩 1 项，hardware-devices 的华为官方域名不在共享白名单；本页无错误，未越界修改其他页或共享来源规则。
- `pnpm.cmd check`：typecheck 和代码 lint 阶段通过；测试阶段出现范围外 `scripts/wiki/params/scan.test.ts` 的 `parses upstream starred type subscriptions without executing the inspected module` 失败，index／reader-build 显示 0 test，未产生最终失败详情汇总。持续没有汇总后中止，不能声称全量单测通过，也未断言失败根因；后续串行子检查未因此自动执行，已单独运行本任务四项检查。
- `pnpm.cmd build`：首次受其他页图 spec 不合法阻塞；其他写手完成其修订后复跑，通过 TypeScript 与 Vite 生产构建，保留既有构建提示。日志 `tmp/token/build-final.log`。
- `pnpm.cmd exec playwright test tests/wiki.spec.ts --grep 跨页锚点链接`：1 passed（58.5s），复用 4173 服务。日志 `tmp/token/e2e.log`；本页专用的 1440 宽截图与 16 个目标验证另见上述浏览器结果。
- `git diff --check`：本页与已有图通过；无代码、共享配置或测试修改。
- `wiki:build` 会改写 `wiki/index.md` 与 `src/content/wiki/registry.json`，本任务明确只许修改本页／图，故未运行写共享派生物的命令；开发服务从现有快照机制读到本页，索引串行集成留给协调者。

命令日志在 `tmp/token/`。早期并行页面的 schema、未生成 SVG、来源越界错误不算本页问题；最终图检查和 audit 的通过结果取最后一次运行。

验收后已关闭本次 4173 Vite 会话；实际查询 `Get-NetTCPConnection -LocalPort 4173 -State Listen` 无监听结果。未操作其他服务端口。

### 尚未核实与交付边界

没有本页新增的算术争议；旧 R1 输出上限冲突如上报告。GLM tokenizer 的真实切分／模板增加量、主机耗时与内存、NPU 端到端性能仍未实测，正文末尾保留待核。没有待用户决定的内容方向。整批完全验收还受桌面通道、全库 lint 与共享集成约束，不能称全库检查全部通过。

## P5 审查（09-28）

独立审查员，只审不改页面。对象：`wiki/concepts/token.md` 工作区版本（updated 2026-09-28）。

**得分：7.5 / 10**（P1 1 条，P2 1 条，P3 7 条）

### 读取范围与跳过

- frontmatter 只读键名与 relations（第 29–33 行），跳过 sources 区（第 9–26 行）。
- 正文第 36–110 行分段读完；「## 对照源码」（第 111–153 行）只 grep：5 个 H3 齐全、顺序正确（113 怎么开 / 119 会报什么错 / 123 开销和什么时候别开 / 127 版本差异 / 139 源码位置）；版本差异里 v0.23、v0.26、main 都出现。为核对核心概念 4，只 grep 了第 121 行中“编号上界”那一句，没读该节其余正文。第 153 行“待核”是 grep 命中后顺带看到的。
- 两个 wiki-diagram 围栏按规定跳过；另外读了图 spec（`wiki/diagrams/token-split.yaml`、`token-entry-flow.yaml`），并看了写手截图 `figure-1.png`、`figure-2.png`、`screen-01/02.png`。
- 没有读取被拦的段落。

### 1. 初学者测试（只读前两屏）

能说清。我的一句话：**token 是分词器把（套好聊天模板的）文本切成小单元、再查词表得到的整数编号；它和字、词不一一对应。分词是在词表大小和序列长度之间取舍；代价是入口 CPU 要套模板、做编码，主机内存要存这些编号，而 token 越多，后面设备上的计算和历史状态占用也越多。**

### 2. 核心概念逐条核对

| 概念 | 判定 | 依据 |
| --- | --- | --- |
| token 和字、词不一一对应 | **对** | 第 44、103 行；与 Transformers tokenizer_summary 一致。措辞小问题见 P3-1 |
| 分词器用 BPE 一类方法 | **对，但没落到 GLM** | 第 54 行对 BPE / WordPiece / Unigram 的区分正确（BPE 按频次合并，WordPiece 按似然准则合并，Unigram 从大词表裁剪、给切分打分）；Sennrich 等人 arXiv:1508.07909 用 BPE 子词处理 NMT 的稀有词，引用也对。页面没有断言 GLM tokenizer 属于哪一种；本地缓存只有 config（`model_type=glm5_next`），没有 tokenizer.json，无法核实，见 P3-2 |
| chat 模板会插入特殊 token | **对** | 第 38、74、78、107 行：角色/边界/回答起始标记进入序列，先渲染再编码时要避免重复补 BOS/EOS，与 HF chat_templating 一致 |
| 词表大小要和模型配置一致 | **页面对，但这条的说法本身要改准** | 严格说不必数值相等。`vllm@0fc695fc:vllm/v1/engine/input_processor.py#L469-L484` 的注释明确说 tokenizer 与模型的词表大小可以不同，只在最大编号超过 `max(tokenizer.max_token_id, vocab_size-1)` 时才报越界。真正的要求是：编号映射要配套，编号落在嵌入表的行数内。页面第 105 行“模型权重也要与编号映射配套”和第 121 行的上界描述都与代码一致；但正文丢了“154880 不等于 tokenizer 的实际条目数/自然语言词数”这层说明，见 P1-1 |
| token 编号只是查表索引，不是数值特征 | **对** | 第 46、60–66 行：编号经嵌入查表才成为向量，编号相近不代表含义相近；与 embedding.md 第 28 行一致 |

另外核对了源码（均为 `vllm@0fc695fc`）：
- `async_llm.py#L400-L412`：先调 `output_processor.add_request`，再调 `engine_core.add_request_async`，与第 84 行“先登记输出再选组”一致。
- `core_client.py#L1398-L1426`：`score = waiting×4 + running`，严格小于才替换，所以两组都是 0 分时取起点组，与第 84 行“两边空闲时进 DP0”以及 one-request.md 第 123 行一致。

### 3. 数字

- 154880：缓存 `config-690b7052.json` 的 `text_config.vocab_size` 确为 154880，同一 text_config 中 `eos_token_id=[154820,154827,154829]`、`pad_token_id=154820`。与 glm-5-3-flash.md 第 263 行一致。
- R1 的 4 个 token、位置 0–3：与底稿 01 第 580 行（`[A]`，按计划约定固定为 4）及 one-request.md 第 111 行一致。页面标明这是教学设定，写法正确。
- 两个 DP 组 / R1 进 DP0：与底稿 A1 第 551 行、one-request 第 123 行一致。
- 写手自报的疑点“旧页写 R1 最多输出 3 token”：底稿 01 第 8 行写的是“一直生成到结束”，删掉这个上限是对的；全库 grep 也没有残留“最多 3 个输出”的说法。
- 本页没有新的推导数字，也不涉及 calc。

### 4. 有没有丢信息

`git diff` 的基线是更早的 Qwen 版（37/200 token、248320）；写手的改前备份 `tmp/token/token-before.md` 是 GLM 版。两份都按 H2 对照过新版：

- 保留了：子词算法、BPE 论文、未知字符的处理条件、模板重复特殊标记、完整上下文计数、ID/位置区分、反分词、流式增量、三种长度概念、“未运行 GLM tokenizer”的声明（第 153 行）、两条旧误解（字数换算、输出上限≠字数）。
- **丢了**：(a) 改前稿“这个数……也不是模型认识的自然语言词语数。具体可用编号及特殊 token 的解释还要查看配套 tokenizer 文件”，以及 git 基线“这些位置也包含特殊符号等，不能当成 N 个日常词语”（→ P1-1）；(b) 改前稿“模型配置中的词表大小无法单独推导一句话的切分结果”（第 153 行只部分覆盖）；(c) 到模型总览 `glm-5-3-flash.md` 的阅读衔接链接（→ P3-5）；(d) git 基线的“不启用随机分词时同一段话切出相同编号”（→ P3-7）；(e) 改前首图用“切分—编号—位置”三件事直接演示的画面，现在只剩表格文字（→ P2-1）。

### 5. 链接和锚点

- 出链 14 个、去重后 8 个页面，文件都存在；7 个锚点用 `src/content/wiki/anchors.ts` 的 `headingSlug` 逐一算过，全部命中（含 `y₀` 那个）。
- 入链有 device-memory、embedding、glm-5-3-flash、learning-guide、index.md（2 处），都不带锚点，能解析；没有别的页用 relations 指向 token。
- `wiki/index.md` 第 40 行的摘要仍是旧 summary，要等协调者跑 `wiki:build` 才会更新（写手已说明）。

### 6. `pnpm wiki:audit`

2026-09-28 本轮运行，exit 0：审计 131 页、来源 1621 条，本地行号有效 1523，无效 commit、缺失文件、行号越界都是 0。本页 17 条来源里，13 条本地源码引用全部 ✓，4 条 URL 未联网验证（审计本身不做联网）。**本页通过。**

### 7. 问题清单

**P1**

1. **第 52 行、第 76 行｜丢了“词表维度 ≠ tokenizer 条目数/自然语言词数”，核心概念 4 讲得不完整。** 正文先在第 38 行把“词表”定义成“单元与编号的对应表”，又说“文本词表维度为 154880”，读者会以为 tokenizer 正好有 154880 个条目、每个都是日常词。两版旧稿都讲过这层限定，这次丢了。实际上，154880 是嵌入表和 `lm_head` 的行数；其中包括特殊 token（结束符 154820/154827/154829 就在这一段），也可能有永远不会被 tokenizer 产出的填充行；vLLM 允许两边的大小不同，只检查上界。**改法**：在第 52 行后补一两句，例如“154880 是嵌入表和输出打分的行数，不等于模型认识的自然语言词数；其中包括结束等特殊 token（GLM 配置中结束编号为 154820、154827、154829），分词器实际产出哪些编号要看配套 tokenizer 文件。配套的要求是：编号含义一致，编号不超过这张表的范围。”数字出处链接到 [glm-5-3-flash.md](glm-5-3-flash.md) 的配置表。

**P2**

1. **首图 `token-split`（第 40–42 行）｜直觉图只有流程框，没画出“切开”和“插入特殊标记”本身。** 四个框依次写着“文本 → 模板 → 分词器 → p₀…pₙ₋₁”，但读者看不到：模板在正文前后加了什么，句子被切成几块，每块怎样对上一个编号和一个位置。这张图画出了“经过模板和分词”这条流向，却没画出这一步的直觉。改前稿的首图原本用“切分—编号—位置”三件事直接演示，现在只剩第 60–64 行的表格文字。**改法**：保留目前的流向，再加一行示意序列，例如 `[角色标记] [推理] [引擎] [怎么] [工作] [回答起始标记]`。特殊标记用另一种色调；每块下面对一个 pᵢ 格，再往下标位置 0…n−1。图注写明“切分为示意，特殊标记用占位名”。这样不会编造 GLM 的实测编号，又能把核心概念 1、3、5 画出来。

**P3**

1. **第 44 行**“采用字节表示时，一个汉字也会被拆成多个 token”说得太满。字节级 BPE 下，常用汉字多半已经合并成 1 个 token。改为“可能被拆成多个 token（常用字也常合成一个）”。改前稿写的正是“还可能”。
2. **第 54 行 / 第 153 行**：没说 GLM 的 tokenizer 属于哪一类算法，本地也没法核实。在第 153 行的待核里补一句“GLM tokenizer 的算法类型（是否为字节级 BPE）待查 tokenizer.json”。
3. **术语**：第 40 行用“对话模板”，底稿、one-request、request-call-chain 等 5 页都用“聊天模板”，图 2 里也写“聊天消息”。建议统一成“聊天模板（chat template）”，并在 aliases 里补上“聊天模板”“chat template”。
4. **术语先用后讲**：“反分词”在第 84 行和图 2 里先出现，第 96 行才解释；“ZMQ”“worker”和 A2–A4 在图 2 里先出现，第 86、88 行才解释。把这几句解释挪到图前，或者在第 84 行第一次出现时加括注。
5. **单一出处与阅读衔接**：第 52 行的 154880 没有链接到模型页的配置表；改前稿“继续读嵌入 → 回到模型总览 glm-5-3-flash.md”的衔接也丢了。补上链接即可。
6. **图 2 `token-entry-flow`**：这一节标题问的是“R1 在入口拿到了什么”，图里却没有任何 R1 的具体数据。可以在“包装引擎请求”框里补“R1：4 个编号 p₀–p₃”，在“未指定执行组”框里补“两组都是 0 分 → DP0”。
7. **第 78 行**：“比较两次 token 数要固定……”这串条件，可以补回 git 基线里的“且未启用随机切分（subword regularization）”。

### 结论

核心概念没有讲错；数字与底稿和配置一致；源码层面的描述（先登记输出再选组、同分取起点组、编号只查上界）都实际核对过。主要问题有两个：一是丢了“154880 ≠ tokenizer 条目数/自然语言词数”这层限定（P1）；二是首图没画出“切开 + 插特殊标记”这一步的直觉（P2）。两处都修好后可以到 9 分。


## P5 修订记录（09-28，按「P5 审查（09-28）」修订）

写手：Opus 写手（第二轮修订）。只改了 `wiki/concepts/token.md`、`wiki/diagrams/token-split.yaml`、`wiki/diagrams/token-entry-flow.yaml` 及两张生成的 svg。改前备份在会话 scratchpad `p5run/token-fix/`。

### 逐条处理

| 审查项 | 处理 |
| --- | --- |
| P1（第 52、76 行） | 第二屏补一句：154880 是嵌入表和输出打分的行数，不等于分词器条目数、更不是自然语言词数，并链接模型页「全模型形状总表」。GLM 段新增 H3「编号要落在 154880 行之内」：calc 拆三段（普通条目 0–154819 共 154820 个、特殊标记 154820–154855 共 36 个、分词器不产出的 154856–154879 共 24 行）；三个结束编号对应哪三个标记；两边为什么可以不同（补齐对齐或预留，GLM 属哪种未写明，列入待核）；vLLM 只查上界，GLM 上界 154879，所以直接传 154856–154879 也能过检查。常见误解加一条“154880 = 分词器条目数且都是日常词”。 |
| P2（首图） | `token-split` 重画：① 用户正文 → ② 按 GLM 自带 chat template 在前面插入 gMASK、sop、system 标记加推理强度说明、user 标记，在后面插入 assistant 标记和 think 标记（图里写原样标记名），正文用扇形箭头切成 4 块，每块框内下行是编号 → ③ 主线 R1 记作 p₀–p₃，并标位置 0–3。特殊标记用 control 色、正文用 token 色。6 个特殊标记编号取自 tokenizer 文件；正文切法与 a–d 为示意，图注写明。 |
| BPE | 已核实：GLM tokenizer 是字节级 BPE。第二屏新增一段：模型类型 BPE、预切分与解码为 ByteLevel、先按规则把文字/最多 3 位数字/标点/空白分开再合并、无未知标记。 |
| P3-1 | 改为“少见的汉字可能被拆成几个 token，常用字和常用词也常已合成一个”。 |
| P3-2 | BPE 已核实，待核改写为“未运行分词器、a–d 与推理强度行的 token 数未知、24 行用途未知”。 |
| P3-3 | “对话模板”改为“chat template（聊天模板）”；aliases 补“聊天模板”“chat template”“字节级 BPE”，保留“对话模板”作检索别名。 |
| P3-4 | 反分词、ZMQ、worker、A2–A4 的解释挪到图 2 之前；原第 88 行 ZMQ 句、第 90 行 worker 括注移走（内容未删）。 |
| P3-5 | 154880 链到模型页形状总表；第一屏末补“本页之后接嵌入，再回到模型总览”。 |
| P3-6 | 图 2：“包装引擎请求”框补“R1：4 个编号 p₀–p₃”；“未指定执行组”框补“R1：两组都 0 分 → DP0”。 |
| P3-7 | 第 78 行补“不启用随机切分（subword regularization）”，并写明 GLM 配置中 BPE dropout 为空；另补模板选项例子（推理强度改写 system 行）。 |

### 数字出处

- R1 的 4 token、位置 0–3、两组 0 分进 DP0：底稿 01 §A1（第 580 行）与 one-request，未改。
- 154880、结束编号 154820/154827/154829：底稿 01 §A1 待核 1 与固定 config（S3），未改。
- **新增、底稿里没有的数**（均来自一手文件，不是推算）：普通条目 154820 个（编号 0–154819，含 256 个单字节）、36 个特殊标记（154820–154855）、各特殊标记编号（`[gMASK]`=154822、`<sop>`=154824、`<|system|>`=154826、`<|user|>`=154827、`<|assistant|>`=154828、`<think>`=154841、`<|endoftext|>`=154820、`<|observation|>`=154829）、空行 24 = 154880 − 154820 − 36、vLLM 上界 154879 = max(154855, 154880 − 1)、默认模板 6 个特殊标记。出处：本地 `infra-view-hardware-study-20260906/glm-flow/reference/tokenizer.json`（只抽元数据，未通读）与同目录 `model-revision.json`（HF API 元数据，sha=690b7052，内含 chat_template）。一致性旁证：固定 config 的 eos 列表、`image_token_id`=154854、`video_token_id`=154855、图像/视频起止编号 154830–154833，都与 tokenizer 文件里的对应标记吻合；`generation_config.json` 的 eos 列表相同。
- 正文切分和 a–d 编号：未运行分词器（本机无 tokenizers/transformers），一律示意。

### 核心概念核对

- 字节级 BPE：tokenizer.json `model.type=BPE`、pre_tokenizer 为 Split(正则) + ByteLevel、decoder 为 ByteLevel、`unk_token=null`、`dropout=null`；基础词表含全部 256 个字节符号（脚本逐个核对）。
- 模板：用 jinja2 实际渲染 690b7052 的 chat template（单条用户消息、add_generation_prompt），得到 `[gMASK]<sop><|system|>Reasoning Effort: Max<|user|>X<|assistant|><think>`；传 reasoning_effort=low 时 system 行变成 Low。官方教程 `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` 没有 `--chat-template` 覆盖。
- 越界检查：`vllm@0fc695fc:vllm/v1/engine/input_processor.py#L469-L484`（`max(tokenizer.max_token_id, vocab_size - 1)`，注释明说两边可以不同）；`max_token_id` 来自 `vllm/tokenizers/hf.py#L112-L126`（取 get_vocab 的最大值，GLM 为 154855）。
- 停止编号：`vllm@0fc695fc:vllm/sampling_params.py#L590-L618`，生成配置的 eos 列表在未设 ignore_eos 时并入 stop_token_ids。
- sources 新增 5 条（#18 tokenizer.json、#19 chat_template.jinja、#20 hf.py、#21 sampling_params.py、#22 generation_config.json），追加在末尾，原 1–17 编号不变；来源索引补两条归并结论。

### 字数与校验

- 字数（`wiki:audit` 口径）：正文 5939 → 8653 字；写作标准口径 2280 → 3400 字。行内代码 2.9/千字，角标 0，calc 0.29/千字（全页 1 个，在新 H3），相邻块 0，图先行，免责 1.0%，图宽通过。
- `pnpm wiki:lint`：exit 1，唯一的 x 是 `concepts/hardware-devices.md [source-domain]`（别页）；token.md 无错误、无提醒。
- `pnpm wiki:diagrams --check`：163 张图与 spec 一致；token-split、token-entry-flow 无提醒。
- `pnpm wiki:audit`：exit 0；本页 22 条来源，15 条本地源码引用全部 ✓，7 条 URL 未联网验证。
- 未截图、未起服务（浏览器验收由审查环节负责）。

### 疑点与交接

1. **R1 的 4 token 低于真实模板下限**：按 690b7052 的模板，单条消息光特殊标记就有 6 个。页面已如实写成“教学设定，真实输入不会只有 4 个”，数字未改。底稿 01 §A1 待核 1（模板加多少特殊 token）现在可以用上面的渲染结果关闭，另外第 580 行“套完模板后固定为 4”与待核 1“在 4 个 prompt token 前后加特殊 token”两种说法不一致，建议协调者在底稿统一。
2. 首图没有把正文那句话说成 R1（底稿没有 R1 的文本和编号，硬说会自相矛盾），R1 只在图的第 ③ 行以 p₀–p₃ 出现。
3. 第一次跑 `pnpm wiki:diagrams` 时，顺带按 `device-memory.yaml` 的当前内容重写了 `device-memory.svg`（该 yaml 比 svg 新，应是别的写手在改）；之后改用 `--check` 先确认只有本页图过期再生成。
4. `wiki/index.md` 的摘要未动，本页 summary 也未改。

## P5 复审（09-28）

独立审查员，只审不改页面。对象：`wiki/concepts/token.md` 工作区版本，以及 `wiki/diagrams/token-split.yaml` / `token-entry-flow.yaml`。

**得分：9.0 / 10**（上轮 P1、P2 均已落实；新增 P3 3 条，无新 P1/P2）

### 读取范围与跳过

- 正文读了第 41–137 行（「## 对照源码」之前），第 93–98 行的 calc 是本次复审对象，读了；第 9–31 行 sources 区只 grep 了 tokenizer / chat_template / input_processor / hf.py 等关键词，没有通读。
- 「## 对照源码」只 grep：5 个 H3 齐全、顺序正确（140 / 146 / 150 / 154 / 166）；版本差异（154–165 行）含 v0.23、v0.26、main。
- 参考文件只抽元数据：用脚本读 `glm-flow/reference/tokenizer.json` 的 model 字段、added_tokens、pre_tokenizer、decoder；配置文件先 grep 行号再看附近几行；`model-revision.json` 只取出 chat template，用 jinja2 渲染。没有整份读任何参考文件，也没有读取被拦。

### 逐条结论

| 复审项 | 结论 | 依据 |
| --- | --- | --- |
| 154880 = 154820 + 36 + 24 | **落实** | 页面第 59 行（行数 ≠ 分词器条目数 ≠ 自然语言词数，并链到模型页形状总表）、第 91–98 行 calc、第 132 行误解条都已写到。一手文件对得上：tokenizer.json 的 `model.vocab` 有 154820 条，编号 0–154819 连续；`added_tokens` 有 36 条，编号 154820–154855 连续，和 vocab 不重叠；154880 − 154820 − 36 = 24。模型配置 `official-config.json` 第 259 行 `vocab_size: 154880`，第 9–13 行 eos 是 [154820, 154827, 154829]，第 244 行 pad 是 154820，第 281–286 行图像/视频编号 154854/154855/154830–154833，都和 tokenizer 里的对应标记吻合；`generation_config.json` 的 eos 列表相同。第 100 行说三个结束编号对应 `<|endoftext|>` / `<|user|>` / `<|observation|>`，对。多轮渲染结果 `…<|assistant|><think></think>B<|user|>C…` 也证实：一轮回答后面没有单独的结尾标记，直接接下一个角色标记。 |
| vLLM 只查编号上界 | **落实，讲对了** | 第 102、104 行。`vllm@0fc695fc:vllm/v1/engine/input_processor.py#L469-L484`：`max_input_id > max(tokenizer.max_token_id, vocab_size − 1)` 才报越界，注释明说两边的词表大小可以不同。`vllm/tokenizers/hf.py#L112-L126`：`max_token_id = max(get_vocab 的最大值, tokenizer.vocab_size)`，GLM 是 max(154855, 154820) = 154855，所以上界是 max(154855, 154879) = 154879，和页面一致。第 104 行说“直接传 154856–154879 也能通过检查”，对。（小细节：代码还会和 `tokenizer.vocab_size` 取较大值，GLM 下结果不变，不必改。） |
| 首图 | **落实** | `token-split.yaml` 第 4 行 size [900, 350]，svg 的 viewBox 也是 `0 0 900 350`，没超过 900。本轮用 Playwright 把 svg 截了图：6 个模板标记分列在正文前后，正文 4 块用扇形箭头标出“切开”，括号分别标“模板插在前面 / 正文切成的块 / 模板插在后面”。真实编号 154822、154824、154826、154827、154828、154841 逐一对过 tokenizer.json，都对；出处写在图注（yaml 第 3 行）和正文第 51 行，frontmatter 第 27 行有钉到 690b7052 的 tokenizer.json 链接。a–d 在图注和第 51 行写明是示意；p₀–p₃ 是符号名，第 85 行也说明了。用 jinja2 渲染 690b7052 的模板，得到 `[gMASK]<sop><|system|>Reasoning Effort: Max<|user|>X<|assistant|><think>`，和图、第 51 行一致；reasoning_effort=low 时变成 Low，和第 87 行一致。 |
| 字节级 BPE 的出处 | **落实** | 第 63 行把出处写成“模型仓库的 tokenizer 文件”，sources 第 27 行是钉到 sha 690b7052 的 tokenizer.json。一手核对结果：`model.type=BPE`，`pre_tokenizer` 是 Sequence[Split(正则), ByteLevel]，`decoder` 是 ByteLevel，`unk_token=null`，`byte_fallback=false`，`dropout=null`；256 个字节符号全在 vocab 里。正则确实把字母串（`\p{L}+`，汉字也算）、`\p{N}{1,3}`、标点、空白分开，第 63 行的描述准确。第 87 行“BPE dropout 为空”也对。 |
| `pnpm wiki:audit` | **本页通过** | 09-28 本轮运行，exit 0：审计 131 页、来源 1668 条，无效 commit、缺失文件、行号越界都是 0。本页 22 条来源里，15 条本地引用全部 ✓，7 条 URL 未联网验证。写作标准各项全 ✓（行内代码 2.9/千字、角标 0、calc 0.29/千字、相邻块 0、图先行、图宽）。 |

补充核对：新增的锚点都能解析（`glm-5-3-flash.md` 第 255 行「全模型形状总表」、本页第 89 行 H3）。`sampling_params.py#L590-L618` 核过，生成配置里的 eos 列表在没设 ignore_eos 时会并入 stop_token_ids，和第 100 行一致。

### 新发现（P3，不影响分数门槛）

1. **第 51、96、132 行｜“36 个特殊标记”说得太笼统。** tokenizer.json 里这 36 个 added token 只有 18 个标了 `special: true`（154820–154837）；`<think>`（154841）、`</think>`、工具调用标记、`<|image|>`（154854）、`<|video|>`（154855）等另外 18 个是 `special: false`。它们照样整体算一个 token，但反分词时不会被 skip_special_tokens 隐藏。**改法**：第 96 行写成“36 个附加标记（其中 18 个标为 special）”，或者在第 51 行加一句括注。
2. **首图“推理强度说明 / 几个 token”和第 153 行的待核可以收紧。** 我按 tokenizer.json 的 vocab + merges（遵守 `ignore_merges=true`）自己写脚本复算：`Reasoning Effort: Max` 是 6 个 token（Reason / ing / ĠEff / ort / : / ĠMax），Low、High 也都是 6 个；“推理引擎怎么工作”恰好切成 推理 / 引擎 / 怎么 / 工作 = 107934 / 106244 / 99311 / 98538。**这不是官方 tokenizers 库跑出来的**，所以页面暂时保持示意是对的。建议写手用官方库复核；一致的话，把 a–d 换成真实编号，“几个 token”改成“6 个 token”。
3. **首图第 ③ 行｜p₀–p₃ 和上面 a–d 同色，数量也都是 4，读者容易以为 R1 就是那 4 块正文。** 第 79 行已经用文字澄清了。可以再把第 ③ 行换个色调，或者在注文里补一句“与上方 4 块无对应”。

### 结论

上轮的 P1（154880 的构成）和 P2（首图没画出切分与特殊标记）都已落实，数字与 tokenizer 文件、模型配置、生成配置三处一手文件逐一对上，vLLM 上界的描述与源码一致。本页可以定稿；R1 = 4 的设定是否合理，另见 `docs/mainline/review/r1-realism-2026-09-28.md`。
