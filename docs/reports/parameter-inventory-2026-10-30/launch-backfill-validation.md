# B6 双机启动参数补写验证

2026-11-01，B6 的 **16/16 单元**已补写、独立审查并通过检索与浏览器验证。累计 A 批 11、B1 8、B2 9、B3 10、B4 5、B5 5、B6 16，共 **64 个单元**；B 批 **53/89**，下一批 B7 返回与流式输出 11 个单元。

基线为 vLLM 0fc695fc / GLM Ascend db701c1f，对照 rc 568afb3a / 2ed6cbba、固定 main 84030bbe / baa023ad；Ascend 社区 v0.23 的 2c59ff10 与 GLM 镜像单列。固定源码核对不证明现场安装内容；本轮未做 NPU 启动、双机连通性或性能实测。

## 单元与唯一归属

| 单元 | 参数 | 归属与补齐内容 |
|---|---|---|
| W0091 | ASCEND_RT_VISIBLE_DEVICES | [进程页](../../../wiki/concepts/engine-processes.md#怎么开)：本机列表、编号映射、未设/空串与 CANN 可见性边界、三版映射变化 |
| W0249 | VLLM_ENABLE_V1_MULTIPROCESSING | 进程页：bool(int) 默认 1，离线 EngineCore 与 Worker 多进程区别、在线异步限制、external_launcher 覆盖 |
| W0266 | VLLM_HOST_IP | 进程页：空串、显式优先、探测回退、旧 HOST_IP 忽略，与 HTTP/DP 地址区别 |
| W0328 | VLLM_PORT | 进程页：None/整数、动态端口起点、非整数/URI 错误、三版 DP 保留区差异 |
| W0434 | VLLM_WORKER_MULTIPROC_METHOD | 进程页：fork/spawn 合法值、库默认与 CLI 默认、环境预设、强制覆盖与主入口保护 |
| W1410 | api_server_count | 进程页：CLI 前端项、None 按 LB 派生、0/负数/1/多进程、Rust/弹性 EP 覆盖 |
| W1439 | headless | 进程页：False、零前端、正 API 数互斥、本地组数与 hybrid 限制 |
| W1527 | data_parallel_address | 进程页：None、mp/Ray 默认推断、显式主地址、两端一致 |
| W1532 | data_parallel_rank | 进程页：输入 None/配置 0、合法编号、外部 LB、本地数限制、与 start_rank 区分 |
| W1533 | data_parallel_rpc_port | 进程页：输入 None/配置 29550、本站 12321、握手用途、main 新增范围 |
| W1536 | data_parallel_start_rank | 进程页：连续本地组起始编号、CLI 与 EngineArgs 判定区别、main 显式 0 的变化 |
| W1550 | distributed_executor_backend | 进程页：None 派生、mp/uni/ray/external_launcher/自定义类，选择和进程边界 |
| W1534 | data_parallel_size | [DP 页](../../../wiki/concepts/data-parallel.md#怎么开)：整数默认 1、全局组数下界，与本地数/编号/设备联合约束 |
| W1535 | data_parallel_size_local | DP 页：EngineArgs None 与配置字段 1、模式派生、0 特殊值、本站 2/1 两端组合 |
| W1561 | enable_expert_parallel | [EP 页](../../../wiki/concepts/expert-parallel.md#怎么开)：bool False、正反 CLI、Python 入口、非 MoE 校验、单成员组与 EPLB/MC2 边界 |
| W1698 | tensor_parallel_size | [TP 页](../../../wiki/concepts/tensor-parallel.md#怎么开)：整数默认 1、CLI/Python、模型与 DCP 整除约束、TP 与总设备数区别 |

没有新建重复参数页。既有 TP/DP/EP 机制、通信和显存推导留在原页，进程页只集中维护启动组合与进程边界。data_parallel_rank 的两种拼写从 DP 路由/大规模 EP 页迁至进程页，原页保留说明并加回链；请求头 X-data-parallel-rank 的入口保持在请求路由页。

## 独立审查与修订

两位独立审查者分别审十二项启动参数和四项并行参数，均实读旧页、新页、实际 diff、图源和固定官方源码。记录见 [启动参数独立审查](launch-independent-review.md) 与 [并行参数独立审查](parallel-params-independent-review.md)。提取真实函数/分支执行的轻量检查分别为 **102/102** 和 **63/63**；合计 **165 条通过**。这些检查不等于完整 vLLM、Pydantic 或 NPU 推理测试。

已关闭的内容问题包括：库默认 fork 与 CLI 未设时写 spawn 混淆；DP2×TP1 创建 Worker 的默认条件缺失；主图旧单卡标签；external_launcher 的来源范围不包含实际赋值；进程页行内代码密度；去代码样式后双下划线路径被 Markdown 当强调语法；非 MoE 开 EP 被误述为不报错。对应的两图、部署页与主线底稿 fork 表述同步修正。路径转义另经真实 ReactMarkdown 渲染复核，未删事实以降低密度。

## 实际验证

| 验证 | 结果 |
|---|---|
| pnpm -s wiki:build | 167 页索引生成 |
| pnpm -s check:content | 11 个主题、167 篇正文完整且无重复 |
| pnpm -s wiki:lint | 通过，8 处范围外提醒；首轮两处 rank 别名冲突已修并复跑 |
| pnpm -s wiki:audit | 终检 104/104 强制名单页通过；4815 条来源，4550 条本地行号有效，无无效 commit、缺文件、越界或未知仓库 |
| pnpm -s wiki:diagrams / --check | 331 张图与 spec 一致，两张进程图同步生成 SVG |
| pnpm -s build | TypeScript/Vite 构建通过，最终本轮日志 27.65 秒；既有构建工具警告保留 |
| CLI 检索 | 27/27 查询首项 exact 命中对应主参考 |
| UI 检索 | 独立预览中 27/27 查询找到主参考并实际点击到达；25 项唯一匹配 |
| 浏览器阅读 | 四页首两屏、机制图、三版参数表、错误表及代表性演算；进程页两图、环境表与双机拓扑示例另逐段检查 |
| 跨页链接 | 7 条实际点击到达 DP/TP/EP、进程参考与部署命令章节 |

UI 的 data-parallel-rank 还匹配含 X-data-parallel-rank 的请求路由页，tensor_parallel_size 还匹配细粒度 TP 页；目标页均存在且可点击，未将两项写成唯一匹配。检索验证覆盖 CLI、目录搜索与页面到达，未运行生成式问答评测。

共享 dist 在验收中被其他构建更新，曾令已打开页面引用的旧模块返回 404。使用独立 preview-dist 副本和 5197 端口后，整组 27 项 UI 检索重新通过；失败画面没有算作验收。最终拆行示例无横向滚动，双下划线路径完整显示。截图 01–43 包含不同阅读位置，最终示例与路径分别以 43、39 为准；审查者独立查看截图，不冒称其亲自执行了写手的浏览器操作。

全库终检另列 265 条 URL 未联网验证、1526 条 raw 引用待核，不属于通过范围；本批新增结论另核固定官方源码与真实函数分支。首轮审计为 4813 条来源，终检时共享工作区另有来源新增，两个原始日志均保留；不将全库计数变化算作本批新增参数。保留原有硬件与整页行为待核，不把参数核对扩大为现场验证。

## 保留性与密度

以本批 before 快照为基准，四页旧 sources 前缀和原 aliases 保留，新增来源分别到 94/41/47/54；两页机器历史尾注逐字不变。19 个 calc 保持原文，机制、数字、边界与待核另经全文/diff 语义审查。DP 页 verified 仍为空，进程页仍保留两个发布分支；新增三版参数表不代表整页所有行为已核 main。

统计去 frontmatter、代码围栏及机器尾注后的汉字；全文含对照源码。四页教学区均 0 行内代码、0 证据角标，首图前均 0 calc，源码区五个 H3 顺序合规。

| 页 | 教学汉字 | 全文汉字 | 行内代码/千汉字 | 角标 / C 标 | calc |
|---|---:|---:|---:|---:|---:|
| engine-processes | 6091 | 10286 | 12.93 | 27 / 18 | 1 |
| data-parallel | 7490 | 10222 | 4.60 | 30 / 23 | 0 |
| tensor-parallel | 8685 | 11688 | 9.58 | 29 / 21 | 10 |
| expert-parallel | 9611 | 12875 | 8.85 | 26 / 20 | 8 |

证据在 tools/wiki-runtime/launch-20261101：before/diff、preservation.md、固定源码、两组独立检查、metrics、命令日志、retrieval.json、ui-retrieval.json、ui-links.json 和截图。使用本批快照区分前序工作，没有回滚无关改动。

## 剩余事项

需用户决定：无。现场镜像是否预设启动方法、实际辅助进程数量、spawn 下 EngineCore 的 Ascend 缓存初始化细节、固定 main 的其余进程实现，以及各并行页原有设备/通信待核继续保留。本批 16 单元补写不将这些事项改成已验证。
