# UCM 官方覆盖增量：独立审查

审查者：`groups_ucm_review`。日期：2026-11-10。按 `docs/wiki-writing-standard.md` 审查新增教学内容、实际图、与冻结版本的差异及固定证据。本次为纯教学/事实核对，未修改教学正文、图或产品代码。

基准是 `ucm-reviewed-73.zip` 和已完成的 `ucm-review.md`。本报告只记录之后的增量，不改写原73项批次的结论或把增量重复记作旧37项工作。最终范围为来源74–98：25项引用、24个不同版本文件，以及新增EC图、算例、诊断工具表、Helm部署和计算器适用范围。内容独审与工程检查已闭合，本批没有未关闭P1/P2；这不代表全站或全部官方资料已核完。

## EC 部分：来源 74–80

完整阅读固定外部 UCM `4b9acbc8dede919ae17b14c3a23903e89623d5e8` 的 EC 使用指南 184 行、设计文档 577 行、实现 867 行和配置示例 22 行。三个提取文件与 `git show` 原始文件 SHA256 一致；查看了官方 `ec-connector-sequence.png` 实际图像，没有只读替代文本。另核 vLLM `568afb3a` 与 `ced6857a` 的宽度解析函数，以及旧 `0fc695fc` 的 EC 目录。

### 问题与修订

| 级别 | 问题、影响及原始证据 | 修订与复审 |
|---|---|---|
| P2-EC1 | 原文“等待全部加载结束，再发布编码结果”容易理解为全批加载原子发布。实现 `ucm_ec_connector.py:657–663` 是逐项等待成功后立即发布该项 view，其余任务可能仍在等待。 | 改为逐项完整加载成功后发布，本次函数排空已提交任务后返回，任一失败抛错。已读最终正文并实际浏览器复看，关闭。 |
| P2-EC2 | 只写保存可后台进行、任务结束才释放，遗漏每一步收尾的等待，容易套用普通 KV 的“前向可返回而保存仍在途”。源码 `_wait_pending_saves/get_finished/shutdown` 每步末和关闭时均逐个 wait。 | 补足每步收尾和关闭都等在途保存结束，异步提交不省去收尾等待；实际浏览器已复看，关闭。 |
| P2-EC3 | 新图围栏只写裸 `ucm-encoder-chunks`，页面显示代码文本。实际截图和 `scripts/wiki/diagrams.ts:333–335` 的 `file:` 解析规则一致。 | 改为 `file: ucm-encoder-chunks`；最终浏览器显示完整图，关闭。此问题是正文引用语法错误，不是服务缓存问题。 |
| P2-EC4 | 版本段只说四版未实测，遗漏已能静态判断的旧版不兼容。外部实现无条件导入 `ec_connector.cpu.common._get_encoder_cache_hidden_dim`，旧 vLLM `0fc695fc` 根本没有这个模块。 | 明确 v0.23 未回移依赖不能直接使用该实现；v0.26/rc2 配套上游有 helper 仍不等于整套/NPU验收；Ascend main 须另固定配套上游。补 79、80 项证据，复读关闭。 |
| P3-EC5 | 图注“底层存储”容易让读者混淆张量 storage 与外部文件存储。 | 改为“底层张量分配”，实际图注复看，关闭。 |
| P3-EC6 | EC 之后的通用验证 H2 没限定普通 KV，且 EC 段指称“前面”的重启步骤实际在后面。 | H2 明确普通 KV；EC 回链页末自己的配置/本地重置入口。新版正文与浏览器顺序一致，关闭。 |

### 逐项证据和机制

| 来源 | 阅读范围 | 核对结果 |
|---|---|---|
| 74 | EC 使用指南全文 | 独立 EC 入口/YAML、示例128行/32GiB、同引擎两轮复用、三个本地缓存重置、prefix reset JSON success 检查、实际 load 日志与输出联合验证均对应。文档 128GiB 旧默认未照抄为统一默认。 |
| 75 | EC 设计全文及实际时序图 | 整项媒体命中、固定行分块、补齐/view、单写入 rank、各参与 rank 完整加载、步骤末排空、fatal load 与 best-effort save 范围对应。未来异步加载/失败自动重算没有写成已实现。 |
| 76 | 实现 L1–333；并完整读至文件末 | 模型与媒体配置、deepstack、width/dtype/chunk/N/index 键；默认握手 UUID 加 DP 域；显式 store_unique_id 共享域；强制共享缓冲后先 configure_cache_capacity，旧未版本化分支才补128。 |
| 77 | 实现 L335–866；并读相邻空行/结尾 | producer/head gating、pruning拒绝、完整item查询、最终调度过滤、逐项加载发布、加载失败排空后抛错、保存引用和尾块持有、错误捕获范围与实际代码一致。 |
| 78 | 22行 EC 配置全文 | 单个 `ucm_ec_connector`、Cache/Posix、chunk_size=128、budget=32，是示例而非统一推荐。 |
| 79 | vLLM@568afb3a common.py L38–61 | 有宽度解析：显式 deepstack 拼接条件满足才扩展宽度，否则用输入嵌入宽度，未用语言宽度一概推算。 |
| 80 | vLLM@ced6857a common.py L69–92 | 与79同一核心解析规则；文件存在不替代完整运行组合验证。 |

特别核对了以下易错边界：

- EC 存储编码后的矩阵；本页此前 KV 存储 attention 历史，两者配置和预算分开。整项媒体缺一块是 cache miss，不能按命中块比例少做部分编码。
- 加载先分配补齐矩阵，返回短 view 仍持有整个分配。示意 5行×2数×2B=20B，3块×2行×2数×2B=24B，尾部补齐4B；这是逻辑张量容量，不是文件后端对齐后的大小。
- 加载失败为引擎错误，无自动重新编码；成功项可以先发布，但函数仍排空所有已提交任务后返回/抛错。没有宣称全批回滚或不完整项可见。
- 单个 DP 域内 PP 入口/TP0/PCP0 保存；参与加载的 rank 自己加载完整 EC。保存持有源张量、尾块及事件依赖，每步收尾与关闭等待。
- 保存取源张量、验证布局和构造键位于 try 外，错误会传播；块地址、padding、事件、dump 提交和在途 wait 的异常处理范围另讲，未把所有写错都说成不影响引擎。
- `store_unique_id` 默认包含本次启动 UUID 与 DP 号，重启或换 DP 不能自动命中旧域；稳定共享域和模型/布局身份是两个条件。
- EC 强制 share_buffer 后调用实际预算函数，核心1/至少2默认160进入拆分；仅旧未版本化缺省路径补128。两种连接器同时开时预算和目录独立。
- EC 前置依赖按源码静态区分，未知硬件结果继续保留，不以“未实测”掩盖已知导入不兼容。

## 工具部分：来源 81–88

这 8 份固定文档已全文读完：Trace 149行、Toolkit index 99行、precheck 98行、posix-aio 132行、metrics-view 137行、nic-monitor 124行、dev-sandbox user 159行、AISBench 157行。还补读 dev-sandbox developer 的构建/CPU fallback 部分，以核对模拟后端的边界；该补读不计作该文全文完成。

| 来源 | 核对重点 | 结果 |
|---|---|---|
| 81 | use_lite 不做真实 KV dump/load，也不减少推理计算；UCMTraceMeta拓扑、输出长度为request.max_tokens | 教学段成立；模拟命中机会不当成真实带宽/加速。 |
| 82 | 工具独立安装、toolkit extra 不选择设备后端、五类CLI与依赖 | 教学段成立；未把所有工具当纯Python/任意平台可跑。 |
| 83 | 512GiB、8GB/s是可调预检阈值；缺 native 会跳过并 warning | 解释成立；不当成任意模型最低容量或硬件验收。 |
| 84 | Store I/O与TTFT区分、支持GQA/MLA/DSA、模型推导拒绝混合/Mamba/DeepSeekV4 | 解释成立；未套到 GLM 混合状态。 |
| 85 | check快照与持续采集、实例标签、TP参数段 | 发现官方参数段与固定内置配置矛盾，见下文；不能直接复制旧参数。 |
| 86 | 物理网卡全部流量、NIC/服务指标联合归因 | 解释成立；未把网卡吞吐都记作UCM读写。 |
| 87 | 独立copy/trans/aio、后端依赖、单段带宽 | 解释成立；单段带宽不换算为整请求TTFT，CPU模拟结果不替代NPU。 |
| 88 | 预填与正式请求、构造hit_rate语义、本地/外部实测命中、性能与精度两条验证 | 解释成立；构造比例不冒充实际命中，性能正常返回不当精度验收。 |

### metrics-view 的官方说明冲突

初读指南时曾建议补 `--config-param tp_size=<实际TP>`。随后按固定实现和 selected preset 核对，**撤回这一站点缺陷判断**：不能因为官方指南这样写就要求本站复制一个无效参数。

- 已读固定 `terminal_view_metrics/config.py` 完整参数覆盖逻辑和 `metrics_lite.json` 全文；核四个内置 preset 的 JSON 参数与表达式。
- `metrics_lite/connector/store/vllm` 均没有 `params` 声明，也没有 `tp_size` 字符串。`apply_config_param_overrides` 对未声明的 key 直接 ValueError。
- 提取固定文件中的真实函数 AST，以四个实际 JSON 逐个传入 `tp_size=8`，四次均为 `Config parameter not found: tp_size`。这是参数函数的窄范围实际复现，没有假称运行完整 Toolkit 或硬件测试。证据：`.tmp/continuation-groups-2026-11-10/review-ucm-metrics-param.json`。
- CLI 的 check/query 都直接执行 load_config 后 apply_config_param_overrides，没有自动为 preset 注入 TP 参数。
- metrics_lite 还包含 used/capacity/usage 等 gauge；“单次快照是进程累计值”应限定累计计数，不能覆盖当前容量 gauge。写手已区分 Counter/Gauge，并以89–92项支持实际公式及参数边界，复核关闭。

### 来源 89–92：指标解释补证

| 来源 | 阅读/核对范围 | 结论 |
|---|---|---|
| 89 | 固定 metrics-reference 全文463行 | GB/s而非Gb/s、单任务直方图与系统吞吐、KV客户端秒/UCM多数毫秒、提交字节/完成字节、多层重复计数、Posix错误/中止仍计名义任务字节均有明确出处。没有把命中token、block、shard或请求数混除。 |
| 90 | config.py完整文件，来源标注L15–68 | load_config与override确实不创建未声明参数；CLI check/query均直接采用该逻辑。 |
| 91 | metrics_lite.json全文与结构 | 没有params/tp_size；存在当前容量Gauge，Counter窗口和分层公式按实际表达式解释。 |
| 92 | vllm.json完整JSON结构及所有参数声明/表达式字符串 | 没有params/tp_size；结合其余两个内置JSON的同样检查及真实函数复现，支持“四预设拒绝该参数”。本项没有宣称把417行中的每个PromQL公式都另做数值验算。 |

五个工具已补固定指南直链。新增工具表、参数冲突段、指标单位段及EC版本段均在浏览器实际查看；文字与命令换行正常，无横向溢出。Trace、Toolkit、五工具、完整指标参考、AISBench共9个外链逐一实际点击，均进入对应固定GitHub文档并取得正确标题。完整成功结果在 `review-ucm-tools-browser/report.json`，截图同目录。首轮链接跳转耗时较长但最终完整成功；之后一次多余的重复检查被主动中止，不将中止当作产品失败。

## Helm 部署：来源 93–96

独立全文阅读部署指南279行、扩容指南408行、Ascend Qwen3-0.6B多节点2P2D模板200行、共享values337行；另全文读Chart README307行、entrypoint-common96行，并核modelserving模板的托管参数、Pod资源、HTTP探针、服务组/role副本及entry/worker生成范围。未将必要范围核读称为整份modelserving代码审查。官方Helm架构SVG实际图像已查看；它画的是普通headless worker形态，正文另按94/95补足hybrid模式，未把图中形态套到所有模板。

| 来源 | 核对结果 |
|---|---|
| 93 | kthena控制器/CRD、PD路由器、驱动与设备插件是前置依赖；Ascend显式镜像、挂载/主机网络IPC/端口条件正确。PD须访问已有router网关，引擎Service不能作为PD客户端入口。Mooncake/UCM与NIXL/UCM组合限制仅归属Chart。 |
| 94 | 服务组、role逻辑实例与额外worker三层副本口径清楚；每组按各role的replicas×(1+workerReplicas)相加。standard entry HTTP/headless worker与hybrid两端HTTP有明确区别；D扩容不会增加该Chart路径的UCM读方。 |
| 95 | P/D各2实例，每实例1额外worker，因此8引擎Pod；每Pod申请1个NPU资源，DP2、本地DP1、TP1、PP1和hybrid均直接对应模板。没有把NPU资源数等同节点数或把worker存在当PP已开。 |
| 96 | 默认hostNetwork/hostIPC/8000、托管参数、UCM启用与镜像补丁env独立等边界对应。UCM关闭仍保留PD传输，缓存挂载和普通extraStorage分别处理。 |

P3-HELM1：原“模型和缓存卷可读写”把模型权重卷也误要求可写；官方示例允许模型readOnly。作者改为“模型卷可读、缓存卷可读写”，最终实际浏览器截图确认，关闭。

浏览器实际查看整个Kubernetes小节、8Pod calc和源码部署两段；计数、段落和命令换行可读。实际点击Helm指南进入固定commit的正确GitHub文档，`pageerror=[]`、无横向溢出。证据：`review-ucm-helm-browser/report.json`及两张截图。未运行Helm安装、kthena集群或NPU服务，也未把模板静态推导当部署实测。

## 容量计算器：来源 97–98

97母页全文17行，98固定`calculator.js`的L963–1396完整读取；另读完整HTML301行及GLM预设对应字段，未宣称通读2407行JS或验收其他模型全部路径。源码按完整hash块向下取整、GLM三个mamba组、MTP开关和最大长度保留`2×组数`滚动状态，与本站说明一致。

独立实际打开固定本地HTML，选择GLM-5.3-Flash、Ascend、TP8、MTP开、4096 token、chunk8192，再点KV计算与42GiB Max Tokens。结果为71.72MiB HBM估算、239.06MiB Dump估算；保存明细确实将`floor(4096/640)=6`显示成`⌈4096/640⌉=6`。最大长度显示3,449,600，公式扣1个空块及3×2个递推状态块。本站没有复制这些数作为实际部署容量，而是解释哈希完整块、滚动状态和缺少草稿token参数的假设，再回链唯一部署预算。该范围说明成立。

本站计算器段落在浏览器实际查看，外链实际打开到“KV Cache Calculator - Unified Cache Manager”。三张截图已逐张查看，`pageerror=[]`、本站无横向溢出；证据：`review-ucm-calculator-browser/report.json`。该操作复现计算器公式与标签，不是NPU容量或搬运量测试，也不证明所有模型公式正确。

## 保留与浏览器证据

与 `ucm-reviewed-73.zip` 的实际差异中，原教学解释、数字、例子、待核与来源1–73均保留。原三组 YAML/SVG 字节未变；唯一替换的旧文本行是普通 KV 验证 H2，为限定范围更名，其段落原文保留。新内容为插入，未以压缩旧解释换取覆盖范围。25项新增引用均通过实际`git show`固定版本、路径与行号检查。逐项差异和校验结果记录在 `review-ucm-coverage-final.diff`、`review-ucm-coverage-preservation.json`、`review-ucm-coverage-sources.json`。

EC 浏览器使用 5201、1440×1100 viewport：新增图与算例实际渲染且已逐张查看；图的5行、三块、补零与输出5行相符，20/24/4B算例无排版问题，配置/失败段可读。新“预算拆分”、固定EC示例、EC使用指南均实际点击，后两者打开固定GitHub页面且标题正确。`pageerror=[]`，无横向溢出。截图和结果在 `.tmp/continuation-groups-2026-11-10/ucm-coverage-browser/`。

最终98项状态又实际复看前两屏和EC图：能复述UCM把已算前缀放到主机/外部存储以省prefill，代价是取回等待以及保存占用主机内存、存储和带宽；未将省prefill说成省掉decode计算。页面共4张图、4个calc、8个表；旧图表字节/正文保留，新图、表和两个新增calc已在上述浏览器各段实际阅读。最终`pageerror=[]`、无横向溢出，证据在`review-ucm-final-browser/`。

## 工程检查与冻结

本轮检查发现新增`encoder cache` alias与PD页重复，已即时通知作者。作者只去掉本批该重复alias，保留`UCMECConnector`和“多模态编码缓存”；最终lint通过，该工程阻塞关闭。

独审读取了作者最终日志和`ucm-coverage-verification.json`：

| 命令 | 最终结果 |
|---|---|
| `pnpm check:content` | exit 0，164页、11个主章节内容校验通过。 |
| `pnpm wiki:lint` | exit 0，另有9项既有非阻塞提示。共享工作区原V2阻塞已由其他工作消失，不计本批功劳。 |
| `pnpm wiki:audit` | exit 0，164页、本地行号/文件与104项名单写作标准通过；全站463条URL未联网验证、3077条raw待核，不能据此宣称全站语义闭合。 |
| `pnpm wiki:diagrams --check` | exit 0，340张SVG与spec一致；仍有其他图的教学提示，不把一致性等同教学全站通过。 |
| `pnpm build` | exit 0，`tsc -b && vite build`通过。 |

上述日志为本轮`ucm-coverage-*.log`，未继承前批结果。没有运行NPU、真实Store、媒体推理、集群部署或所有计算器预设，没有把源码推导和浏览器操作当设备验收。

最终页SHA256：`b97dbddee04264262b0c6b4954446df9ccd17c0e1436d0e1ae47a4ed3cba1463`。新图YAML：`92714227d317a72d59901b9c2b0719aa7104025700dc5a7486d3d2f136f8bcf6`；SVG：`1abc257309c0f8fd2c2df5b5e262ae68b3025200406293391ddc194efe1386e3`。最终快照另存`.tmp/continuation-groups-2026-11-10/ucm-reviewed-98.zip`，包含当前页面、四组图、本增量报告与校验材料；`ucm-reviewed-73.zip`和原73项报告保持不动。
