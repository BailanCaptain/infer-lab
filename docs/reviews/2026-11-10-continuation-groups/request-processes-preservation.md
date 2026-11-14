# 请求链与进程组：信息保留清单

审查者：`groups_ucm_review`。比较基点为 `.tmp/continuation-groups-2026-11-10/request-processes/before.zip`，在本组修订前冻结；21 个文件的原始 SHA 见 `request-processes-manifest.json`。清单依据已读的三页完整正文、九图及前批 200 的两页 diff 整理。它不把旧审查结论作为本轮事实判定。

以下内容不得因补四版、补官方入口或清理旧待核而删除。最终逐项对照 normalized diff 和实际页面均保留；复审去向补在表后。

| 保留对象 | 原有有效内容与边界 | 预期去向 |
|---|---|---|
| 固定部署身份 | GLM-5.3-Flash，2×A2×8，TP8/DP2/EP16；两台合成完整专家集合，每台是 DP 执行组；旧模型专用 db 镜像不是维护分支 | 三页正文主线及部署前提链接 |
| 三类职责 | 前端管文字与输出登记；EngineCore 的 Scheduler 管计划/进度；Worker 管张量；Executor 传调用而不排计划 | shape 首图、定义、两道边界 |
| 职责不等于独立进程 | uni 的 Worker 为当前进程对象，AsyncLLM 的独立 EngineCore 与 Worker 子进程由不同开关决定；离线关闭需未显式强制多进程 | engine 首段、uni inset、误解及开关 |
| 进程账 | 按角色 20：1 API、1 coordinator、2 EngineCore、16 Worker；node1 launcher 另算，不能抹掉 21 与辅助进程实测边界 | engine 双机表和说明 |
| rank 与节点 | rank 是通信组成员编号；本地卡可见编号 0–7 不等于跨两机全局编号；TP、DP、EP 与物理机不是同义词 | engine 定义表、拓扑与环境表 |
| 算例 | PP1×TP8×PCP1=8；再×DP2=16。R1 为 4-token prompt，3 个草拟候选，下轮 1+3；45 层为固定模型主线 | engine calc、request 七站/分支图、shape 请求表 |
| 两次调用及额外调用 | 前向与采样各一次 RPC；None 响应也存在；同步投机可能取回 draft，空步/池化有分支；指定输出卡 PCP/PP/KV connector 条件不能丢 | 三页正文及图注、源码区 |
| 四条通道 | API↔EngineCore 的 ZMQ；Executor→Worker 的共享队列与回程；Gloo 小量对齐；HCCL 设备集合通信。默认 Gloo 与可选 dp_allreduce_on_npu 分开 | request 通道段/表及 engine 回链 |
| 每进程状态 | API 输出队列/反分词，EngineCore 计数与块号，Worker 持久批次/输入缓冲；内容更新不等于缓冲销毁；首次资料与后续差量分开 | engine 状态表、shape 边界 |
| 调度与空批次 | DP 本组无请求、全局仍活跃才 dummy；全局忙闲对齐与每步 Worker 元数据对齐不是一件事 | shape 循环图、request 主图与正文 |
| patch 与配置 | fork/spawn 差异、每进程插件入口、Worker 自己补丁/配置；默认 executor 完整选择顺序及显式覆盖保留 | engine 启动图、patch 表、四版表 |
| 超时与网卡 | vLLM RPC / HCCL 建连 / HCCL 执行三个预算分开；300、Ascend <1836→3000、AIV 1091 与公式适用范围；Gloo 精确名/轮转，HCCL prefix/优先级，TP_SOCKET_IFNAME 不参与固定主路径 | 两页参数参考与相互链接 |
| 排障路径 | 外层 EngineDeadError/Worker error/timeout 不取代原始 traceback；三类进程前缀与七站定位，按版本查文件 | request 日志图、表；shape 错误表 |
| 九图和算例 | shape 两图、engine 两图、request 五图；全部既有主体、箭头、范围图注保留；只有证据支持才改语义 | 同名 YAML/SVG，不因追加表丢图 |
| 旧版证据 | 98dff2a8 的 0.29 历史 step 比较仍有价值，但应与 840 固定上游比较、baa Ascend main 分开；0fc/568/ced 四版明确 | shape 历史说明与新版表 |
| 缺实测 | 真实镜像安装版本、启动环境、进程列表、通信时延与真实 MRO/性能不在无 NPU 的本轮验收中 | 源码区明确边界；静态能闭合者给证据，不泛化为实机通过 |

修订可以增加首屏代价、两种 headless 拓扑连接、rc2 参数/patch/timeout 行、准入消费者回链，或把静态已证实的旧待核改为明确结论；这些都不能改变旧固定部署的算例与条件。

## 最终复核去向

- shape 的职责、边界、循环、R1 算例、开销、排错及旧历史源均保留；新增首屏代价位于 `wiki/concepts/vllm-v1-shape.md:115`，R1/20进程仍在 `:234` 起，四版表在 `:305` 起，实测边界在 `:355` 起。
- engine 的20角色进程账、另算launcher、rank/节点区别、状态表、端口与网卡语法、默认executor及EPLB条件均保留。headless两条路径在 `wiki/concepts/engine-processes.md:447` 起，GLM布局紧随其后；配置初始化次序在 `:553`，参数/patch四版表在 `:606` / `:626`；长路径和赋值移到表后，内容没有删掉。
- request 的七站、四条通道、两次调用、45层及三候选分支、失败定位和原有运行时MRO边界均保留。版本比较位于 `wiki/concepts/request-call-chain.md:371` 起；GLM coordinator 的静态分支在 `:444` 起，显式APC覆盖与实际配置边界仍说明。
- 九对 YAML/SVG 与 before.zip 字节相同；原主体、箭头与范围图注没有因新增表而变化。engine 的 PP1×TP8×PCP1、再乘DP2算例仍为8与16；未把两种headless布局混成新进程账。
- `verified` 四版仅对应正文明确限定的公共控制流、参数/patch、Worker/Runner与命名比较；GLM专用七站没有推广到不含该模型的维护分支，真实安装与未选用组合没有冒称已实测。

精确文件 SHA 与21文件快照见最终 checkpoint；上述行号随最终 metadata 同时冻结。其他线程的 3D 页面与暂缓 V2 不在本清单验收范围。
