# B6 并行参数独立审查

审查日期：2026-11-01。审查者：独立子代理 parallel_params_review；未修改 wiki 正文或索引。

## 范围与方法

本轮四单元为 W1698 tensor_parallel_size、W1534 data_parallel_size、W1535 data_parallel_size_local、W1561 enable_expert_parallel，落在 tensor-parallel、data-parallel、expert-parallel 三页。先全文阅读写作标准、读页指南、三页正文与部署前提，再读固定源码，最后以本批 before 快照审实际 diff，避免把已有未提交修改计入本批。

固定 vLLM 提交为 0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665、568afb3a13806beb53bb2e6bd518269357b237c0、84030bbe3d74d99bad477a3d2e37a973ccd8865c；昇腾部署镜像 db701c1f 与社区维护版、rc、main 分开阅读。本批不把三版参数核对扩展为 DP 整页执行循环认证，原 verified: [] 保留。没有读取 tools/repos。

源码证据位于 tools/wiki-runtime/launch-20261101/parallel-independent/，复用 capacity-kv-20261031 中的固定 arg_utils.py、model.py，以及 scheduler-20261031 中的固定昇腾 platform.py。下载来源为官方仓库对应完整提交的 raw 文件。

## 源码核验结论

| 项目 | 独立结论 | 精确证据 |
|---|---|---|
| TP 默认与范围 | 三版 int、默认 1、下界 1；正整数仍须通过模型形状和设备等联合约束 | 三版 parallel.py：基线 114–154、rc 122–163、main 124–167；基线 model.py 1184–1198；基线 parallel.py 487–492 |
| DP 总数 | 三版默认 1、下界 1；全局组数不等于设备数 | 同上三版字段及基线 arg_utils.py 471–474、999–1022 |
| DP local 输入与派生 | EngineArgs 输入 None，直接 ParallelConfig 默认 1、下界 0；普通 mp 无其他推断条件时取全局 DP；显式 rank 进入 external，local 只允许 1/None 并最终取 1 | 基线 arg_utils.py 1817–1928；rc 1964–2077；main 2145–2290；基线 parallel.py 441–450、801–835 |
| local=0 | 低层无本地引擎的特殊值，不是关闭 DP；headless 要求 >0 | 基线 parallel.py 441–450、801–835，配合入口 headless 检查 |
| main 的 start_rank=0 | main 使用 is not None，显式 0 也进入 local 分支的 hybrid 判断；local=1 又降为 external。旧版使用 truthy，显式 0 不触发 | 基线 arg_utils.py 1888；rc 2034；main 2244、2262 |
| 多节点差异 | main 节点推断计入 PCP，部分 assert 改为 ValueError；不能概括三版完全相同 | main arg_utils.py 2148–2201、2222–2237，对照基线 1817–1928 |
| EP 输入 | bool 默认 False；启动级 CLI/EngineArgs 参数，与请求采样无关；开启 EP 不等于开启 EPLB/MC2 | 三版字段；arg_utils.py 基线 1061–1065、rc 1100–1104、main 1180–1184 |
| EP 规模与关闭 | DP×PCP×TP>1 且开关为真才 use_ep；开 EP 将专家内部 TP 置为 1，EP 取展平规模；不开 EP 保留展平后的专家 TP | fused_moe/config.py 基线 1165–1212、rc 1204–1251、main 1212–1259 |
| 非 MoE 开 EP | 正常模型配置校验直接拒绝；昇腾通信选择器的非 MoE 返回 None 只是局部分支，不代表启动可通过 | model.py 基线 1137–1142、1197–1198；rc 1177–1182；main 1373–1378 |

## 本轮发现及处理

发现并向作者反馈一项 P2：expert-parallel 原文声称非 MoE 开 EP 不会仅因开关报错。三版 ModelConfig 均有前置拒绝，容易使用户采用不能启动的配置。当前正文已改为区分正常启动校验与选择器局部行为，并新增准确错误信息；原选择器事实保留。位置：wiki/concepts/expert-parallel.md:558、582。该项已闭环。

补写后的三页实际 diff 已审，无新增待处理 P1/P2。没有移动既有教学机制或重复另造一份 TP/EP 计算账；参数解释集中在各自“对照源码”，组数、地址、rank、headless 通过回链分工。

## 可复现验证

运行 `python tools/wiki-runtime/launch-20261101/parallel-independent/checks.py`：63/63 通过，结果保存为同目录 checks.json。

验证执行固定源码的真实函数或连续 AST 分支：三版字段默认/下界静态检查、真实非 MoE EP 检查、64 头 TP8 接受及 TP3 拒绝、五种 TP/DP/PCP/EP 组合、普通 local 缺省、双机两端、显式 rank、start_rank=0/1、local=1 hybrid 降级以及不合法 external/local 组合。仅用 fixture 替代上下文对象、分布式组查询和结果容器，函数控制流不重写。未执行完整 Pydantic 配置启动、模型加载、NPU/HCCL 或性能测试。

运行 `python tools/wiki-runtime/launch-20261101/independent-metrics.py`，实际 before/current 比较结果如下。原始 JSON 在 launch-20261101/independent-metrics.json。

| 页面 | calc 完整保留 | 旧 sources 前缀 | 旧 aliases | 全篇角标 / C 占比 | 全篇行内代码 / 千汉字 |
|---|---|---|---|---|---|
| TP | 10/10 | 42 项原顺序保留，追加 5 项 | 全保留 | 29 / 72.41% | 9.58 |
| DP | 0/0 | 31 项原顺序保留，追加 10 项 | 全保留 | 30 / 76.67% | 4.60 |
| EP | 8/8 | 45 项原顺序保留，追加 9 项 | 全保留 | 26 / 76.92% | 8.85 |

三页教学区均为零角标、零行内代码；“对照源码”均保留规定的五个 H3。DP 机器生成的“已废弃的说法”尾注与 before 完全相同。TP/EP 原 verified 列表未扩张，DP verified 仍为空。保留的待核包括硬件通信/性能实测、量化配置、dummy 内部路径及其他分支追踪，不借本次四个参数核验消除这些边界。

图文配套审查读取了三页引用的 17 份 wiki-diagram YAML：TP 5 份、DP 4 份、EP 8 份；核对矩阵两种切法及 [10,4] 结果、DP 执行组/通信组、专家完整分配与 dispatch/combine、128 行 MC2 分界、两种通信路径及场景 M 的通信载荷。此次正文新增不改变这些图的前提或数值，图中的单卡持有专家与本批 EP 规模解释一致。图源检查不代替下面的浏览器视觉验收。

## 浏览器与检索验收

已实际打开并逐张审阅本轮 launch-20261101 的 17–37 共 21 张 PNG。DP 的 17–21 覆盖新增参数、首两屏、版本表、保留的请求打分说明；TP 的 22–28 和 37 覆盖新增参数、首两屏、列切/行切完整图、版本表及真正的 calc 渲染；EP 的 29–36 覆盖最终正确的参数页、首两屏、dispatch/combine 图、非 MoE 错误行、版本表和 14 的完整示意计算。29 按当前最终文件验收，不引用此前失败画面。27 只是计算段前文，不作为 calc 渲染通过依据，calc 依据为 37。

这些截图中的参数、错误文本、表格和计算结果均清楚可读；未发现内容横向溢出、覆盖关键文字、乱码或未渲染的 Markdown。TP 图展示相同结果 [5,1,3,−2]；EP 图的源卡/目的卡与正文一致，calc 中 9+5=14 与正文一致。图大于一屏时以相邻截图衔接查看，不把正常滚动裁切判作排版故障。随后实际打开补充截图 42-dp-groups.png，DP2×TP2 图的两个执行组、两个 DP 通信组和四卡 EP 组、图注均正常呈现，组成员与正文一致。

独立解析 retrieval.json：27/27 项均成功，本组 9 种参数拼法全部首位命中应归属的 TP/DP/EP 页面，包含 data_parallel_size_local、data-parallel-size-local、no-enable-expert-parallel。独立解析最终 ui-retrieval.json：隔离 preview-dist、5197 端口上的整组重跑为 27/27，27 个查询互异，点击后 URL 均匹配预期页面；并实际看过 41-ui-search.png，EP 关闭别名检索和目标页面正常。此前共享 dist 被并发构建替换导致旧模块 404 的中途运行不计入通过。tensor_parallel_size 同时检出细粒度 TP 是保留的相关主题，正常点击标准 TP 页，不要求人为隐藏相关结果。

另读取 ui-links.json 的 7 项实际点击记录，TP/DP/EP 参数参考、进程启动参数及部署命令链接均落到预期页面和“怎么开”锚点。上述浏览器操作由作者执行，本独立审查者复核其原始截图与 JSON，不冒称独立重新操作浏览器。

## 当前结论

四单元独立验收通过：已发现 P2 已修，固定源码断言、三页全文和实际 diff、信息保留、图文/参数表/calc 截图以及 CLI/UI 检索均有本轮证据，无未处理 P1/P2。保留硬件和其他版本机制的既有待核，不把 fixture 检查宣称为昇腾实际启动验证。无需用户决定的新事项。
