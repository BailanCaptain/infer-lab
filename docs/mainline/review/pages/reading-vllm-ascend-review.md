# 审查：wiki/concepts/reading-vllm-ascend.md

## P5 写作记录（2026-09-29，第 16 批，小修）

### 改了什么

- 标题改为「怎样读 vllm-ascend 源码：先抓请求主线，再带着问题追到实现」，旧标题「源码阅读方法」留作别名；summary 重写（141 字）。
- 新增前两节：先讲 vllm-ascend 是什么、靠 entry point / 平台 / patch / custom op 接进 vLLM（一句话 + 链到 request-call-chain「六个口子」、platform-plugin-registration、vllm-ascend-overview），再讲为什么先抓一条请求的主线（七站只点名，进程/类/函数链一律链到 request-call-chain，目录总览只链 vllm-ascend-repo-map）。
- 第一屏直觉图：沿用现有图 ascend-vs-upstream（vllm-ascend-overview 的图，未改 spec），把它 pins 用到的 4 条源码加进本页 sources；原有 locate-routes、ref-diff 两图保留，位置不变。
- 三条路线、异常、版本对照四节保留原结论，改成初学者口径；讲解区的 11 个证据角标全部移到页末；命令块从路线二移到「源码位置」，并改成在 vllm-ascend 仓库里直接运行的写法。
- 路线一原链接指向 concurrent-requests 的「A/C 批次」，该页现已没有 A/C，改指 prepare-inputs-flow#ac-第三轮如何拼接（修复旧版断链语义）。
- 路线二的平台改写例子写实：重算调度开关在 PD 分离的 P 节点被改回关闭并警告，非 D 节点打开直接报错（db701c1f platform.py 第 680–695 行）。
- 新增「放到 GLM 双机」一节（只挂靠 + 链接：版本、三条路线在本部署先碰到什么、异常陪跑），「常见误解」6 条，「对照源码」五个 H3（怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置）。
- relations 新增 vllm-ascend-overview（builds-on）；request-call-chain 已写 builds-on 指向本页，按 lint 规则本页不回写。

### 数字出处

无新增数字。用到的既有数：R1 = 4 token 的教学示例（链 one-request「示例请求 R1」，底稿 01 §A1–A2）；R1 分到 DP0、node0 的 8 个 worker、TP8（链 request-call-chain 与 prepare-inputs-flow，底稿 01 §A0、§A3、§B1）；七站划分沿 one-request / request-call-chain（02 §1、03 §A5 只用作站名，不取数）。FlashComm1 在本部署关闭沿用 ascend-config-system「落到 GLM 双机」的结论。

### 核心概念对照的源码（全部 git show / git grep 单行或 ≤20 行）

- entry point 两组 5 个：db701c1f setup.py 第 543–551 行；2c59ff10、2ed6cbba、baa023ad 的平台组相同。
- 配置合并规则（JSON 键优先，否则环境读取值）：db701c1f ascend_config.py 第 84–89、335–346 行；2c59ff10 第 354 行、2ed6cbba 第 370 行同名同逻辑；main 无此函数，enable_flashcomm1 弃用警告在第 1556–1562 行，剔除清单第 1616–1629 行，派生校验仍读该键第 604–624 行。环境默认值：db701c1f envs.py 第 75 行（默认 0）。
- RMSNorm → AscendRMSNorm：db701c1f utils.py 第 735–768 行；三个其他提交同名登记。GLM 调 input_layernorm：glm5_next.py 第 2218 行；main 在 glm5next/model.py 第 402 行，类名 Glm5NextDecoderLayer（第 267 行），基线类名 AscendGlm5NextDecoderLayer（第 2053 行）。
- GLM 模型文件：列 models 目录，2c59ff10 与 2ed6cbba 无 glm 文件；db701c1f 三个文件；main 为 glm5next/ 目录。
- patch 条件导入：db701c1f patch/platform/__init__.py 按 is_310p 与 vllm_version_is("0.23.0") 分支。
- 图回放同步：db701c1f acl_graph.py ACLGraphWrapper.__call__，整图模式（非 EAGLE 草稿、未开 enpu）回放前 synchronize。

### 旧版信息清单勾选（清单见写手 scratchpad reading-vllm-ascend-facts.md，F1–F19）

- F1–F3 问题拆分、四件事、locate-routes 图：保留在「带着问题读」。
- F4–F6 路线一及三行边界表：保留；A/C 链接改指 prepare-inputs-flow。
- F7–F10 路线二：保留；命令（F9）移到「源码位置」。
- F11–F12 路线三：保留，patch 确认方法加链 ascend-patch-system。
- F13–F15 异常证据边界：保留；站点认定改链 request-call-chain，不重讲。
- F16–F18 版本对照、git 用法、结论写法：保留在「对照版本」一节。
- F19 frontmatter：relations、aliases、chapters、evidence 均保留，只增不删。
- 无删除项。

### 验证

- pnpm wiki:lint：本页 0 报错、0 警告（mark-flood 由 100% [C] 降到 C 19 / 全部 25）；当前全库唯一报错在 concepts/ucm.md（别页）。
- pnpm wiki:diagrams --check：260 张图与 spec 一致，本页三张图无提示。
- pnpm wiki:audit：退出 0，本页一行统计正常。
- 写作标准检查（scripts/wiki/standard.ts checkStandard）：行内代码 0.3/千字、讲解区角标 0、对照源码五节齐、图先行、免责 0%，全部通过。
- 未开浏览器（按派发要求由审查环节负责）。

### 疑点 / 留给审查

- request-call-chain 的 relations 里指向本页的 note 写「那一页讲整个仓库的目录怎么分工」，那是 vllm-ascend-repo-map 的内容；不是本页范围，未改，建议协调者改 K 的 note。
- ascend-vs-upstream 图同时出现在 vllm-ascend-overview 与本页；若审查认为「沿用现有图」只指本页原有图，可去掉第一节的图，改把 locate-routes 挪进前两节（标准检查要求直觉图在前两个 H2 内）。

## P5 审查（09-29）

审查员：Opus 5.5（独立审查，只审不改页面）。分数 **8.5 / 10**。P1 0 条，P2 1 条，P3 5 条。

### 学习顺序与初学者测试

- 顺序：是什么（插件 + 怎样接进 vLLM + 直觉图）→ 为什么按主线读而不是按目录读（含代价：主线只覆盖当前部署走到的分支）→ 怎么读（带着问题、三条路线、异常、版本对照）→ GLM 双机 → 常见误解 → 对照源码。**通过**；GLM 数字（DP0、node0 的 8 个 worker、TP8、R1=4 token）只出现在 GLM 双机一节。
- 只读前两屏的一句话：vllm-ascend 是装在 vLLM 上的昇腾平台插件，靠 entry point 交出平台类、登记通用插件、打 patch、替换 custom op 接进来，一条请求跑的是两个仓库拼起来的代码，所以先沿七站主线读，再带着问题追实现；代价是主线外的分支要另外补读。
- 本页是方法页，没有「怎么算」的环节，不适用「数值演算」一条。

### 源码核对（只 grep 名字单行；算子 / kernel 目录未读）

以 db701c1f 为主，全部存在、路径正确：
- setup.py 第 543–551 行：`vllm.platform_plugins` 一条（`vllm_ascend:register`，`__init__.py` 第 41 行返回 `"vllm_ascend.platform.NPUPlatform"`）；`vllm.general_plugins` 四条（connector / model_loader / service_profiling / model），与正文「平台组只有一条、通用组登记连接器、模型加载器、性能采集和模型实现」一致。
- vLLM 0fc695fc 在前端（engine/arg_utils.py 第 747 行）、EngineCore（v1/engine/core.py 第 109 行）、worker（v1/worker/worker_base.py 第 247 行）都调 `load_general_plugins()`，与「前端、引擎、worker 启动时都扫一遍」一致。
- platform.py 第 128 行 `class NPUPlatform`；第 680–695 行重算调度：P 节点（kv_producer）警告并改回 False，非 kv_consumer 直接 ValueError——与路线二描述一致。
- ascend_config.py 第 84 行 `self.enable_flashcomm1 = self._get_config_value(...)`，第 335 行 `_get_config_value`：JSON 键优先，否则返回环境读取值；envs.py 第 75 行默认 "0"；utils.py 第 905 行 `enable_sp` 在未开 `enable_shared_expert_dp`（ascend_config.py 第 115 行默认 False）时返回假——「官方命令下 FlashComm1 关、序列并行判断函数返回假」成立。
- utils.py 第 735/751 行 `REGISTERED_ASCEND_OPS` 含 `"RMSNorm": AscendRMSNorm`，第 820 行 `CustomOp.register_oot`；glm5_next.py 第 31 行从上游导入 `RMSNorm`，第 2053 行 `class AscendGlm5NextDecoderLayer`，第 2129 行 `self.input_layernorm = RMSNorm(...)`；第 175–178 行层自己返回 `AscendIndexerKPoolMLABackend`（GLM 小节「稀疏 MLA 不查平台表」成立）。
- compilation/acl_graph.py 第 65 行 `ACLGraphWrapper`、第 138 行 `__call__`；第 253–256 行 FULL 模式、非 EAGLE 草稿、未开 enpu 时回放前 `synchronize()`——正文「整图模式下回放前先等」成立（省略了两个例外条件，可接受）。
- patch/platform/__init__.py 第 27、34、55 行按 `is_310p()`、`vllm_version_is("0.23.0")` 条件导入——「patch 目录按设备型号、按 vLLM 版本挑文件」成立。
- worker/model_runner_v1.py 第 814 / 1917 / 2373 行 `_prepare_inputs` / `execute_model` / `sample_tokens`。
- 版本列：`vllm_ascend/models/glm5_next.py` 在 2c59ff10、2ed6cbba、baa023ad 均不存在，2c59ff10 / 2ed6cbba 的 vllm_ascend 下无任何 glm5 文件；main 为 `models/glm5next/`，`model.py` 第 267 行 `class Glm5NextDecoderLayer`；main 无 `_get_config_value`，`FlashComm is deprecated` 在 ascend_config.py 第 1561 行；`"RMSNorm": AscendRMSNorm` 在三提交都在——「版本差异」表与正文「v0.23 维护分支和 v0.26 没有 GLM 模型代码，main 拆成目录」一致。

核心概念无错。

### 与 request-call-chain 的重复、首屏借图

- 七站只点名 + 链接；每站进程 / 函数统一链 K 的「七站逐站」和「源码位置」；异常认站链 K 的「出问题时」；GLM 小节 node1 陪跑、稀疏 MLA 各一句 + 链接。「源码位置」按路线列证据，不是七站调用链的复制。**未发现重复调用链。**
- 第一节「六处」逐条链到 K 的「六个口子」，没有重列六条。
- 不依赖 vllm-ascend-repo-map 的新内容：只有第二节一处不带锚点的链接和 relations，现版 repo-map 能承接。
- **借图 ascend-vs-upstream 判定合适，不记 P2**：本页第一节的主题正是「vllm-ascend 是什么、怎样接进 vLLM」，图的横线（上游 vLLM / 平台边界以下）直接对应本节要落的读码结论「一条请求跑的是两个仓库拼起来的代码」（第 57 行），虚线的登记 / patch / 注册正是读码最容易漏的跨仓库改写。浏览器实测（scratchpad reading-vllm-ascend-review-1.png）图在第一屏完整可读。写手疑点 2 的「去掉图、挪 locate-routes」不建议采纳。

### 旧版信息清单抽查（清单存在：580bfd6e scratchpad reading-vllm-ascend-facts.md）

抽 6 条到新版：F1（第 69 行）✓；F5 三行边界表（第 85–89 行）✓；F9 rg / git grep 命令（移到源码位置第 197–200 行）✓；F11 路线三（第 103 行）✓；F14 异步与图回放同步（第 113 行）✓；F17 git show / git diff / 按符号搜 / 发布说明要核目标提交（第 125 行）✓。另核 F19：relations 三条（新增 overview，旧两条保留），aliases 8 个（旧 7 个全在 + 「源码阅读方法」），chapters ["20"]、evidence C 未变 ✓。`git diff` 删掉的行均为旧措辞，信息在新版对应节都能找到；路线一旧链接指向 concurrent-requests 的 A/C，已改指 prepare-inputs-flow#ac-第三轮如何拼接（该节确为 4 行、选行 [0, 3]，「四行只采样两行」成立）。

### 链接与锚点

- 正文 19 个链接逐一 grep 目标标题：全部存在（K 的「出问题时，判断它停在哪一站」、patch 页「排查时，怎样确认跑的是哪一份代码」逗号在 slug 中被去掉，lint 通过）。
- 全库入链：ascend-patch-system、fine-grained-tp、vllm-ascend-repo-map、index.md（派生），都不带锚点，改标题不影响。
- `pnpm wiki:lint`：唯一报错是 concepts/lm-head.md 与 glm-5-3-flash.md 的 dup-alias（别页，与本页无关）；本页 0 报错。
- `pnpm wiki:audit`：退出 0，本页 22 条来源全部 ✓（行号有效），**本页通过**。

### 问题清单

**P1**：无。

**P2**
1. **页面上有写作过程的 meta 文本**。位置：第 131 行「本页挂在整条主线上」（「挂靠」是排期队列的术语，读者看不懂）、第 131 行「这里只说……会先碰到什么」、第 63 行「本页不再重复」、第 109 行「本节只讲……」。影响：读者读到的是编排说明而不是内容。改法：第 131 行删「本页挂在整条主线上」，直接从「R1 是为了手算设的示例请求」开始；第 63 行「本页不再重复」删掉（前半句「统一看……」已够）；第 109 行改成直接讲内容，例如「读的时候最容易越界的是下面几处」。

**P3**
1. 第 133 行「执行侧按 GLM 基线分支上的一个固定提交读」：db701c1f 在本机 clone 里不属于任何分支（`git branch -a --contains` 为空），别页口径是「GLM 专用镜像里的固定提交 / orphan commit」。建议改成「执行侧按 GLM 专用镜像对应的固定提交 db701c1f 读，它不在社区 v0.23 / v0.26 / main 任何一条线上」。
2. 第 55 行说「一共从六处进入请求路径」，紧接着「各扩展点的分工见 vllm-ascend-overview」，而 overview 的 H2 是「五个扩展点」，读者会困惑五与六。建议给 overview 链接加半句说明（例如「overview 按扩展点分为五类，六个口子多算了 worker 接管」之类，以两页实际口径为准），或只保留 K 的六个口子一条链接。
3. 第 55 行一段里连着三个链接（K 六个口子、platform-plugin-registration、overview），略像第一节末尾堆链接（讲法第 14 条）。可只留 K 一条，其余两页已在 relations 里。
4. 第 51 行首次出现 Executor、worker、model runner，第 65 行首次出现「PD 分离」，本页都没解释。overview 首屏给过 Worker 的一句定义，本页借了图却没借这句。建议在第 51 行图注里补半句「worker 是守着一张卡执行模型的进程，model runner 是它里面拼输入、跑前向的对象」；PD 分离加一个括注或链接。
5. （给协调者，非本页文件）request-call-chain 第 85 行指向本页的 relation note 写「那一页讲整个仓库的目录怎么分工」，那是 vllm-ascend-repo-map 的内容，应改成「那一页讲怎样带着问题沿主线读源码」。

### 浏览器实测

用户预览 http://localhost:5193/#/wiki/reading-vllm-ascend（Playwright，1440×900，未起停服务）：标题、summary、第一节与 ascend-vs-upstream 图在第一屏正常渲染；locate-routes 图在「带着问题读」一节正常。截图：scratchpad\reading-vllm-ascend-review-1.png（第一屏）、reading-vllm-ascend-review-2.png（locate-routes 图）。

### 跳过

frontmatter 的 sources 区；「对照源码」各 H3 的正文（只 grep 五个 H3 齐全且顺序正确、版本差异表头含 v0.23 / GLM 基线 / v0.26 / main，并抽反引号标识符去源码核对）；页面代码块；算子 / kernel 目录（只对 vllm_ascend 全目录 grep 过 `class AscendRMSNorm` 定义行，未读 ops 下任何实现）。

## P5 修订记录（09-29）

写手：Opus 5.5。按「P5 审查（09-29）」逐条处理。

- **P2-1 meta 文本（已修）**：删「本页挂在整条主线上」「这里只说……会先碰到什么」，GLM 一节直接从 R1 讲起，末句改为「在官方双机部署上照上面三条路线读，会先碰到下面几件事」；「本页不再重复」删掉；异常一节「本节只讲……」改为「认完站以后，读的时候最容易越界的是下面几处」；版本差异里「本页三条路线」改为「上面三条路线」。全文 grep「本页 / 本节 / 这里只 / 挂在」已无命中。
- **P3-1（已修）**：「GLM 基线分支上的一个固定提交」改为「GLM 专用镜像对应的那个固定提交，这个提交不在社区的 v0.23、v0.26、main 任何一条线上」（口径对齐来源基线页：镜像标签对应公开提交 db701c1f）。
- **P3-2（已修）**：「六处」后面直接列出六处名字（平台、worker、注意力后端、custom op、patch、模型注册），只链 request-call-chain「六个口子」；删去正文里指向 overview 的链接，不再出现「五个扩展点」与「六处」并列（overview 仍在 relations 和版本差异里）。
- **P3-3（已修）**：第一节末尾三连链接拆开：platform-plugin-registration 挪到讲「按组名扫一遍登记」的那一句旁边，overview 链接删去，段末只留 K 一条。
- **P3-4（已修）**：图注补 Executor（引擎里把计划发给各卡的对象）、worker（守着一张卡执行模型的进程，每卡一个）、model runner（worker 里拼输入、跑前向的对象）的一句话解释；「PD 分离」首次出现处加链接和括注（prefill 和 decode 交给两组机器分别跑）。
- **P3-5（未改，非本页文件）**：request-call-chain 指向本页的 relation note 需协调者改。

验证：pnpm wiki:lint 通过，本页 0 报错 0 警告；pnpm wiki:diagrams --check 267 张一致，本页三张图无提示；pnpm wiki:audit 退出 0，本页 22 条来源正常；写作标准检查全部 ✓（讲解区 3728 字、行内代码 0.3/千字、角标 0、免责 0%）。未开浏览器复看。
