# B6 双机启动：进程与入口参数独立审查

日期：2026-11-01。审查者 launch_independent_review 不编写 wiki 正文。按 [wiki 写作标准](../../wiki-writing-standard.md)和[读页规矩](../../../wiki/AGENTS-GUIDE.md)，先读 engine-processes 原页、部署前提与官方教程，再独立核固定上游源码。源码、全文、diff、格式、CLI 检索及浏览器截图审查通过；六项 P2 已修订并关闭，本审查范围内无剩余 P1/P2。

## 范围与源码

本审查负责 engine-processes 的 12 个单元：ASCEND_RT_VISIBLE_DEVICES、VLLM_ENABLE_V1_MULTIPROCESSING、VLLM_HOST_IP、VLLM_PORT、VLLM_WORKER_MULTIPROC_METHOD、api_server_count、headless、data_parallel_address、data_parallel_rank、data_parallel_rpc_port、data_parallel_start_rank、distributed_executor_backend。TP/DP/EP 四单元由另一位独立审查者负责。

独立下载来源为官方 GitHub 固定 raw：vLLM 0fc695fc、568afb3a、84030bbe，Ascend db701c1f、2ed6cbba、baa023ad，教程 0576b647。完整文件保存在 tools/wiki-runtime/launch-20261101/independent；EngineArgs 复用前批固定下载。未读取 tools/repos，未将当前浮动 main 用作版本依据。

## 已核事实与容易误写的边界

| 范围 | 独立核对结论 |
|---|---|
| 前端与 headless | 基线 cli_args.py L353–367 定义 headless=False、api_server_count=int/None（-asc）。serve.py L61–148 随负载均衡方式派生数量：普通内部为全局 DP 数，外部/多端口/Rust 为 1，混合为 local or 1；headless 明确置 0，且不接受正数 API 数量。负数量也走少于 1 的 headless 分支，不能虚构负数有字段校验。 |
| 两端配方 | 官方教程 L245–339：两端 TP8/DP2/local1，相同 node0 地址和 RPC12321；start_rank 分别 0/1；node0 明确 api_server_count=1，node1 headless。可见设备两端都是各自本机 0–7，不是把 node1 设成 8–15。 |
| rank 与 start rank | EngineArgs 初始均 None。rank 非 None 触发外部 LB，不能当 start_rank 的别名；外部要求 local=1 或 None。旧/rc 的非零 start_rank 在非 headless 时才推断 hybrid；main 改为 is not None，显式 0 也进入。Serve 前端判别本来就用 is not None，不能把两层判断混成一次。 |
| 地址与 RPC | 输入 None 时 mp 地址取 master_addr 或 127.0.0.1，ray 取 get_ip；显式地址优先。RPC 输入 None 回落 29550，与 HTTP port、VLLM_PORT 分开；main 字段新增 1–65535 范围，旧/rc 只是 int 默认。 |
| HOST 与 PORT 环境 | HOST getter 默认空字符串；get_ip 显式优先，否则 IPv4→IPv6→告警后 0.0.0.0，旧 HOST_IP 被忽略。PORT 未设为 None，设值按 int 解析，URI 有专门错误；网络分配从给定起点向上找空闲口，未设交由系统分配。main 新增多端口列表跳过 DP 保留区，旧/rc 的显式起点列表不跳过。 |
| V1 开关 | 三版读取环境字符串，未定义时取字符串 1，再按 bool(int(...)) 解析；不是任意文字布尔，空串也不等于缺省。0 关，非零真，文字 true 失败。离线 LLMEngine 用其选择 EngineCore 是否进程内；asyncio 非多进程客户端不支持。它不等于 Worker 执行器开关。external_launcher 会将其设为 0。 |
| Worker 启动方法 | 三版 getter 默认 fork、合法值 fork/spawn；但 CLI 调 cli_env_setup，在环境未设时明确写 spawn。已有显式值保持，随后 runtime/NUMA 等原因仍可强制 spawn。教程未显式设置不能推导实际用 fork，镜像预设仍需现场证据。 |
| 可见设备 | Ascend 使用 ASCEND_RT_VISIBLE_DEVICES 作为控制变量。基线上游辅助映射按非空逗号列表取第 i 项转 int；未设/空在该 helper 返回输入编号。这不能当作 CANN 对空串的可见性承诺。rc/main 增加 assigned_physical_gpu_ids 优先，Ascend main 对 runtime ordinal→物理 ID 使用 CANN 算子，不能与 local rank 混用。 |
| 执行器 | 三版默认选择核心规则一致：未指定且跨 DP world>1 通常 mp，Ray/TPU 等分支另判；最后未指定且组内 world=1 才 uni。显式 uni 不按全服务 DP 卡数否决，每个 executor 只创建一个 Worker，因此“uni 只适整个服务一张卡”须限定为默认派生；也不能用 uni 代替 TP8 的八个 Worker。 |

main Rust 前端还增加 VLLM_USE_RUST_FRONTEND 门控，只有路径不够；参数表若概括三版一致，应限普通 Python 前端。main CLI 定义移到 entrypoints/launchers/cli_args.py L396–410。

## 独立函数验证

执行 `python tools/wiki-runtime/launch-20261101/independent-checks.py`：**102/102 断言通过**，结果写入同目录 JSON。脚本从下载源码 AST 取真实函数及注册 lambda，覆盖三版 ServeSubcommand.cmd 的前端默认、headless 和 LB 冲突，cli_env_setup 的缺省与显式值，V1 bool(int) 语义，PORT 整数/缺省/URI/无效输入，以及 NUMA、已初始化 CUDA 导致的 spawn；另运行真实 get_open_ports_list 验证 main 的 DP 保留区跳过变化。

服务启动入口以 route fixture 接住，不启动服务；环境映射与设备状态是显式 fixture，端口空闲检测用固定返回值替代 socket bind。本结果不是完整 Pydantic 构造、实际端口占用、模型加载或 NPU 推理测试。独立 metrics 脚本另检查四页教学区/全文汉字和代码密度、旧 sources 前缀、calc、aliases 与机器历史尾注；不以机器保留信号替代全文语义审查。

## 首稿独立审查

已实际读 engine-processes 全文、相对 before 快照的 diff、部署页关联 diff，以及两张 YAML 图；未以写手自查代替阅读。原三角色/进程区别、五路消息及 KV connector/PP 例外、20/21 口径、11/9 分机账、三处状态、8/16 算例、补丁三入口、EPLB 条件与原待核逐条保留。新增十二项的 CLI/库入口、输入缺省与派生、非法组合、两端配方与三版边界和独立源码相符。

首稿审查发现并交给写手修订：

| 级别 | 位置与问题 | 影响与修法 |
|---|---|---|
| P2 | 开销节仍留“没有这类原因时，不必把启动方法改成 spawn” | 与新核实的 CLI 默认 spawn 冲突；改为按入口默认与运行时约束选择，不据启动成本建议改回 fork。 |
| P2 | 教学段对 DP2×TP1 必定起独立 Worker 的措辞 | 补“按默认规则/未显式指定 executor”，与显式 uni 每个 executor 仅一个 Worker 的边界统一。 |
| P2 | engine-processes 主图仍用三类进程、只有一张卡的旧标签 | 图示标明多进程布局，左下按 uni 条件；保留图布局，不能重新引入已废弃的卡数判断。startup 图已按执行器分叉。 |
| P2 | external_launcher 写环境为 0 的新结论，其选定 sources 范围恰从分支之后开始 | 追加 parallel.py L841–843（rc L879–881、main L946–948）证据，原 sources 前缀保留。 |
| P2 | engine 首稿全页行内代码密度 21.21/千汉字 | 保留事实，去掉重复源码路径和普通术语底色；须最终复测 ≤13。 |

上述五项已逐项实读修订后关闭：两处默认限定、spawn 成本建议、主图的多进程/uni 标签已修；sources 92–94 覆盖三版 external_launcher；完整 diff 显示去底色保留路径和行号，没有为降密度删事实。复测 engine 全文 10,286 汉字、133 处行内代码，12.93/千汉字。

格式复审另发现一个 P2：源码表和位置列表的七个 __init__.py 路径去底色后会被 Markdown 当强调语法，显示成 init.py。使用项目 react-markdown 与 renderToStaticMarkup 实测字符串，结果为 `<strong>init</strong>.py`。写手转义七处下划线后，本审查者再次渲染实际五行正文，七个路径均完整显示 __init__.py；该项关闭。六项 P2 均已关闭，当前静态审查无剩余 P1/P2。

102 条函数断言已在首稿审查时再次通过。四页独立保留检查显示旧 sources 顺序前缀、aliases 与 19 个 calc 均未丢，engine 与 DP 机器历史尾注逐字一致。

最终密度以去 frontmatter、围栏及机器尾注后的汉字计，全文包含对照源码；代码计行内代码片段数。教学区四页均 0 行内代码、0 角标，首图前均 0 calc；源码区 H3 顺序均为五项规范顺序。

| 页 | 教学汉字 | 全文汉字 | 全文行内代码 | 每千汉字代码 | 全文角标 / C 标 | calc |
|---|---:|---:|---:|---:|---:|---:|
| engine-processes | 6091 | 10286 | 133 | 12.93 | 27 / 18 | 1 |
| data-parallel | 7490 | 10222 | 47 | 4.60 | 30 / 23 | 0 |
| tensor-parallel | 8685 | 11688 | 112 | 9.58 | 29 / 21 | 10 |
| expert-parallel | 9611 | 12875 | 114 | 8.85 | 26 / 20 | 8 |

另实读 dp-request-routing 与 large-scale-ep 的 before diff：只将 data_parallel_rank / data-parallel-rank 唯一别名迁到 engine，原机制与解释保留，并各加参数参考回链；目标「怎么开」标题存在。独立执行 `pnpm wiki:find data_parallel_rank --json` 与 `pnpm wiki:find VLLM_WORKER_MULTIPROC_METHOD --json`，两者首项均 engine-processes、how=exact，别名迁移后的参数入口正常。

## 最终视觉与检索验收

已独立查看本轮浏览器截图 01–09、11–16，共 15 张，证据位于 tools/wiki-runtime/launch-20261101。首屏明确三类角色与进程分布的差别；可以复述为：API 前端接收请求并返回文字，EngineCore 决定每步计算，Worker 执行模型；拆开后需传消息、分别管理状态和初始化补丁。主图的 uni 条件、启动图 fork/spawn 与 uni/mp 两层分支、成本段、8/16 calc、DP/API/环境参数与三版表均可读，未见标签重叠和表格文字截断。

首次截图的拓扑代码横向滚动、旧版表中 init.py 缺下划线，写手修订后，另实际查看 38、39、40、41、43 五张最终截图，合计 20 张。39 的版本路径完整显示 __init__.py，43 的拓扑注释分行后两端参数与数值完整可读，无横向滚动；38 的三版结尾、40 的部署页回链入口、41 的搜索命中也正常。两处视觉问题均关闭。

CLI 批量结果 retrieval.json 已独立计数：27/27，全部首项符合预期；本审查者另实际运行的两条 CLI 检索见前段。ui-retrieval.json 在隔离预览端口 5197 下 27/27 命中预期目标并可点击，其中 25 项唯一；data-parallel-rank 另匹配请求头页面，tensor_parallel_size 另匹配细粒度 TP，这不是参数主页面缺失。ui-links.json 记录的七条跨页点击均有正确页面标题及「怎么开」锚点。UI 操作由主写手执行，本审查者只将自己实际查看的图片记为独立截图审查，不冒充自己的浏览器操作。

已读取本轮实际检查输出：wiki:audit 名单 104/104、4813 条来源；check:content 的 167 页及 11 主题完整；wiki:lint 通过并保留 8 处既有待留意；wiki:diagrams --check 的 331 图与 spec 一致。审计的 URL 未联网校验及 raw 摘录待核不由这些命令证明，本报告的新参数事实另由固定官方源码和独立函数验证支持。

现场镜像环境、实际双机进程列表及性能不在本轮静态参数核对的通过范围。无需用户决定的新事项。
