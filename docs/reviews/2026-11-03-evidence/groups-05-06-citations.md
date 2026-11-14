# 第 05／06 组逐项来源语义核验

本阶段独立于上一轮正文阅读与行号存在性检查。清单初始为 73 页、2081 项 sources；JSON 中 `verdict: null` 表示尚未判定，不算完成。阅读原始源码、官方材料后逐条人工填写，历史扫描行与 raw 归档不默认当作当前事实支持。页面哈希用于识别并发改动。

当前账本累计判定 **2162/2345 项来源、69/73 页**，**183 项仍未判定**。其中 1 项知乎原文无法取得，保留 `unavailable_full_text`，不算已读或支持；68 页只表示每项已有判定，不等于全部事实都支持。新增范围与修正后的来源使总数高于初始 2081。具体逐项状态以 JSON 为准，下面旧批次数字是当时检查点。官方全文扩展单独记录于 official-05-06.json；文本阅读不冒称图片视觉验收或设备验证。

root 完成的 low-precision-formats 32 项与 kv-cache-quantization 48 项已按当前 sources 精确匹配后汇入，保留作者及逐项判定。两页增量均经本代理独立读取差异与相关固定代码后接受，低精度另实际查看白皮书第 17–20 页；KV 量化的相邻分支遗漏和显式更大块前提已关闭。batch-invariance 最后一处性能意图改写已获 root 独立接受。

LoRA 原 40 项与 8 项补证已经逐项判定，其中最新指南快路概括为部分支持，实际 capture、布局、宽输出门槛与回退由代码补齐。其余整改包括混批与合并权重的区别、旧 MoE/logits 的直接 BGMV、正常调度等待与底层报错、配置最大秩的预分配以及 EP 组为 1 的例外。原数值演算、GLM 权重子账和硬件未验边界保留；精确 diff 与逐项记录见 lora-citation-*，root 独审已接受，匹配不到图且不允许 NONE 时的断言条件也已补齐。

attention-backend-family 原 45 项与 17 项补证已逐项判定。两篇 FlashAttention 论文实际阅读正文、附录、表格、图注与算法文本，FA3 另读 SASS 列表；未声称读取图像或参考文献条目。主要修正旧 GLM 与 main/rc2 后端选路、indexer 与 attention/cache 的角色、FA3 双开关与拒绝顺序、KDA 单份状态和分配份数的区别；原 MFLOP 与层数示例保留。官方 FA3 指南的包是否开源存在内部冲突，来源 34 保留部分支持。该页增量待 root 独审。

correctness 与 multistream 增量已经 root 实际独立复核接受，分别见 correctness-citation-independent.md、multistream-citation-independent.md；不表示由 root 重新验收全部旧来源。batch-invariance 最后一句性能意图已改为注册入口事实，等待最终签收。

batch-invariance 的 29 原项与 9 补证均已逐项判定。已读旧指南 147 行、main 指南 228 行（rc2 同文）、完整历史初始化与两次版本差异、完整 Triton 矩阵乘 441 行及 softmax、相关测试的实际提取与断言范围。整改覆盖 GPU 注释泛化、请求列表与真实执行批、文本与 token/logprob/logits 证明力、安装后补装、块大小来源、门禁缓存与直接调用、删除旧融合功能与删除禁用赋值的关系。保留原数学与 GLM 场景；float32 例在 CPU 重算为 0 和 1。三文件精确 diff 已存，图静态 331 张一致，增量待独立复核，无 UI/NPU。

multistream_overlap_gate 原 32 项加 5 项补证已逐项判定。纠正初始化日志与实际重叠、流数与独立显存池数、各流上的实际量化与收集步骤、无依据的收益保证，以及 310P 新 runner 与 legacy 前向的范围混淆。图保留布局，只同步语义并定向生成；静态检查本页无溢出，检查时其他 agent 的 Dyntra 图尚未生成，故当次全图命令未通过。详细范围与未核部分见 multistream-citation-findings.md；精确 diff 等待独立复核。

profiling_chunk_config 原 44 项加 13 项补证已逐项判定。两份固定指南全文、main predictor 全文、校准 patch 全文与旧分支差异、实际 Worker/RPC/rc2 异步消费者均读取。P2 修正包括预测 None 的停止分支、PP 计时返回 rank、校准结束条件、两端同步、PD 推荐与硬门槛的区别、输出一致性与显存/性能的过度保证；rc2 历史模型从 b(C+H) 改为 bC 并使用非负最小二乘。原算例和官方性能数字保留适用范围。正文/YAML/SVG 差异为 profiling-chunk-citation-remediation.diff，另仅更新概念页一个失效回链；图 spec331 一致，首次 lint 指出旧锚点，已手修待重跑。增量尚待独立复核。

Sleep Mode 原 37 项与新增 rc2 默认值共 38 项逐条判定，两图完整 YAML 与固定控制/分配器证据已静态核对。30 段 raw 全部逐块等于另行实读原文；HTTP 参数、调度恢复、旧 KV 丢弃、两级内存示意均有相应原始范围支持。手改只补 rc2 默认值、扩完整锚点恢复范围和整理来源说明，diff 为 sleep-mode-citation-remediation.diff。融合 offload 两页与 extra-cleanup 三文件增量现已独立接受，分别见 fused-overlap-increment-independent、sleep-cleanup-increment-independent 报告；P1/P2 修正获接受，不等于各页全量旧来源被独立代理重复核验。

extra-cleanup 参数页原 46 项加 6 项已逐项判定，原始 manager 全文及分配器/worker/图清理/配置实际分支已读。P2 包括旧版命令遗漏 NZ=0、误称唤醒恢复旧 KV、图遗漏 tags=None、无状态标签门控被描述成“只捕获一次”、把整卡空闲差当精确释放归因。另读 PR #9585 全文发现旧文“没有公开实测数”不成立，现保留作者报告的两组 GB 数字，并明确缺完整模型硬件条件、包含 rotary 清理、不是本项目实测。正文/YAML/SVG 精确 diff 已落盘；单图定向重生成后 331 图静态一致。增量等待独立复核，无浏览器或 NPU 验收。

新增 fused_op_type 36 项、use_fused_overlap 56 项，已读原始配置、Python 执行者及本页引文。发现 overlap 首屏“不搬 KV”属于 P1：原生 README 明确 miss 仍 H2D 写入 Selection KV Cache，arch22 流水与缓存写回代码也已实际读取，正文改为按依赖交错搬运与计算。另修正配置读取时机、Omni 未知顶层键例外、TP 主机池共享并非此开关新建，以及额外选择状态与捕获容量限制。fused_op_type 修正“四阶段变两阶段”不能精确推出少两次 kernel 启动，补 rc2 原生构建/注册 DRAM 适配前提和 disabled 仍先校验。两份精确 diff 已送 review_first_pages 独立复核；收到结论前保留 P1/P2 待验收。无图变更、无 UI/NPU/部署验证。

最新两页增量：combine_quant_mode 原 33 项加 5 项，C8 reshape 原 34 项加 12 项均已逐项填写。两份 `*-citation-remediation.diff` 比较各自本轮修改前快照，不覆盖已有并发修改。主要修正融合路径不读取配置与“保证成功”的区别、配置 refresh、实际通信载荷边界、C8 整批 scatter／同块连续分组、PCP/TP 缓冲容量与新版 kpool 排除条件。均已送主任务独立复核，尚未收到本批验收，不标已关闭。C8 的小例为 Python 翻译规则核算，不是算子执行；未 UI/NPU/部署验证。

## 已发现的问题

- **P3，引用范围未覆盖完整论证（待主任务统一处理）。** `replica-search-num-stages` 的来源 8（旧 stair.py 924–947）只到候选摆放调用，正文第6步还说计算预测失衡并按门槛选最优；后者实际在950–983。本轮补读确认文字方向成立，建议扩大/补充引用，不把补证误写成旧引用自身已完整支持。
- **P3，回溯计数与失败收尾的引用范围不足。** `placement-search-backtrack-limit` 的来源7（932–949）覆盖候选循环，计数重新归零在767，所有候选失败返回None在973–974；来源19（rc2 936–1087）恰好在budget_exhausted计算后截止，撤销/失败返回/递增在1088–1107。补读确认行为成立，建议把相应固定证据扩至实际分支。
- **P3，跨版本未知键拒绝仅引用一个版本的单行报错。** `placement-search-backtrack-limit` 的来源8是GLM db701c1f的一行raise，不能独立证明v0.23与v0.26的配置类；来源9是main配置装饰器的extra=forbid默认，尚需具体EplbConfig使用和字段范围，不能仅由装饰器单行推出具体键不存在。当前条目据此标“部分支持”；继续核父参数页及维护版本实现，不将其改判为运行结论错误。

最初四页批次未发现P1/P2；后续已发现并修正下列P2，不能将早期批次结论推广到全组。剩余来源、正文直接外链和图证据继续处理。
# 新增批次：搬运限额与官方目录

逐条判定累计 237/2081 条，73 页中 11 页完成本轮正文与所有 sources 语义核对。指定官方 contribution / evaluation / community 已全文读完 19/19 篇，范围与各篇限制在 `official-05-06.json`。已逐页核这11页的12项正文外链（17511/17512官方PR正文与合并元数据），并登记站内导航用途；这11页没有图引用。其余75项外链和73项图引用仍待审，不能计为已验收。

P2 已修并经主根独立复核关闭：`rank-transfer-limit` 第149行和 `cross-node-transfer-limit` 第75、116、128、145行把历史默认1带入新版本算例。已明确旧4d默认1、rc2声明-1，以及“显式1或自动Gloo后有效值1”的算例前提，保留16次/一对/48MiB推导。修改前快照 `.tmp/doc-gap-2026-11-03/evidence-transfer-before/`；实际差异 `transfer-limits-remediation.diff`。主根另读rc2配置、通信器选择与计划校验及4d迁移来源、候选筛选后确认修订准确。

P3 已修：rank来源9原1036–1040只有层优先级排序，不支持候选失败后本层不出计划；改为已读947–983并说明None结果。rc2两页来源152–184可证明保留显式值和收紧未设限额，但自动HIXL判断、显式通信器早退实际在204–239；账本标“部分支持”并记录补读，不把补读当作原引文充分。

第二项P2已手工修订并经主根独立执行脚本、核实际diff后关闭：`load-window-bins` 的“减少段数使均衡度偏高、门更难打开”以及 `load-risk-quantile` 的“bins越小方差越小”没有通用数学保证。`stair-binning-counterexamples.py` 从固定4d源码AST提取原统计方法，运行输出保存在同名 `-output.json`：四步两专家的均衡度从0.8降到0.6671105193；八步单专家从6段改5段，方差从5.357142857增到12.5。前者由先除后平均与先平均后除不同造成，后者由不同bin数分段并非嵌套造成。两页保留原有效例子，新增反例和边界，实际差异在 `stair-binning-remediation.diff`，没有NPU执行。

STAIR父页版本差异额外核对：4d与4ebb的 `replica_candidates`、`incremental_replica_candidates`、`lpt_placement`、`plan_layer` AST一致；gate新增可选预计算指标参数，但阈值/零窗口/无锚点分支保持。正文四步中的“无锚点直接参与”仍应带非零窗口前提（P3），原引文明确零窗口先跳过，子页已有解释。

## RFork批次

布局页P2已经修正并由根代理独立复核通过：checkpoint只是加载执行顺序的名称，不保证来源权重仍是checkpoint形状。固定工作版未量化MoE也先转置，接收方可按相同numel view后读，再跳过重复MoE后处理。保留view失败/numel不等、布局转换不是view的边界；diff在rfork-layout-remediation.diff。启动页同源旧称及图中“先交回再发布”倒序也已手改；根代理独立读loader385–407/631–644、session317–345后接受rfork-startup-remediation.diff。图仅做源码语义与生成结构校验，没有视觉验收。

配置页来源13扩大至原表160–228，新增端口公式/绑定处理证据，固定端口绑定失败的动态回退仅限EADDRINUSE，其余错误继续抛；根代理已独立复核关闭。维护页实际执行pnpm rfork:verify --git成功，29源码、7原补丁及衔接完全重建固定tree62d2fd3482fa732ac751bb7cc3d7c892e5646814。Git父链/归档差异/社区祖先关系另读原始元数据，2026-10-02的网络可达性仅为历史存档，未冒称本轮重做。

新增P3精度问题尚需整理：生命周期来源12只覆盖get_seed、8未覆盖CLI；rc2续租公式引文未带上下限/默认常量；identity及startup把所有端口非法归入租约获取失败，但获取仅检查>0、上限由seed_client稍后检查；identity的量化配置优先级转述遗漏hf_text_config回退；layout sfa_v1源码号724–725未包括实际726行dispose。均在逐项账本记录原来源的支持边界与已补读范围，不以“附近有代码”替代精确引用。

正文外链累计实际核12项；图YAML/固定证据已核10项（配置1、生命周期2、身份2、布局1、维护1、启动2、传输1），其余图仍待核。传输图为部分支持：失败支路缺清理失败拒绝第二模型的出口，正文已经说明，登记P3。73项图的清单不是73项验收。子组root正在独立核5页122项短参数来源，待其提供逐项判定后再汇入总账。

容量P2跨组整改：03/04取得两个固定量化描述并修订唯一出处；本组实际解析48个MLA投影以及MLP/专家/词表指定字段，补读MTP rot构造与视觉塔创建/跳过条件，手改LoRA、量化、RFork与RFork传输。20.58GiB限定3121f187所列语言子账，20.91GiB/335GiB是有限清单子账，844MiB不能保证完整草稿1批；3855只是21GiB权重假设下教学预算，38块仅预算其余条件不变时的保活增量。diff为group05-06-capacity-remediation.diff；根组已完整读实际差异并独立解析两份量化文件，接受这些统计边界修订。未猜测新整卡总量，也不以增量通过替代四页全部来源核验。

官方 RFork 指南已分别全文阅读旧社区 baa023ad 155 行、工作版 3284850b 385 行、新社区 921ccc52 239 行及线上 latest 的正文。原始图片以本地文件读取，字节与 baa023ad、921ccc52 的固定图片一致；图中 planner、双端引擎、NPU、NIC 与 RoCE 箭头已实际查看。未取得移动线上图片做本轮逐像素比较，历史“线上图与仓库相同”仅按归档记录处理。指南页两处过期时间/来源口径已手改，差异见 rfork-official-guide-remediation.diff；根组另读旧模型表与新身份配置后独立接受。正文外链累计14项已判定，图定义与固定证据13项已核，均不据此声称视觉验收。

RFork 排错/总览新增 P2：旧 main 已有两种收集路径，v0.23 已传 shape，原总览错误地把它们当后续版本差异；实际全文读旧 transfer_backend.py 585 行、补读 main 两收集器及接收函数，新增5项固定证据并修表。还纠正总览身份构造与搭模型顺序、尝试发布与模型返回顺序；diff 在 rfork-overview-remediation.diff，根组正在独立复核，未提前写接受。

跨页容量残留和回退条件也已修：config/troubleshooting 保留主会话20.09GiB/0.33GiB/s但明确语言子账与必要条件，草稿844MiB不保证一批；独立代理复读接受。传输/排错图原无条件回退，已补服务停止与登记内存清理门槛；独立复核进一步要求排除仅lease未归还的情况，已明确can_schedule_seed只看service_stopped与memory_reset，并加types固定来源。两图语义增量已独立接受，SVG定向结构检查通过，未作视觉验收。总览两路径图同源问题已同步修订，等待独立接受。对应diff为rfork-capacity-followup-remediation.diff、rfork-fallback-diagrams-remediation.diff及rfork-overview-diagram-remediation.diff。

# KVPP 参数与逐层传输增量

本批完整阅读 kvpp-config、size、use-layerwise 三页，并对当前103项 sources 逐项作出判断，见 `kvpp-layerwise-citations-batch.json`。原始 raw 归档分别25、13、24、25段，与实际已读原文逐块比较后全部一致；该结果只用于复用已读证据，不把raw重复计作独立支持。固定 baa KVPP 官方指南1–197全文已读，线上KVPP正文也实际读取，识别其新增组合不能回套旧pin。

已手修并提交独立复核的 P2 包括：改变TP扩展缓存容量时广播量并非不变；逐层与非逐层异步路径不能混同；旧指南的混合缓存限制不能替代当前具体检查；层owner用于过滤Mooncake发布的缓存元数据；Mooncake逐层传输按block/rank对象的byte range工作，不要求每层独立对象。关联P3同时修正了单例重算动机、size1不保证服务启动、DSpark分支条件、eager最终覆盖图模式，以及来源范围。实际差异和旧快照分别为 `kvpp-layerwise-param-remediation.diff`、`.tmp/doc-gap-2026-11-03/evidence-kvpp-params-before/`。没有图变更、UI操作或NPU执行。

本批后总账为732/2129条已判，1397条待判，29/73页正文和全部 sources 已读并逐项判定。其中root五参数141条按其原判断、当前hash合并，未重复计数；完整来源判定不等于全部条目均支持，也不等于全部页面已通过设备或视觉验收。RFork总览增量与第三张两路径图现已由独立审查者接受，报告见 `rfork-overview-independent.md/json`。Super Kernel与benchmark增量独立验收分别见本目录对应acceptance记录。

KVPP 三页的最新增量已获独立复核接受，报告 `kvpp-layerwise-param-independent.md/json`。逐层对象范围与 eager 最后覆盖两项审查意见均已按原文闭环。

## npugraph_ex 批次

本页当前53项来源逐项实读判定，原44项加9项补证。两个raw归档21/33段逐块对照已读原文完全一致，记录 `npugraph-raw-dedup.json`；两份固定官方graph_mode指南302/410行与GLM教程430行均全文读取，不能只用文档标题证明运行行为。

发现并手修三项P2：关闭外部后端后是本地AOTAutograd/FX改写，不是Inductor编译；512 token区间门只由本地manager执行，不能据此排除默认外部后端融合；GLM mHC主干调用普通单输入RMSNorm，不能仅由W8A8推定命中残差加Norm量化候选。QK全服务零候选也收窄为实际注册上下文检查。保留原128B访存与static宽度算例，并补查乘加Triton执行实现，区分张量读写示意与设备流量。其余整理了硬件降级先于依赖断言、v026维护分支与初版tag、编译成本非单调保证。修改前快照 `evidence-npugraph-before`，实际差异 `npugraph-citation-remediation.diff`，等待根代理独立复核。flow图原布局不变，定向SVG生成及结构检查通过；没有视觉/NPU验收。

此时总账785/2138条已判，1353条待判，30/73页正文与所有sources已读判。新增数量来自补证，并未把未核条目默认设为支持；三张npugraph图仅完成定义、数学与固定证据语义核验。其余页面和正文外链仍继续处理。

npugraph 增量现经根代理独立复核接受；未量化矩阵乘证据范围按意见扩到32–159，并将重复C标改为具体来源编号映射。没有通过添加其他证据类型压低比例。独立报告 `npugraph-acl-independent.md`。

## ACL Graph 与 root 第二批合并

ACL Graph 36项当前来源已全部实际读判。补齐真实硬件消费、捕获合法性函数、PA capture wait与update record链、块表调用者和活跃行复制，修正main“全仓搜不到变量”、debug检查范围及单错误码命中等过度陈述。原23段raw与固定原文完全一致。图buffer把“全部重写”改为有效区域内容正确；固定db实际复制当前活跃请求行全部列，不是增量commit，此前临时增量猜测已撤回。独立复核还发现相邻P2：双显式capture列表/max不一致先报错，已补读1739–1771并扩source7到1763，保留通过检查后才更新最大值的条件。根代理接受，报告同上。图只做语义及定向生成/结构检查，未视觉验收。

root 第二批5页59项按原verdict、阅读范围与当前hash合入：benchmarking、capacity-and-reliability、performance-troubleshooting、troubleshooting、pr-11953。独立报告分别为 benchmark-independent-acceptance、capacity-performance-independent、troubleshooting-pr11953-independent；后两页增量由本代理实际复读原文、PR归档全文、RFork父子差异及版本祖先/标签证据后接受。知乎生产文章全文无法取得的1项保持 `unavailable_full_text`，不记成功读取或支持；root账本 `complete=false` 因此保留。

合入后为880/2152项已判，1272项待判。36/73页已逐项处理，其中35页全部引文原文已取得，1页含上述无法取得项。下一批 performance-analysis、performance-walkthrough、quantization-evaluation、quantization-methods、netloader-guide 五页交由root并行核验，本代理不重叠编辑。当前正在核 layer-sharding，尚未计完成或修改正文。



## layer-sharding 全项核验与性能页汇入

49 项逐条结论在 layer-sharding-citations-batch.json；32 段 raw 与已读原文逐块相符。正文/图修复版本角色、GLM DSA-CP 拒绝、单元素不等于省磁盘、连续层号/至少 3 层、full 缓冲复用、427→448 MiB 及 rank 接收量。精确差异 layer-sharding-citation-remediation.diff 已交根代理独立审查。scene 定向解析和 SVG 生成完成；首次误用仅支持 figure 的 figureProblems 报错，不算图验收；无 UI/NPU。官方外链及 PR 正文/固定 patch 的实际读取范围在 supplemental，不把网页导航当正文。

合入根代理已获独立通过的性能两页 51 项及 super 当前 hash；当前 980/2165 项已判定，1185 项待核，39/73 页条目已处理，其中 1 页保留知乎全文无法取得。尚未完成全组审查。


Increment: SFA layout/force-EPLB90 plus GLM MLP/rc2 baseline30 judged explicitly. Current1211/2195 judged,984 pending,47/73 pages have judgments for all current sources; one Zhihu fulltext remains unavailable. Four citation-remediation.diff files sent for independent review. Upstream ced6857a is one CPU-build commit after v0.30.0 tag9ed533eb, not the tag itself; execution pin unchanged. No browser/NPU acceptance.
# 增量进度：版本来源、镜像与 DSpark

本次追加四份来源页与 DSpark 后，总账当前为 **73 页、2218 项来源，1318 项已逐项判定，900 项待核；51 页的当前 sources 已全部有判定**。已判定不代表全部原文均已取得：根代理移交的知乎全文无法取得项仍保留。新引用使分母变化，不以初始来源数冒充当前覆盖率。页面修订的独立验收另记，写手完成核验不等于独立通过。

- GLM 基线重新取得 ModelScope 固定 config 与目录元数据；两 HF revision 的完整解析 JSON 相等，ModelScope 的完整 text_config 相等。arm64 源码复制层重新下载、校验 SHA-256，3063 个主仓库 blob 全部匹配；子模块 gitlink、889 个额外普通文件和 92 个 `.git` 元数据文件单列，未执行下载代码。复算脚本和结果在 `.tmp/wiki-evidence-2026-11-03/check-glm-source-layer.py` 与 `glm-source-layer-verification.json`。旧记录的日期不能由今天的固定树 API 独立证明，对应项记部分支持。
- AscendConfig、GLM MLP 与 rc2 来源页逐项核旧分支、main、rc2；完整 Block Table 旧问答解析读取其长 JSON 字符串及三份内嵌教学页，区别历史答复与当前固定执行机制。各批 JSON 记录实际范围与未覆盖部分。
- DSpark 原 12 项与新增 4 项分别核原论文、DeepInfer 实现、Ascend 官方指南和运行时消费点。窗口 `null` 关闭和异步修正前提已补；未把 CUDA/NPU 源码读取称为硬件执行。论文图只读图注，教学图仅 YAML 与固定事实静态核验，没有浏览器视觉验收。

