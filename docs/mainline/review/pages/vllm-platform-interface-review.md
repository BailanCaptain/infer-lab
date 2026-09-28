# vllm-platform-interface 审查记录

## P5 写作记录（2026-09-28，第 02 批）

### 改写目的与范围

将原来的接口列表重排为“定义与直觉 → 动机和代价 → A0 平台交接 → 主机／设备分账 → 误解 → 对照源码”。首屏就地解释设备、内存、token、矩阵与平台契约；补充主机内存、设备显存、token 调度预算的区别。保留旧页的属性／准备／校验／选择职责、配置后续改写、默认预算回退、模型专用后端和版本组合证据边界。

只修改本页、它引用的 platform-hooks 图、新增的 platform-startup-contract 图及本记录；不修改共享来源页、目录、src、scripts、tests、计划，不提交 git。工作区同时存在其他页面的并行改动，验证结果须按当次日志判断。

### 数字与原始依据

- 双机落点与启动顺序：`docs/mainline/01-deploy-entry-schedule.md` §A0“怎么走的”；读者链接到 D 的“启动时发生了什么”和 K 的调用链。无独立双机推导、无新增容量算例。
- 两台 A2、每台 8 卡只引用部署结论；卡分组和显存账仍归 D。
- 2048／8192 token 是新增解释的上游查询失败后在线／离线默认基础档，直接核对 `vllm@0fc695fc:vllm/engine/arg_utils.py#L2300-L2335`，后续调整见 L2492–L2553；它们不来自 A0，也不是固定双机显式参数或最终默认值。
- 核心契约：上游 `Platform` 的设备属性、后端路径返回、配置钩子的原地修改，及 `platforms/__init__.py` 的当前进程惰性平台解析；配置调用与 Worker 加载后调整分别核对 `config/vllm.py`、`multiproc_executor.py`。
- 固定 Ascend：`db701c1f:platform.py` 的准备注册、主动拒绝早期设备内存查询、Worker 选择及配置拒绝分支；`worker/worker.py` 的显存测量与图捕获前激活峰值；`indexer_kpool_mla.py`、`kimi_kda.py` 的模型专用后端绑定。
- 三版：Ascend `2c59ff10 / 2ed6cbba / baa023ad`，上游 `0fc695fc / 568afb3a / 84030bbe`。main 的查询守卫与按硬件能力档案选 Worker 均逐段读取，未套到固定镜像。
- 联网读取官方 v0.23 Plugin System 和钉住 `0576b647` 的 GLM 教程；源码来自本机固定 Git 对象。audit 的 URL 检查本身不验证网络或结论语义。

### 独立审查与修订

独立审查者 `/root/platform_review` 对实际新旧正文、图 spec、固定提交及三版源码进行审查，未发现 P1 机制问题。

1. P2：启动图初稿的 tone、badge 和 link 字段不符合项目 schema，导致无法生成。修为 `danger`、`badges.n`，分支文字移到 texts；已生成 SVG，两图 `figureProblems=[]`，独立复核关闭。
2. P3：旧页到 NPUPlatform 的内链遗漏。已在首次命名处恢复，独立复核关闭。
3. P3：首段把 token 等同编号、未说明内存用途。改为基本单位用编号表示，补主机 CPU 与设备归属，独立复核关闭。

初学者文字复述通过：上游通过统一契约询问设备能力、校验配置和选择组件；模型计算交给后续组件，代价在兼容与初始化时序；查询失败的基础预算不是显存容量。

### 字数与密度

字数口径为去掉 frontmatter 后的 Markdown 字符数（含空白、标点、链接和源码区）：改前 1674，改后 6226。纯汉字计数分别为 926、3470。教学正文为“对照源码”以前，改后 3614 字符／2324 汉字；原页无源码区。

项目写作统计口径：教学正文 2339 字，行内代码 0／千字，正文证据角标 0，calc 0，无相邻表／calc；首图在第一个 H2 中，图前数字与 calc 均为 0。两图宽均 880px；源码区 H3 顺序正确；免责句匹配率 1.4%。页末角标 7 处，其中 C 级 5 处（71.4%），两个官方来源均实际用于相应结论。

### 验证记录

- 已运行 `pnpm.cmd wiki:audit`：131 页、本地来源行号全部有效，整体通过；本页 28 条源码来源与两条官方 URL 均可解析。raw 摘录并未因本次写作补齐，不能把 audit 通过当成摘录已核。
- 已运行 `pnpm.cmd wiki:diagrams --check`：163 张图与 spec 一致，通过。两张本页图还单独检查了边界与碰撞。
- 已运行 `pnpm.cmd check:content`：registry 131 页内容校验通过。
- 已运行 `pnpm.cmd wiki:lint`：本页无错误；当次全库剩 hardware-devices 的官方华为来源域名白名单问题，未修改他页或白名单。
- 在 `tmp/p5-platform/isolated-build` 对页面副本调用项目原有 `runBuild`：131 页、0 解析问题，目录与 registry 派生成功。共享派生物按分工不写回。
- 生产构建：`pnpm.cmd exec vite build --outDir tmp/p5-platform/dist` 成功，耗时 56.71 秒；产物只在临时目录。
- `pnpm.cmd check` 已通过 typecheck 和代码 lint，进入全量测试后出现两项失败，长时间无新输出后终止。另以 `pnpm.cmd exec vitest run src/content/wiki/index.test.ts scripts/wiki/params/scan.test.ts --maxWorkers 1` 定位：24 项中 22 通过、2 失败。`index.test.ts:20` 仍要求 Block Table 英文旧标题，而当前 block-table 标题已改；`scan.test.ts:95` 的 Python AST 示例在当前解释器下报 invalid syntax，要求 Python 3.11+。两项均不消费本次修改的页面或图，不修改范围外测试来制造通过。
- 单独运行 `pnpm.cmd check:deps` 通过；`check:content` 再次通过。全量测试没有最终通过结论。
- 浏览器使用成功生产构建的真实页面，Chromium 1440×1100，4176 端口。保存 screen-01 至 screen-06、figure-1、figure-2、sources 共 9 张截图；实际点击“部署启动”“NPUPlatform”“调用链页”，并展开 30 条来源。浏览器 pageerror 为 0，两图渲染数量为 2。预览验收阻断 API 请求，未访问 5193 或 8790；截图后关闭服务，确认 4176 无监听。
- 截图绝对目录：`C:/Users/-/AppData/Local/Temp/claude/C--Users---Desktop-infra-view-new/13898c74-f916-4e2c-8924-fe9bf130f160/scratchpad/p5/vllm-platform-interface/`。
- 独立审查者追加实际查看全部 6 屏、两张整图和来源展开截图：首屏定义与直觉图完整，前两屏能解释用途和代价，流程顺序与失败分支清楚，表格和来源可读；无新增 P1/P2/P3，前述三项全部关闭。
- 验收过程说明：开发服务的依赖预打包阻塞了页面读取，改用生产构建预览完成验收，未改应用代码。一次 PowerShell 重启命令被自动审批以“blocked by policy”拦截，随后通过已建立会话的 Ctrl+C 停止自建服务；最终预览在受控进程的 finally 中关闭。
- 检查日志和浏览器操作结果保存在 `tmp/p5-platform/`；`git diff --check` 对交付范围通过。

### 限制与待核

无 NPU 部署实测、无平台钩子耗时或主机／设备峰值实测；固定镜像内上游安装产物的对应关系仍待来源基线补证。没有发现本页独立算账错误；队列“无独立双机数”与新增上游默认基础档说明并不冲突。无须用户决定的问题。

## P5 审查（09-28）

审查人：独立审查子代理（只审不改页）。对象：工作区未提交的 `wiki/concepts/vllm-platform-interface.md`（183 行），以及两张图 `wiki/diagrams/platform-hooks.yaml`、`platform-startup-contract.yaml`。源码：`tools/repos/vllm` 的 HEAD 是 `0fc695fc6d`；`tools/repos/vllm-ascend` 用 `git show db701c1f:`、`git show baa023ad:` 读片段。

**分数：6 / 10**（核心机制都对；两处 P1 都是整页重写时丢的信息）

### 1. 初学者测试（只读 L53–L78）

我的一句话：「Platform 是 vLLM 上游定义的一组设备相关问题（设备属性、配置能否使用、选哪套执行实现），由当前硬件的平台实现回答，昇腾的实现是 NPUPlatform；代价是插件要跟着上游接口签名和调用时序一起改，而且查询失败会改变默认值的选法。」

能说清“是什么”和“代价”。H2 自己提的问题说不清：换一种设备，vLLM 怎样知道该用哪套实现？前两屏只说“由当前平台回答”。当前平台怎么被选出来，要到 L94 才提到，而且只给了一个链接。

### 2. 核心概念逐条核对

| 说法（页内位置） | 源码证据 | 判定 |
|---|---|---|
| Platform 约定设备属性、校验配置、选择实现（L55、L73） | `vllm@0fc695fc:vllm/platforms/interface.py` L105–141 类属性（device_name / device_type / dispatch_key / device_control_env_var / dist_backend / supported_quantization）；L260–267 `get_attn_backend_cls -> str`；L458–466 `check_and_update_config` 允许报错或原地修改配置 | 对 |
| 选后端时返回类路径，此时还不执行运算（L78、L103） | interface.py L260–267：返回类型是 `str`，基类返回 `""` | 对 |
| 通信后端交给平台 | 上游 CUDA：`cuda.py:168 dist_backend="nccl"`，L447 `get_device_communicator_cls`。Ascend@db701c1f：`NPUPlatform` **没有设** `dist_backend`；`"hccl"` 由 NPUWorker 在 `worker/worker.py:979` 写死；平台只返回 `NPUCommunicator`（`platform.py:870`） | 页面 L97 把 HCCL 归到 Worker，**对**；但正文没讲平台在通信上负责什么（见 P2-3） |
| Worker 类由平台选（L96） | `vllm-ascend@db701c1f:vllm_ascend/platform.py` L650–660：`worker_cls=="auto"` 时，310P 选 NPUWorker310，开 xlite 选 XliteWorker，其余选 `vllm_ascend.worker.worker.NPUWorker`；L662 调 `refresh_block_size` | 对 |
| vllm-ascend 提供 NPUPlatform（L61） | `platform.py:128 class NPUPlatform(Platform)`；`_enum=PlatformEnum.OOT`、`device_type="npu"`、`device_control_env_var="ASCEND_RT_VISIBLE_DEVICES"`、`dispatch_key="PrivateUse1"` | 对 |
| current_platform 按需解析，保存在当前进程（L86） | `vllm/platforms/__init__.py` L262–281：模块级 `__getattr__` 懒加载，第一次访问时调 `resolve_current_platform_cls_qualname()`，结果缓存在模块全局 `_current_platform` | 对，但没写解析规则（见 P1-1） |
| pre_register 打全局补丁、准备量化类型，在带 parser 的路径里补 `--quantization ascend`（L95） | 上游调用点：`arg_utils.py:1712`（create_engine_config 开头，不带 parser）和 `:2597`（带 parser）；Ascend 实现在 `platform.py` L184–200 | 对 |
| 配置钩子在配置构造后段调用，之后重算编译范围（L96、L101） | `config/vllm.py:1335` 是唯一调用点；L1342 调 `_set_compile_ranges()` | 对 |
| Worker 加载模型后，还有一次按后端更新块大小的调用（L101） | `multiproc_executor.py` 的顺序：init_device（约 L626）→ load_model（约 L634）→ L648 `update_block_size_for_backend`；Ascend 在 `platform.py:312` 覆盖了这个方法 | 对 |
| 查询失败时，在线服务的基础档是 2048（L67） | `arg_utils.py` L2305–2335：查询异常时 `device_memory=0`，走 else 分支，OPENAI_API_SERVER 为 2048、LLM_CLASS 为 8192；之后 L2492–2553 还会按 batched DP、throughput 模式、chunked prefill、max_model_len 调整 | 对 |
| 模型可以直接绑定专用后端（L109） | `ops/indexer_kpool_mla.py:136 get_attn_backend`；`ops/kimi_kda.py:232–233` 返回 `AscendGDNAttentionBackend` | 对 |
| 测显存的顺序；激活峰值在捕获图之前记录（L123） | `worker/worker.py` L563–571 在捕获图前取 torch 峰值，L719 调 `capture_model`；与底稿 01 §A0 第 6–9 步一致 | 对 |
| **“固定昇腾实现刻意拒绝早期设备总内存查询”（L121、L128）** | `db701c1f:platform.py` L275–281 是**无条件** `raise NotImplementedError`，不分早晚；按“设备是否已初始化”区分的是 main（`baa023ad:platform.py` L234–237） | 两个版本的行为写混了（见 P2-2） |

### 3. 数字

- 正文只有两个数字：2048（来自上游源码，已按上表核对）和“两台 A2、每台 8 卡”（与底稿 01 §A0 L54 一致）。页内没有自己推导的双机数字，符合“本页没有独立双机数字”的设定。
- 写手自报的疑点“2048/8192 是新加的解释”：已按 L2300–2335 核实，数字正确。
- 旧页写“混合模型的块大小按昇腾对齐算成 2048”，和底稿 01 L24 的 **640** 冲突。新版删掉这句属于纠错，不算丢信息。
- 旧页写“显存报得够大就换大一档”。在固定的 Ascend 镜像上，显存查询一定失败，这个分支永远走不到。新版改对了。

### 4. 丢信息核对（`git diff`，按旧版 H2 逐条对照）

| 旧版内容 | 新版情况 |
|---|---|
| 当前平台怎么选：内置的 tpu/cuda/rocm/xpu/cpu 和外部插件逐个探测；外部插件优先；两个外部插件或两个内置平台同时激活，都会抛 `RuntimeError: Only one platform plugin can be activated…`；一个都没激活时落到 `UnspecifiedPlatform`，不报错 | **丢失**（P1-1）。`platform-plugin-registration.md:56` 只保留了“外部插件优先”和“多个外部插件同时激活报冲突”。内置候选、内置平台冲突、Unspecified 兜底、报错原文，在全库概念页里都找不到了。来源清单里的 `__init__.py#L203-L252` 也被删了，只剩 L262–281 |
| 接口规模和演进：`Platform` 方法数 78→82；`current_platform.` 引用 873 行、311 个文件 → 1069 行、362 个文件 | **丢失**（P1-2）。我重新数过，旧数属实：0fc695fc 是 78 个方法、873 行、311 个文件；568afb3a 是 82 个方法、1069 行；main（84030bbe）是 84 个方法、1457 行 |
| 类属性“填空题”（设备名、可见设备环境变量、通信后端） | 正文里没有了，只在对照源码的“怎么开”里留了 OOT 和 npu（P2-3） |
| 五个时刻表 | 保留，拆进了启动图和步骤 1–4 |
| check_and_update_config 是唯一调用点，也是最后一次整体改写配置的时机 | 大意保留，“唯一”这个限定丢了（P3） |
| 平台对请求的三条影响：块大小、注意力实现、token 名额 | 块大小的数字已删（旧数本身是错的）；另外两条保留，且改正了 |
| 误解“检测到 CUDA 就一定走 CUDA” | 本页已删，但插件注册页有同义句，可以接受 |
| 误解“平台只在启动时起作用”（旧文：上游三百多个文件在引用） | 已删，归入 P1-2 |

### 5. 链接与锚点

- 出链：本页共 11 个，目标文件都存在。其中带锚点的 5 个（glm-5-3-flash-two-node 3 个、request-call-chain 2 个）都能找到对应标题：two-node 在 L49、L187、L245，call-chain 在 L156、L169。
- 入链：全库指向本页的有 device-memory L46 和 L159、matmul-and-weights L41、npu-platform L23 和 L33、token L48、index.md L45 和 L157、seeds/vllm-ascend-code.yaml L236。都不带锚点，都能解析。
- 格式：
  - 对照源码以上没有证据角标；正文行内代码 0 个；没有 calc。
  - 对照源码的五个 H3 都在，顺序正确：L135 怎么开、L147 会报什么错、L153 开销和什么时候别开、L157 版本差异、L171 源码位置。
  - 版本差异一节里，v0.23 出现 3 次，v0.26 出现 2 次，main 出现 3 次。

### 6. `pnpm wiki:audit`

退出码 0，结论为 `ok`：共 131 页，无效 commit、文件不存在、行号越界都是 0。本页 30 条来源：28 条源码来源全部 ✓；2 条 URL 未联网验证；raw 摘录都还没核对。这两项属于审计本身不覆盖的范围，不算本页的问题。

### 7. 问题清单

**P1-1 丢信息：current_platform 怎么解析，这一整块没了。**
- 位置：L86、L94；对照源码的“会报什么错”和“源码位置”；来源清单。
- 问题：
  - 本页 aliases 里有 `current_platform`，问答会落到这一页。但任务要核的“current_platform 怎么确定”，页内只剩一句“按需解析”。
  - 下面这些内容在全库都找不到了：内置候选有哪几家、内置平台冲突报错、`UnspecifiedPlatform` 兜底、报错原文、为什么要懒加载。懒加载的原因见 `__init__.py` L264–274 的注释：外部插件要先能 `import Platform` 基类。
- 改法：
  - 在 L86 后补一小段，写清选择顺序：
    1. 内置五家和外部插件各探测一次；
    2. 恰好一个外部插件激活，就用它；
    3. 没有外部插件激活时，再看内置平台；
    4. 两个以上同时激活，报错；
    5. 一个都没激活，用 UnspecifiedPlatform，不报错。
  - 在“会报什么错”里恢复两条：`Only one platform plugin can be activated, but got: [...]`，以及“没有平台激活时不报错”。
  - 来源清单恢复 `vllm@0fc695fc:vllm/platforms/__init__.py#L203-L252`。
  - 如果决定让插件注册页做单一出处，就把这些规则补到那一页，本页只留链接。两页中至少要有一页写全。

**P1-2 丢信息：接口规模和演进的量化证据没了。**
- 位置：“版本差异”表，L166 附近。
- 问题：旧表里的方法数和 `current_platform.` 引用数，被一句“相同契约”取代，读者会以为接口没有变化。
- 改法：
  - 表里加一行：`Platform` 类体方法数 78 / 82 / 84；`vllm/` 下含 `current_platform.` 的行数 873 / 1069 / 1457。
  - 统计口径：方法数是 `class Platform:` 到 `class UnspecifiedPlatform` 之间、缩进四个空格的 `def`；行数用 `git grep 'current_platform\.' -- 'vllm/*.py'` 统计。
  - main 的两个数是这次新测的，证据等级标 [D]。

**P2-1 直觉图既没画出“换一种设备”，又把契约画成了中转站。**
- 位置：`platform-hooks.yaml`，即 L57 的首图。
- 问题：
  - 图里只有一个“当前平台实现”，H2 问的“换一种设备”在图上看不出来。
  - 中间的“平台接口契约”画成了调用路上的一站。实际运行时，上游直接调 `current_platform.xxx()`；契约是基类定义，不是调用经过的一跳。
- 改法：
  - 左边：上游调用点，加 3 个具体问题（device_type？worker_cls？attention backend？）。
  - 右边：竖排两个实现，CUDA 平台和 NPUPlatform，各自写出答案：cuda / npu、`gpu_worker.Worker` / `NPUWorker`、CudaCommunicator / NPUCommunicator。
  - 中间：放一个 current_platform 选择器，高亮 NPUPlatform。
  - 契约改成一个虚线框，框住两个实现，标注“同一组方法”。

**P2-2 两个版本的行为写混了。**
- 位置：L121“固定昇腾实现刻意拒绝早期设备总内存查询”；L128“固定实现主动拒绝早期查询”。
- 问题：db701c1f 是无条件拒绝。“设备初始化后就能查”是 main（baa023ad L234）才有的行为。照现在的写法，读者会以为在固定镜像上晚一点查就能成功。
- 改法：改成“固定昇腾实现的设备总内存接口一律报不支持（注释：实现它会过早初始化 torch_npu）；main 起才允许在设备初始化后查询”。

**P2-3 正文没有写出平台具体回答了什么。**
- 位置：L55、L65、L73。
- 问题：
  - “设备属性”从头到尾是个抽象词。任务列出的“设备类型”“通信后端”，正文里一个实例都没有。
  - 读者也不知道：在 Ascend 上，HCCL 是 NPUWorker 写死的，平台负责的是设备通信器类。
- 改法：
  - 在 L65 或表格的 Platform 行加一句实例：NPUPlatform 回答的是设备类型 `npu`、可见设备变量 `ASCEND_RT_VISIBLE_DEVICES`、设备通信器 NPUCommunicator、自动选择的 Worker 是 NPUWorker。
  - 再注明：HCCL 这个后端名由 NPUWorker 在建通信组时指定（`worker.py:979`）。
  - 注意行内代码密度，可以写中文说明，只带一个代码名。

**P2-4 默认预算的回退逻辑在两页各推导了一遍，违反单一出处。**
- 位置：本页 L67、L121、L155、L166；`npu-platform.md` L57–L59。两页引用的都是 `arg_utils.py#L2300-L2335` 和 `#L2492-L2553`。
- 改法：只留一个出处。建议放在本页，因为这是上游行为；`npu-platform` 只写“Ascend 拒绝这次查询，后果见 Platform 页”并链接过来。反过来安排也可以，但推导只能保留一处。

**P2-5 GLM 双机一节落点太虚。**
- 位置：L80–L97、L67。
- 问题：
  - 官方双机教程显式设了 `max-num-batched-tokens 8192`（出处：one-request L594 [S2]），页内没提。所以 2048 这个回退值在本部署根本不生效。第二屏却把 2048 当“实际例子”，初学者容易以为 GLM 就按 2048 跑。
  - 底稿 01 §A0 第 6 步把 `--quantization ascend`（W8A8）直接挂在 pre_register（`platform.py#L190-L200`）上；本页 L95 讲了 pre_register，却没和这个部署参数接上。
- 改法：在 L82 或 L95 附近把这两点各补一句，并链到部署页。

**P3（顺手可改，不阻塞）**
1. L55 在定义句后面插了一段 token、编号、矩阵的科普，与 Platform 无关，打断了“定义 → 图”的节奏。建议删掉，或挪到 L107。
2. L65 把 vLLM 叫“请求排队框架”，不准确，建议改成“推理服务引擎”。
3. 术语先用后讲：“注意力实现”在 L65 就用了，L78 才解释；“插件”“上游”全页都没有定义。建议在首次出现时各补半句解释。
4. L96 可以恢复“这是上游唯一的调用点”。
5. `platform-startup-contract` 的第 5 个框没有编号 badge 5。
6. “注意力后端”：按 09-27 的英文术语规则，这是 vLLM 的固定组件名，建议写作 attention backend，首次出现时附中文解释。这一条要和 attention-backend-family 页一起统一，不要只改本页。

### 跳过的段落

- frontmatter 来源区 L9–L39，由 audit 校验。
- “对照源码”正文 L133–L183：没有通读，只用 grep 核对了 H3、版本名，以及 OOT、2048、8192、报错原文、`enable_balance_scheduling` 这几个关键词。
- 两处 `wiki-diagram` 代码块：只读了对应的 yaml spec。
- 没读 HANDBOOK、docs/plans、TERMS 全文。TERMS 只 grep 了术语。
- 没有读取被拦截。

## P5 修订记录（2026-09-28）

改页人：Opus 写手（只改 `wiki/concepts/vllm-platform-interface.md` 与它的两张图）。正文去空白字符数 13347 → 19470，`pnpm wiki:audit` 报 7 节、来源 37 条。

### P1

- **P1-1 补回 current_platform 的解析规则。** 新增 H2「当前平台是怎么选出来的？」：五个内置候选（tpu / cuda / rocm / xpu / cpu）与外部插件各探测一次，外部插件优先，同类两个及以上同时激活抛 `RuntimeError`，一个都没激活落到 `UnspecifiedPlatform` 不报错；懒加载的原因（外部插件要先 `import Platform`）与进程内缓存也写了。「会报什么错」恢复冲突报错原文与「无平台不报错」两条。来源清单恢复 `vllm@0fc695fc:vllm/platforms/__init__.py#L203-L252`（第 31 条）。对照的是 `0fc695fc` 的 `builtin_platform_plugins`、`resolve_current_platform_cls_qualname()` 与模块级 `__getattr__`。发现／过滤（entry point、`VLLM_PLUGINS`）仍归插件注册页，正文写明了两页的分界并链过去。
- **P1-2 补回接口规模数。** 「版本差异」表加两行：`Platform` 类体方法数 78 / 82 / 84，`vllm/` 下引用 `current_platform.` 的 873 行 311 文件 / 1069 行 362 文件 / 1457 行 478 文件，三列对应上游 `0fc695fc`、`568afb3a`、`84030bbe`，并写明统计口径（`class Platform:` 到 `class UnspecifiedPlatform` 之间缩进四格的 `def`；`git grep 'current_platform\.' -- 'vllm/*.py'`），标 [D]。本轮实测数与审查表一致。
- **P1-3（原 P2-2）版本混写。** 原第 121、128 行改成「固定昇腾实现的设备总内存接口一律报不支持，不分早晚」，注释理由照 `db701c1f` 写；「设备初始化后可查」只留在「版本差异」的 main 一列，正文加了「不能倒套到固定镜像」并链到该节。

### P2

- **直觉图重画**（`platform-hooks.yaml`，880×400）：左边是提问的一侧并列出三个具体问题（设备类型？自动选哪个 Worker 类？用哪个设备通信器类？），右边两列是 CUDA 平台与 NPUPlatform 的答案（cuda/npu、上游 GPU Worker/NPUWorker、CudaCommunicator/NPUCommunicator），中间是「当前平台」选择器且箭头指向高亮的 NPUPlatform；契约改成圈住两列的浅框，标「同一组方法：契约由基类定义」，图上点明「换一种设备只换右边这一列，上游的提问与调用代码不改」。按本库「讲解图不放代码名」的告警，图上不写 `current_platform`、`gpu_worker` 这类标识符。图下正文同步重写（原文描述的是旧图的上下行箭头）。
- **正文补属性实例**：第二屏加「填空题」一段，给出设备类型、可见设备环境变量、自动 Worker 类、设备通信器类两侧的实际答案，并写清 HCCL 后端名由 NPUWorker 在建通信组时给出（`db701c1f:vllm_ascend/worker/worker.py#L975-L988`），平台只交出通信器类（`platform.py#L866-L873`）。
- **预算回退单一出处**：推导留在 `npu-platform.md#默认预算为何不能只看一个数字`（该页已有专门 H2），本页第二屏、分账节、「开销和什么时候别开」三处的 2048/8192 推导全部删掉，只留链接；「版本差异」那一行也改为链接加版本差异本身。
- **GLM 落点写实**：新增 H3「本部署里 NPUPlatform 具体回答了哪几件事」，七行表逐项写出本部署得到的答案（设备类型 npu 与算子分派键、`ASCEND_RT_VISIBLE_DEVICES`、含昇腾量化名对应 `--quantization ascend`、常规 A2 选 NPUWorker、NPUCommunicator、设备总内存报不支持、注意力后端类路径），并写明平台不回答的部分；启动步骤 2 把 `--quantization ascend` 与 pre_register 接上（底稿 01 §A0 第 6 步、`platform.py#L190-L200`），表后指出官方命令显式给了每步 8192 token，所以回退档在本部署不生效（数字取自 `wiki/sources/glm-5-3-flash-baseline.md` L126）。
- 顺手补了 `platform-startup-contract.yaml` 缺的第 5 个编号 badge（原 P3-5）。

### 新增来源（第 31–37 条，全部经 audit 校验行号）

`vllm@0fc695fc:vllm/platforms/__init__.py#L203-L252`、`vllm/platforms/cuda.py#L162-L170`、`#L228-L236`、`#L445-L452`、`vllm-ascend@db701c1f:vllm_ascend/platform.py#L866-L873`、`vllm_ascend/worker/worker.py#L975-L988`、`vllm@84030bbe:vllm/platforms/__init__.py#L231-L258`。

### 验证

- `pnpm wiki:lint`：本页 0 条（唯一 hard failure 是既有的 `concepts/hardware-devices.md [source-domain]`，与本页无关）。
- `pnpm wiki:diagrams`：两张图重新生成，`--check` 通过；本页两张图无告警（`platform-startup-contract` 的「就绪后 → A1…」整句告警是既有文本）。
- `pnpm wiki:audit`：退出 0，本页 37 条来源行号全部 ✓；写作标准 ✓行内代码 3.5/千字 ·✓角标 0 ·✓对照源码 ·✓calc 0 ·✓相邻块 0 ·✓图先行 ·✓免责 1.1% ·✓图宽。
- 未做浏览器验收（按写页分工留给审查环节）。

### 未处理

- P3-1（第一屏的 token／矩阵科普）、P3-2（「请求排队框架」已顺手改成「推理服务引擎」）、P3-3（术语先用后讲）、P3-4（「唯一调用点」）、P3-6（attention backend 术语全库统一）中，除 P3-2 外均未改；P3-6 需要与 `attention-backend-family.md` 一起动，不在本页范围。
- 一次 `git show` 的源码片段输出被安全分类器拦下，`db701c1f` 的 `get_device_total_memory` 注释按审查记录与已取得的片段转述，没有再次拉取原文。

## P5 复审（09-28）

复审人：Opus 独立审查子代理，只核上一轮 P1/P2 是否落实，未改页面。页面行号按本轮实际文件。

### 逐条结论

1. **P1-1 当前平台的解析规则 —— 落实。** 新增 H2 在页面 L89–L102。四点逐条核过上游 `0fc695fc:vllm/platforms/__init__.py`（本机源码树 `tools/repos/vllm`，`git grep` + 分段读 L203–L252、L255–L282）：
   - 五个内置候选 tpu/cuda/rocm/xpu/cpu —— 与 L203–L209 的候选表逐名一致（页面 L91）。
   - 外部插件优先 —— 源码 L230–L245 的分支顺序是先判外部插件再判内置，外部恰好一个时内置不参与；页面 L95 写法正确。
   - 同类冲突抛 `RuntimeError` —— 源码 L230、L238 各一处（外部之间、内置之间各判一次），页面 L97 与之对应。
   - 一个都没激活落 `UnspecifiedPlatform` 且不报错 —— 源码 L249–L251 只写 debug 日志；`interface.py#L1055-L1057` 的 `UnspecifiedPlatform` 设 `device_type = ""`，页面 L98「回答都是空的或不支持」成立。
   - 附带核对：懒加载理由（外部插件要先继承基类，故不能在导入时解析）与模块级缓存，与 `__getattr__` 注释及 `_current_platform` 缓存一致（页面 L100）。发现／过滤分界指向插件注册页，该页确有 H2「发现、过滤、激活」，锚点有效。
2. **接口规模数的口径 —— 落实。** 表在 L205–L214，口径与三列对应关系写在紧随的 L216：方法数口径为 `class Platform:` 到 `class UnspecifiedPlatform` 之间缩进四格的 `def`，引用数口径为 `git grep 'current_platform\.' -- 'vllm/*.py'` 的行数与文件数，三列分别对应 `0fc695fc`／`568afb3a`／`84030bbe`，并标了 [D]。本轮按同一口径独立重数，三组数字全部复现：78/82/84，873 行 311 文件、1069 行 362 文件、1457 行 478 文件。
3. **设备总内存接口的版本分写 —— 落实。** 固定版本一律不支持写在 L134（GLM 落点表）、L161（分账节）、L191（会报什么错），main 的「初始化后可查」只出现在 L209 的 main 一列与 L191 明确标 main 的那半句；L161、L218 都写了不能倒套到固定镜像。原 L121／L128 位置（现 L134、L161 一带）无残留混写。源码侧核过：`db701c1f` 与两个社区钉点（`2c59ff10`、`2ed6cbba`）都是无条件抛 `NotImplementedError`；`baa023ad` 才加未初始化守卫，页面 L191 引的那句错误信息与 main 原文逐字一致。
4. **首屏直觉图 —— 落实。** `wiki/diagrams/platform-hooks.yaml`：`size: [880, 400]`，宽 880 ≤ 900，audit 的「图宽」项本页 ✓。图面结构确实表达了要求：左列三个具体提问，右侧 CUDA 与 NPU 两列同构答案，NPU 列整列 `style: solid` 高亮且选择器箭头终点落在 NPU 列内，另有两行文字「换一种设备只换右边这一列 / 上游的提问与调用代码不改」。三个提问的 y 与两列答案的三行 band 逐行对齐。`pnpm wiki:diagrams --check` 退出 0，本图 0 条告警（告警只出现在 `vllm-ascend-repo-map`、`vllm-v1-shape` 两张既有图上）。P3 级观察（不阻塞）：浅框 `[24,150]` 宽 832 把左边的提问列也圈进去了，与修订记录里「圈住两列」的自述不完全一致；正文把浅框解释成「同一组方法」，语义仍自洽。
5. **预算回退单一出处 —— 落实。** 本页正文已无 `2048`；`8192` 只在 L137 作为官方启动命令的既成事实出现，不是推导。L161、L199、L210 三处都改成指向 `npu-platform.md#默认预算为何不能只看一个数字` 的链接。该页 H2 在 L55，推导正文在 L57–L59（捕获异常走回退基础档，且基础档不是最终预算），出处确实在那边。`arg_utils` 在本页只剩 frontmatter 的来源条目，正文不再推导。

### audit

`pnpm wiki:audit` 退出码 0，总结行为通过。本页块：37 条来源中 35 条本地行号 ✓、0 条 ✗，另 2 条为 URL 类来源不做行号校验；写作标准全项 ✓（行内代码 3.5/千字 · 角标 0 · 对照源码 · calc 0 · 相邻块 0 · 图先行 · 免责 1.1% · 图宽）。本页 0 条告警。附带的 `[raw 未定位同版本完整引用，摘录尚未验证]` 是全库通例标注，不是本页新增问题。

### 分数

**8.5 / 10。** 五条 P1/P2 全部落实，且关键数字与源码行为都独立复现；扣分在上一轮自报未处理的 P3（首屏 token／矩阵科普、术语先用后讲、「唯一调用点」、attention backend 全库统一）仍在，以及本轮未做浏览器实测（不在本次快速复审范围）。

### 新的 P1/P2

无。仅有上面第 4 条的 P3 级浅框范围观察，可在下次改图时顺手收。

### 本轮跳过

frontmatter 的 sources 来源清单区（L1–L58 内的 URL／来源行）、代码块与命令块、`wiki/TERMS.md`、HANDBOOK 与 docs/plans/、`npu-platform.md` 除 L55–L59 外的正文、生成的 svg。源码只按 grep 行号读附近片段；一次列 `platform.py` 属性的 grep 输出被安全分类器拦下，GLM 落点表（L129–L135）里设备环境变量、分派键、Worker 分支、通信器类这四项因此未逐项复核，其余各项均有本轮证据。
