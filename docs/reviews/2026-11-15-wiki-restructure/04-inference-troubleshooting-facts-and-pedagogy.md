# 样板 4：`wiki/concepts/inference-troubleshooting.md` 旧事实与教学改进清单

- **目标文件**：[`wiki/concepts/inference-troubleshooting.md`](../../../wiki/concepts/inference-troubleshooting.md)（235 行，`id: inference-troubleshooting`，`type: concept`）
- **拟采用修订类型**：`editorial`（保护 `L61-L102` 请求 `R` 超时排查演示与两张既有 2D 图；将 `L105-L182` 十类故障平铺段落升级为可快速扫读的“现象与适用场景 → 最小首取证据 → 区分实验与下一站机制页”结构；对 `L115` 退出码 `137` 等参数/变量/函数与退出码按语义恢复反引号；在 `L219` 交代或归置 `PCP`/`DCP`/`MRV1`/`MRV2`/`KPool`/`SFA-only DSA-CP` 缩写并将 `v0.30.0rc2` 合入 `L221-L227` 版本对照表；保持 `verified: []` 真实状态不变；本轮清单未提出需 `supersede.claims` 的正文纠错，不人为捏造正文旧错；若后续独立检视或源码核对发现新反证，则按实改判并启用 `supersede.claims` 有证更正，不以保真要求固化未核实旧错）
- **冻结与主干保护项**：
  1. 原样保护 `L61-L102` 开篇“先找最后正常步骤”原则、请求 `R`（`10:00:00` 收到 → 第 `42` 步完成 → `10:00:01` 发出首片 → `10:00:01.1` 代理缓冲积压 → `10:00:30` 客户端超时）完整排查演示；
  2. 原样保留两张 2D 图：[`inference-troubleshooting-boundary`](../../../wiki/diagrams/inference-troubleshooting-boundary.yaml)（`L71`）与 [`inference-troubleshooting-experiment`](../../../wiki/diagrams/inference-troubleshooting-experiment.yaml)（`L95`）；
  3. 保持 `L55` `verified: []` 空白真实状态不变（严禁机械补写版本号）。

---

## 一、 现有 `sources`（12 条，L27-L41）核对

| 编号（1-based） | `sources` 引用条目 | 覆盖的核心机制与版本 | 去向分类 |
|---|---|---|---|
| 来源 1 (`L28`) | `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L447-L597` (`[C1]`) | 启动过程中设备初始化、权重加载与内存探测入口 | **保留** |
| 来源 2–3 (`L29-L30`) | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1825-L1910` (`[C2]`), `vllm/v1/engine/async_llm.py#L588-L636` (`[C3]`) | 请求结束、状态移除与缓存释放入口；前端取消到引擎的交接 | **保留** |
| 来源 4–5 (`L31-L33`) | Ascend 官方 `service_profiling_guide.html` (`[S4]`) 与 `faqs.html` (`[S5]`) | 采集能力与常见配置排障参考 | **保留** |
| 来源 6–12 (`L34-L41`) | `vllm-ascend@7d825229` (`worker.py#L491-L506`, `ascend_config.py#L549-L565, #L1844-L1912`, `platform.py#L1641-L1648`, `GLM5.3-Flash.md#L26-L33` 本地与 GitHub URL, `indexer_kpool.py#L444-L452`) | `v0.30.0rc2` `AscendConfig` 严格拒绝未知键、工厂消费输入与 Omni 未知顶层键告警剔除（`[C7][C8]`）；通用 PCP 要求 MRV2（`[C9]`）、GLM 教程要求 MRV1（`[S10]`）、KPool 拒绝 PCP/DCP 且另有 SFA-only DSA-CP（`[C12]`） | **保留** |

---

## 二、 逐段旧事实与版本/硬件限定条件三出口核对表

| 原文位置 | 原子事实与版本/硬件限定条件摘要 | 关联来源 / 标记 | 出口分类 | 新稿承接位置与说明 |
|---|---|---|---|---|
| `L61-L102` | 开篇“先找最后正常步骤”原则；请求路径（入口 → 调度器 → 设备执行 → 返回）与“未采到记录只说明缺证据、不能当设备未执行”（配 `inference-troubleshooting-boundary` 图）；请求 `R` 超时排查教学示意（`10:00:00` 入口 → 第 `42` 步完成 → `10:00:01` 首片发出 → `10:00:01.1` 代理缓冲积压 → 直连重放与恢复复现实验，配 `inference-troubleshooting-experiment` 图）；`request ID` / `step ID` / `rank` 映射与进分支前必留的 6 项基线（模型/分词器、安装版本、启动命令、生效配置、原始输入、首次异常及多卡同期记录） | `[C1]`–`[C3]`、`[A]` | **保留** | 原样保护 `L61-L102` 全部正文、表格、两张 2D 图与教学示意限定条件 |
| `L105-L118` | 分支 1（启动、依赖与加载）：按 `NPUWorker` 启动顺序找最后成功步与首次失败 rank、核对实际加载包路径；进程突然退出保留容器 ID/PID/退出时刻与平台终止记录，退出码 `137` 本身不能证明显存不足（区分主动终止、主机/容器 OOM 与设备预算）；最小启动配置隔离复现（加载完成不等于服务就绪） | `[C1]`、`npu-worker-lifecycle`、`device-memory`、`platform-plugin-registration` | **保留** | `## 按已经确认的阶段继续查` 分支 1：升级为“现象 → 最小首取证据 → 区分实验与下一站”清晰结构，恢复 `137` 反引号 |
| `L119-L124` | 分支 2（延迟、吞吐与长尾）：留逐请求发送/输出时间、输入输出长度、到达方式、失败数与阶段记录，分排队/执行/返回三段；同负载单变量对照（阶段没变而汇总变了先查负载与统计差异） | `inference-benchmarking`、`inference-performance-troubleshooting` | **保留** | 分支 2 结构化卡片/列表 |
| `L125-L134` | 分支 3（内存与容量）：先分清主机/容器限制 vs 设备空间不足；设备侧按启动五阶段（加载前/后、试跑后、缓存池建立后、图捕获后）与运行时（活跃请求、长度、空闲块、抢占次数）采集；改量化/长度/缓存格式须重算每块字节与非缓存开销；请求结束后块已归还而设备内存未降属池保留复用，不能仅凭设备曲线判泄漏 | `device-memory`、`kv-cache-memory-profiling`、`glm-5-3-flash-two-node`、`request-teardown` | **保留** | 分支 3 结构化卡片/列表 |
| `L135-L140` | 分支 4（输出与数值）：留模板展开后输入编号、生效采样参数、输出编号、原始响应与结束原因（相同输入文字不保证编号相同）；同前缀比首次分歧位置，不从“乱码”直接跳“量化有问题” | `inference-correctness-troubleshooting` | **保留** | 分支 4 结构化卡片/列表 |
| `L141-L146` | 分支 5（编译、图与算子）：收集报错前输入形状、数据类型、编译/捕获日志、实际图模式与首次触发条件；固定输入对比 `graph mode` 与 `eager`（仅图路径失败仍需考虑算子选择、内存布局与时序变化；关图后速度不作原配置收益结论） | `graph-mode-layer`、`acl-graph`、`npugraph-ex` | **保留** | 分支 5 结构化卡片/列表 |
| `L147-L154` | 分支 6（分布式通信）：首次多机或网络变更先做 HCCL 设备网络预检（本机链路/地址 → 实际 NPU 对连通性）；收集同次集合通信组、参与 rank、到达/完成、张量规模与前序错误；先控迟到卡前序负载，再测匹配拓扑链路（独立测试正常不排除模型负载下竞争） | `cann-hccl`、`collective-communication`、`inference-performance-analysis` | **保留** | 分支 6 结构化卡片/列表 |
| `L155-L162` | 分支 7（缓存和分离部署）：区分“命中、可用、传到”；收集输入编号、缓存键/命中记录、可复用长度、块状态及分离部署发送/接收端映射与完成确认；冷热对比确认实际减少重算，隔离对比本地复用 vs connector 传输/卸载 | `prefix-caching`、`pd-disaggregation`、`mooncake-connector`、`kv-cache-layerwise-offload`、`deepseek-serving-case` | **保留** | 分支 7 结构化卡片/列表 |
| `L163-L168` | 分支 8（接口与服务能力）：留 HTTP 状态、请求体、原始流式片段、结束原因、解析器名与最终客户端内容；区分结构化输出（约束可选 token）与工具解析器（整理调用字段）；直连 vs 代理/客户端逐层比对（流式与非流式改变交付方式，不凭两次随机文本不同判解析器） | `api-server-entry`、`structured-output`、`streaming-output` | **保留** | 分支 8 结构化卡片/列表 |
| `L169-L176` | 分支 9（长运行与恢复）：区分“进度很慢”与“所有相关进度停止”；取消时追前端通知、引擎状态与 worker 清理（`[C2][C3]`）；重启暂时恢复只证明状态被重置；涉及 RFork 补提交标识、角色/rank 与两端生效配置转 `rfork-troubleshooting.md`；结合容量与恢复案例核对就绪时间与净消化能力 | `[C2]`、`[C3]`、`request-teardown`、`rfork-troubleshooting`、`inference-capacity-and-reliability` | **保留** | 分支 9 结构化卡片/列表 |
| `L177-L182` | 分支 10（版本与配置回归）：留升级前后精确 commit、安装路径、镜像、模型文件、启动日志与各进程最终配置；先查 `ascend-config-system` 与 `ascend-patch-system`；版本标签相同而安装文件不同先解决产物不一致，不把新版参数粘回旧版当已验证修复 | `ascend-config-system`、`ascend-patch-system` | **保留** | 分支 10 结构化卡片/列表 |
| `L183-L200` | `## 证据不足时，下一步应该有多具体`（说明已确认项、所缺证据、取法与两路去向；单条可控请求短窗口复现，记录最小复现与线上差异）、`## 放到 GLM 双机，哪些前提先不要改`（两机 16 卡 TP8/DP2/EP16 共同持有专家，某组等待不自动等于其前端堵塞；缩卡/换精度改变布局，先在原配置取证）、`## 常见误解` 3 条 | `[I]`、`glm-5-3-flash-two-node` | **保留** | 原样保留 `L183-L200` 三个小节 |
| `L201-L235` | `## 对照源码` 核验区：`### 怎么开`、`### 会报什么错`、`### 开销和什么时候别开`、`### 版本差异`（`L219` `v0.30.0rc2` `AscendConfig` 拒未知键、工厂消费、Omni 未知顶层键告警剔除、通用 PCP 要求 MRV2 vs GLM 教程要求 MRV1、KPool 拒绝 PCP/DCP 及 SFA-only DSA-CP `[C7][C8][C9][S10][C12]`，与 `L221-L227` 四版本复用/重认表）、`### 源码位置`（`[C1]`–`[C3]`、`[S4][S5]`、`[I]`、`[A]`） | 全部 12 条 `sources` 与角标 | **保留** | 文末默认折叠的 `## 对照源码` 核验区：在 `L219` 依据固定源码坐标补齐 `PCP`（Prefill Context Parallel，`vllm-ascend@7d825229:vllm_ascend/platform.py#L1641-L1648`）、`DCP`（Decode Context Parallel，`vllm-ascend@7d825229:docs/source/developer_guide/Design_Documents/context_parallel.md#L1-L20`）、`MRV1`/`MRV2`（Model Runner V1/V2，`vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L491-L506`）、`KPool`（`Glm5NextKPoolIndexerBackend` 拒绝 `PCP > 1` 或 `DCP > 1`，`vllm-ascend@7d825229:vllm_ascend/attention/indexer_kpool.py#L444-L452`）、`DSA-CP`（`DSA` 即 DeepSeek Sparse Attention，见 `vllm-ascend@7d825229:vllm_ascend/xlite/xlite.py#L593`；GLM 教程中的实验性 `SFA-only` 路径通过 `--additional-config '{"enable_dsa_cp": true}'` 仅在 TP 组内分担 SFA 查询 token，主 KV/索引池/尾缓存仍复制且保持 `PCP=DCP=1`，见 `vllm-ascend@7d825229:docs/source/tutorials/models/GLM5.3-Flash.md#L26-L33`）的说明与反引号，并将 `v0.30.0rc2`（`7d825229`）合入 `L221-L227` 版本对照表 |

---

## 三、 具体讲法改进位置与实施要点

1. **保护 `L61-L102` 请求 `R` 超时排查主干与两张 2D 图**：
   - 前半部分（边界原则 + 请求 `R` 从客户端 30 秒超时一步步缩小到代理缓冲积压的对照表与重放实验 + 两张 2D 图）是全库排障示范标杆，**原样保留不改**。
2. **在 `## 按已经确认的阶段继续查`（`L103-L182`）增补十类故障快速定位总表，并将十个 H3 分支升级为三步扫读结构**：
   - 在 `L103` 下新增一张紧凑的「十类故障快速分流索引表」（列：故障方向 / 典型现象 / 首取最小证据 / 下一站机制页），方便现场排障 10 秒定位；
   - 每个 H3 分支内部统一按 **「适用现象 → 首取最小证据 → 隔离区分实验与下一站」** 三段组织，在不删减任何一句限定条件与跨页链接的前提下消除纯文字平铺感；对 `137` 等退出码、状态码、参数与函数标识按语义恢复反引号，普通技术名词保持正体、避免无意义代码底色（旧 `maxInlineCodePerK: 13` 密度门禁由包 2 废止）。
3. **消解 `L219` 未解释缩写并将 `v0.30.0rc2` 合入版本表（`L217-L229`）**：
   - 为 `L219` 中的 `AscendConfig`、`PCP`（Prefill Context Parallel，预填充上下文并行，`vllm-ascend@7d825229:vllm_ascend/platform.py#L1641-L1648` 要求启用 `MRV2`）、`DCP`（Decode Context Parallel，解码上下文并行，`vllm-ascend@7d825229:docs/source/developer_guide/Design_Documents/context_parallel.md#L1-L20`）、`MRV1`/`MRV2`（Model Runner V1/V2，`vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L491-L506`）、`KPool`（GLM-Next KPool 索引器后端，`vllm-ascend@7d825229:vllm_ascend/attention/indexer_kpool.py#L444-L452` 显式拒绝 `PCP > 1` 或 `DCP > 1`）、`DSA-CP`（`DSA` 即 DeepSeek Sparse Attention，见 `vllm-ascend@7d825229:vllm_ascend/xlite/xlite.py#L593`；`vllm-ascend@7d825229:docs/source/tutorials/models/GLM5.3-Flash.md#L26-L33` 所载 GLM 实验性 `SFA-only` 路径通过 `--additional-config '{"enable_dsa_cp": true}'` 仅在 TP 组内分担 SFA 查询位置，主 KV、索引池与尾缓存仍复制，KDA 沿用 TP 且保持 `PCP=DCP=1`，勿按缩写猜译或与通用 `PCP`/`DCP` 混同）补齐反引号、固定源码坐标与适用边界说明；
   - 将 `releases/v0.30.0rc2`（`7d825229`）合入 `L221-L227` 版本表，消除段首孤立粗体补丁。
