# platform-plugin-registration 审查与写作记录

## P5 写作记录（2026-09-28，Opus 写手接手 GPT 半成品）

### 接手时的状态

`git diff p4-checkpoint` 显示上一位写手把页面从 175 行删到 81 行（+44 / −138），只剩六个 H2 的概述型段落：没有对照源码区、没有版本差异、没有常见误解、没有第二张图，`verified` 被清空，旧版里绝大部分机制说明和边界情况都不在了。本轮从缺的部分接着写，并按写作标准重排六步结构。

### 改了什么

- **结构**：按「第一屏是什么 → 为什么需要、代价 → 落到 GLM 双机 → 出问题看哪一层 → 常见误解 → 对照源码」重写。对照源码补齐五个 H3（旧版缺「开销和什么时候别开」），其后没有 H2。
- **两张图**（都重画/新增，宽 ≤900）：
  - `plugin-registration`（直觉图，改）：安装元数据 → 按组名发现 → 两条分支：平台组一个入口只交回类路径、决定当前平台；通用组四个入口当场执行登记函数，其中一个把架构名接到昇腾实现类。图上标明「装上就有、卸载就没有」「每起一个进程都要重读一遍」。
  - `plugin-registration-flow`（代码流程图，新增）：上半部通用组的三个调用点（前端解析参数、EngineCore 初始化、worker 初始化）汇到同一次读取，再分成「三个入口先补全局补丁」与「模型入口只加注册表条目」两支；下半部平台组按需解析并缓存。图上不写代码名。
- **和 vllm-platform-interface 的边界**：本页只讲发现、过滤、执行注册和登记了什么；候选之间怎么挑、结果存哪里回链到那一页的「当前平台是怎么选出来的」。保留 H3「发现、过滤、激活」，因为那一页用 `#发现过滤激活` 指过来。
- **relations**：删掉指向 vllm-platform-interface 与 engine-processes 的反向边（`wiki:lint` 的 relation-duplicate 报的就是这两条，那两页已各有一条指向本页），改为 glm-5-3-flash 与 npu-worker-lifecycle。

### 数字取自哪里

- 20 个进程、16 个占卡、node0/node1 的构成：底稿 01 §A0「怎么走的」第 1–6 步与 §A0.1 进程账，正文回链 [glm-5-3-flash-two-node「启动时发生了什么」]，没有另算一份进程账。
- 通用组登记在本部署执行 19 次 = 1（前端）+ 2（EngineCore）+ 16（worker）：由 §A0.1 的进程构成与上游三个调用点相乘得出，页内标了 [D]。
- 每卡权重 20.58 GiB：底稿 01 §A0.7，只给结论并链接到 device-memory，不重算。
- GLM 架构名 `Glm5NextForConditionalGeneration` → `AscendGlm5NextForConditionalGeneration`：底稿 01 §A0 待核 4 与 `vllm_ascend/models/__init__.py`。

### 核心概念对照了哪份源码

本轮全部重新打开读过（只读片段）：

- `vllm@0fc695fc:vllm/plugins/__init__.py`：组名常量与注释（general 组在 process0 / engine core / worker 都加载）、`load_plugins_by_group` 用 `importlib.metadata.entry_points` 取清单并逐个 `plugin.load()`、失败只 `logger.exception` 跳过、`load_general_plugins` 用模块级 `plugins_loaded` 去重后直接 `func()`。
- `vllm@0fc695fc:vllm/platforms/__init__.py#L212-L281`：内置 tpu/cuda/rocm/xpu/cpu 与外部插件都调一遍、返回非 `None` 记为激活、外部插件 ≥2 抛 `RuntimeError`、外部优先于内置、`current_platform` 懒加载并缓存。
- `vllm@0fc695fc` 三个调用点：`arg_utils.py#L744-L747`、`v1/engine/core.py#L106-L109`、`v1/worker/worker_base.py#L245-L247`（逐个 sed 打开确认调用就在这几行）。
- `vllm-ascend@db701c1f`：`setup.py#L543-L551` 两组五个入口；`vllm_ascend/__init__.py` 的 `_ensure_global_patch`（`_GLOBAL_PATCH_APPLIED` 幂等 + docstring 写明 engine-core 子进程理由）、`register` 单行返回、四个通用函数各自做什么、`register_model` 不补补丁；`models/__init__.py` 里 GLM 的三条登记；`platform.py#L39` → `utils.py#L34` 的 `import torch_npu` 链与 `platform.py#L279` 的「只允许初始化一次」。
- 版本差异逐个打开核过：v0.23 = `2c59ff10`、v0.26 = `2ed6cbba`、main = `baa023ad`。平台组三边都是一个 `ascend`；通用组三边都是四个、名字顺序未变；`ms_service_metric.providers` 只有 main 有；`register_model` 在 v0.26 多了 kimi-k3 config 与 HunyuanVL processor 兼容补丁。镜像 `db701c1f` 的入口声明与 v0.23 逐字相同。

### 旧版信息清单勾选（清单在 scratchpad\p5\platform-plugin-registration-facts.md，共 31 条）

- **1、3–12、14–31 条**：全部在新版里，其中 8、9、21 条（交类路径而不是类、运行库只能初始化一次、`torch_npu` 导入链）合并进「平台入口只交一个名字，不交类」与源码区；25–28 条四类报错进「会报什么错」并补了第五条（架构名不在注册表里）；29 条版本差异表四行照旧。
- **第 2 条（旧章节的单机两卡 Qwen3.6-35B 例子）**：删掉。理由是本轮固定部署是 GLM 双机 2×A2×8，写作标准要求落到这套部署；旧例子对应的「四个进程各读一遍」已换成本部署的 19 次并标了推导。
- **第 11 条里「四个进程」**：同上，改成 20 个进程 / 19 次调用。
- **第 13 条**：保留，并在 GLM 段补回「请求到来之前五个入口就用完了，请求路上每个昇腾特有行为都能追到其中之一」。
- **第 30 条**：旧版源码行号按 `2c59ff10` 写，本轮按 `db701c1f` 逐条重核并替换。

### 实际运行的验证

- `pnpm wiki:diagrams` 两张图生成通过；`pnpm wiki:diagrams --check` 168 张图与 spec 一致，两张图都没有出现在提醒里（生成时曾报三处越界/压字，已改坐标和文案）。
- `pnpm wiki:lint`：本页只剩一条提醒 `[mark-flood] 87% 的标记都是 [C]`；三条 `x` 级错误都在别的页（vllm-v1-shape 的 dup-alias、engine-processes 与 request-call-chain 的 relation-duplicate）。
- `pnpm wiki:audit`：本页 24 条来源的 commit、路径、行号全部有效（行号越界 0）。把本页临时加进 `scripts/wiki/standard-pages.json` 跑了一次写作标准，九项全过（行内代码 8.0/千字、正文角标 0、对照源码 H3 顺序、calc 0.80/千字、相邻块 0、图先行、免责 1.0%、图宽），跑完已还原该文件。
- `pnpm check:content` 通过。
- 跨页锚点逐个按 `headingSlug` 规则核对：device-memory、npu-worker-lifecycle、glm-5-3-flash-two-node、ascend-patch-system、vllm-platform-interface、engine-processes 六个锚点都能在目标页当前标题里找到（engine-processes 那一页本轮正被改写，原先写的锚点已失效，改成现有的「补丁和配置为什么要每个进程各做一遍」）。
- 未做：浏览器实测与截图（按本轮写手任务单，浏览器验收留给审查环节）；启动日志实测。

### 仍待核

1. 镜像里安装后的上游产物没有单独核对，本页上游证据读的是 `vllm@0fc695fc` 的 Git 对象。
2. `Platform plugin ascend is activated`、`Available plugins for group ...` 两类日志没有实际输出，「19 次」与执行顺序都来自静态读码。
3. v0.26 与 main 各自配套的上游快照里 `plugins/__init__.py`、`platforms/__init__.py` 的逐行差异没有比对。
4. `[mark-flood]` 的 C 级占比：本页 30 个角标里 26 个是源码级，要降到 80% 以下只能删掉真实的源码指向，本轮没有为凑比例改动；建议审查时一并判断这条提醒要不要按页豁免。

## P5 审查（09-28）

审查员：Opus 5.5 子代理（只审不改页面）。分数 **9/10**，无 P1。

### 初学者测试（只读前两屏）

一句话：昇腾的包在安装时留下一张「入口点清单」，vLLM 每个进程启动时按约定的组名读这张清单、把登记的函数调一遍，平台和模型实现就换成昇腾的；代价是粒度只有「装没装」（装了就当昇腾机器）、发现不等于注册成功（导入失败只记日志）、每个进程都要重读一遍。前两屏能独立说清概念与代价，通过。

### 核心概念逐条核对（对照源码，附行号）

| 页面说法 | 证据 | 判定 |
|---|---|---|
| 组名常量两个 | `vllm@0fc695fc:vllm/plugins/__init__.py#L14`、`#L19` | 对（另有 io_processor / stat_logger 两组，页面未声称穷举） |
| `VLLM_PLUGINS` 按入口名过滤 | 同上 `#L56` `plugin.name in allowed_plugins` | 对 |
| 导入失败只记日志、不中断 | 同上 `#L60-L64` | 对 |
| 通用入口函数自身抛异常不被 try 包住（L188） | 同上 `#L79-L82` | 对 |
| 返回非 `None` 即激活；函数抛异常被吞 | `vllm/platforms/__init__.py#L217-L224`（`except Exception: pass`） | 对 |
| 外部插件优先、同类冲突报错 | 同上 `#L231-L245` | 对 |
| 「五个内置候选」 | 同上 `#L203-L209`（tpu/cuda/rocm/xpu/cpu） | 对 |
| 当前平台懒解析、结果留本进程 | 同上 `#L276`；`plugins/__init__.py#L17-L18` 注释 | 对 |
| 五个入口、名字与分组 | `vllm-ascend@db701c1f:setup.py#L544-L549` | 对，表格与源码逐字一致 |
| `register()` 函数体一行、无条件激活 | `vllm_ascend/__init__.py#L38-L41` | 对 |
| 三个入口补补丁、模型入口不补、补丁幂等 | 同上 `#L18-L35`、`#L44-L75` | 对 |
| 导入平台类会拉起运行库 | `vllm_ascend/platform.py#L39` → `vllm_ascend/utils.py#L33-L34` | 对 |
| 架构名 `Glm5NextForConditionalGeneration` → 昇腾实现 | `vllm_ascend/models/__init__.py#L12-L24`；底稿 `01#L259` | 对 |
| 三个调用点在 `EngineArgs.__post_init__` / `EngineCore.__init__` / `WorkerWrapperBase` | `arg_utils.py#L717`（函数起点）`#L745-L747`、`core.py#L106-L109`、`worker_base.py#L245-L247` | 对（另见 P3-1） |

### 数字

- 「20 个进程、16 个占卡」与底稿 `01-deploy-entry-schedule.md#L88-L97` 的进程账一致（API server 1 + DP 协调器 1 + EngineCore 2 + Worker 16）。
- 「19 次 = 1 + 2 + 16」与上游三个调用点一致；20 与 19 的差就是 DP 协调器（它不在这三个调用点上）。**本页没有写明这个口径**，见 P2-1。
- 「每卡 20.58 GiB」只做链接、未在本页推导，符合单一出处；措辞见 P3-3。全库没有第二页推导「19 次」。

### 有没有丢信息（抽查 8 条旧版清单）

| 旧版条目 | 新版位置 | 判定 |
|---|---|---|
| #4 装包写下、卸载消失 | L59 | 在 |
| #7 平台组一家胜出 / 通用组都调 | L87、L112 | 在 |
| #10 无条件返回类路径、外部优先 | L67、L162 | 在 |
| #17 `importlib.metadata.entry_points` + `plugin.load()` | L83（直觉层）、L174（源码层） | 在 |
| #19 内置五候选、非 None 即激活、OOT 优先 | L87、L116、L176 | 在 |
| #24 白名单按入口名 | L85 | 在 |
| #26–28 三类报错 | L187–L189 | 在 |
| #29 版本差异四行 | L204–L209 | 在（尾巴有删，见 P3-2） |

另核 #31 官方文档外链 → L230 `[S1]`。旧版六个 H2 在新版都有落点（`先提个问题`/`包里夹着一张清单`→第一屏；`两组口`→L102；`平台口只交一个名字`→L114；`四个进程各读一遍`→L126 换成本部署 19 次；`那条请求走到这里`→L100）。逐条比对旧版删除行里的行内代码 token，只有 `torch_npu` 系列与 `transformers` 没有新落点（P2-2、P3-2），其余都是引用格式从 `file:line` 改成来源表 `#L` 写法。

### 锚点与链接

- `#发现过滤激活`：`src/content/wiki/anchors.ts#L8-L14` 的 slug 规则去标点，H3「发现、过滤、激活」正好得到这个 slug。浏览器实测直接访问 `#/wiki/platform-plugin-registration#发现过滤激活` 落到该 H3（`scrollY 1829`，元素 `top 16`）；`vllm-platform-interface` 两处链接渲染出的 href 与之逐字相同。
- 本页 6 个外链锚点在目标页都有对应标题：`device-memory#L81`、`npu-worker-lifecycle#L29`、`glm-5-3-flash-two-node#L245`、`vllm-platform-interface#L89`、`ascend-patch-system#L31`、`engine-processes#L198`。

### mark-flood 与版式

- 正文第一个角标在 L169，在「## 对照源码」（L165）之下；**对照源码之上 0 个角标**，不违规。全页 26 处 `[C*]` + 1 处 `[S1]`，`[mark-flood] 87%` 只是提醒，本轮不建议为凑比例删源码指向。
- 「## 对照源码」五个 H3 齐全且顺序正确（L167/184/194/200/213）；版本差异里 v0.23、v0.26、main 都出现。
- 正文（L44–L164）行内代码 18 处、calc 1 个、表格与 calc 不相邻、图在第一屏之内。

### 工具验证

- `pnpm wiki:audit`：通过。本页 24 条来源行号全部有效（输出第 1013–1038 行），全库「行号越界 0、无效 commit 0」。
- `pnpm wiki:lint`：通过，本页只剩 `[mark-flood]` 一条提醒。
- `pnpm wiki:diagrams --check`：168 张图与 spec 一致，本页两张图没有出现在任何告警里。
- 浏览器实测（dev server `localhost:5193`）：两张图都渲染正常，1440 宽下 Playwright 截图确认 `plugin-registration`（安装元数据 → 按组名发现 → 两条分支）与 `plugin-registration-flow`（上通用组、下平台组）结构清楚、无压字。

### 问题清单

**P2-1 «20 与 19 的口径没写»** — 位置 L92 与 L126–L139。同一个 H2 里先说「起 20 个进程」，紧接着 calc 算出「19 次」，中间少的那一个（DP 协调器不走这三个调用点）没有一句话交代；`engine-processes.md#L147-L153` 有「20 个」的统计口径，本页既没引也没说差在哪。读者会怀疑少算了一个进程。改法：在 calc 的备注行补一句「DP 协调器不在这三个调用点上，所以 20 个进程里只有 19 个读这张清单」，或在 L92 把进程账的链接指到 `engine-processes.md#补丁和配置为什么要每个进程各做一遍` 之外再加一条口径链接。

**P2-2 «`torch_npu` 这个名字整页消失»** — 位置 L116（连带 L118）。旧版有 `import torch_npu`、`utils.py:34` 的证据链，新版改写成「昇腾的底层运行库（PyTorch 的昇腾扩展）」「昇腾的工具模块」，全页（含对照源码正文）再没有出现 `torch_npu`，只剩 `[C9]` 的行号指过去。既违反「有固定英文名的术语用英文原名」，也让读者无法把报错栈里的 `torch_npu` 对上这一页。改法：L116 改成「…会连带把昇腾的底层运行库 `torch_npu` 一起拉进这个进程」，首次出现保留现有的中文解释。

**P3-1 «『三个调用点』是简化»** — 位置 L174。上游还有两处 `load_general_plugins`：`arg_utils.py#L2585`（`AsyncEngineArgs.add_cli_args`，同一前端进程，被 `plugins_loaded` 去重）和 `model_executor/models/registry.py#L1407-L1411`（`_run_in_subprocess` 起的模型信息探测子进程，冷缓存时会另起一个短命进程再读一遍清单）。建议补半句口径：19 次只数那 20 个常驻进程，短命的探测子进程不计。

**P3-2 «v0.26 那行删掉了落点»** — 位置 L209。旧版结尾有「它会连带 import `transformers` 的 processor 类」，新版只留「已经不只是『往注册表加条目』」，读者少了「为什么值得注意」的具体后果。建议补回半句。

**P3-3 «20.58 GiB 少了 hedge»** — 位置 L124 写「每卡最终 20.58 GiB」，单一出处 `device-memory.md#L68`、`#L89` 写的是「约 20.58 GiB」并带精度条件（MLA 三个大投影未量化时上界 20.81 GiB）。引用时应与出处同样写「约」。

**P3-4 «图 2 同一面板三处标签»（可选）** — `plugin-registration-flow` 上半部有「通用组：每个进程各执行一遍」（标题第二行）、「通用组：起来就执行」（面板下方）两处同义标签，右侧注「起来得早，所以要先补补丁」贴着图的右边界。工具无告警，属观感建议，可合并成一处。

### 本轮跳过的部分

- frontmatter 的 sources 区（第 9–33 行）按读文件纪律没读，来源由 `wiki:audit` 校验。
- 「## 对照源码」（L165–L232）没有整段读，只按关键词 grep 命中的行（L169/174/176/187–189/202/204–211/217–232）与 H3 结构核对。
- 旧版正文没有整段读，只用 `git diff` 取删除行里的标题与行内代码 token 做对照。

## P5 修订记录（09-28，针对上面问题清单）

- **P2-1（20 与 19 的口径）**：在 calc 之前补一句——20 数的是常驻进程，19 数的是读清单的次数，差的那一个是 DP 协调器。它的职责按 `vllm@0fc695fc:vllm/v1/engine/coordinator.py#L24-L40` 的 docstring 写（在前端与各 EngineCore 之间转发排队长度这类负载统计，供前端做负载均衡），不是「转发 token 数」——我第一版写错了，已按 docstring 改正。它不在三个调用点上：`git grep load_general_plugins 0fc695fc` 的非测试命中只有 `engine/arg_utils.py`（L747、L2585）、`v1/engine/core.py#L109`、`v1/worker/worker_base.py#L247`、`model_executor/models/registry.py#L1411`，coordinator.py 没有。
- **P2-2（`torch_npu` 消失）**：L116 改成「会连带把 `torch_npu`（PyTorch 的昇腾扩展，昇腾算子和设备管理都从它进来）一起拉进这个进程」，并把结尾改成模块级 `import torch_npu`。核实链：`db701c1f:vllm_ascend/platform.py` L38-L44 模块级 `from vllm_ascend.utils import ...` → `db701c1f:vllm_ascend/utils.py#L34` `import torch_npu`。
- **P3-1（「三个调用点」是简化）**：在「怎么开」补一段——`AsyncEngineArgs.add_cli_args`（L2585，仍是前端同一进程，被 `plugins_loaded` 去重）与模型信息探测子进程（`registry.py` `_run()`，L1411）这两处不计入 19 次，19 次的口径是「那 20 个常驻进程各读几遍」。行号并入源码位置表 [C6] 一行。
- **P3-2（v0.26 那行的落点）**：版本差异表补回后果——`2ed6cbba:vllm_ascend/__init__.py` L75-L80 导入的 `patch/hunyuan_vl_processor_compat.py` 顶部就是 `from transformers import HunYuanVLProcessor`（该文件 L8），所以模型入口一执行就把这个 processor 类导进本进程。来源表 [C13] 加上这一行。
- **P3-3**：「每卡最终 20.58 GiB」→「每卡最终约 20.58 GiB」，与单一出处 `device-memory.md` 的措辞一致。
- **P3-4**：`plugin-registration-flow.yaml` 的分隔线左侧标签由「通用组：起来就执行」改为「通用组」，去掉与画板标题「通用组：每个进程各执行一遍」的同义重复；顶部那句总述已经写了两组的时机差别。右侧注保持原位（它与上方方块左对齐）。
- 新增来源 3 条（`arg_utils.py#L2578-L2585`、`registry.py#L1406-L1411`、`2ed6cbba` 的 processor 兼容补丁 L8）。为不越过 lint 的 mark-flood 上限（>30 报），新证据并入已有的 [C6]/[C13]，没有新增角标类别，正文引用改为指名那一行而不写方括号。
- 验证：`pnpm wiki:lint` → `ok`，本页只剩改动前就有的 `[mark-flood] 87% 都是 [C]` 一条提醒（改动中途曾涨到 32 处触发计数提醒，已回落）。`pnpm wiki:audit` → `ok`，本页来源 27 条、行号全部有效，写作标准全项 ✓（对照源码之上角标 0）。
- `pnpm wiki:diagrams` **整仓跑不过**，失败点是别人正在改的 `wiki/diagrams/attention-qkv-flow.yaml`（items[3]、items[10] 文字溢出，工作区里 ` M` 未提交），与本页无关，按「不碰别人的文件」没有动它。本页那张图改用 scratchpad 里的一次性脚本（只跑 `loadDiagrams` + `figureProblems` + `renderDiagram`，与 `wiki-diagrams.ts` 同一套函数）单独校验并重新生成 `plugin-registration-flow.svg`：0 溢出、0 压字，已确认 svg 里旧标签消失。
- 未做：浏览器实测（本轮只改文字与一处图标签，按分工留给审查环节）。
