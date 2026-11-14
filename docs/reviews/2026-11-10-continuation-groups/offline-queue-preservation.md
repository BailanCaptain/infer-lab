# 离线队列增量保留清单

作者 groups_ucm_review；本轮只改 request-call-chain 正文，新增一张 request-offline-queue 图，API 回链交由根助手。开始前完整读取当前正文；首次大段输出中被截断的中间部分已分段补读。

改前正文及 5 张原图 YAML/SVG 共 11 文件在 `.tmp/continuation-groups-2026-11-10/offline-queue-coverage/before.zip`。原页 SHA256：`bfec12c747ff20bade5c9cb477bdf64f517cc5099f33e25629fbc40cadb68c1f`。

逐项保留结果：

- [x] 七站编号、站点／进程／函数对照完整；GLM 双机 20 进程、TP8/DP2/EP16 主线及 R1 定义未改。
- [x] ZMQ、共享内存、HCCL、gloo 四通道及 32 步 DP 判活、每步 Worker 对齐解释未改。
- [x] execute/sample 两次 RPC、future 队列、结构化输出延后、异步调度和 MRO 实测边界未改。
- [x] 六个 Ascend 接入口、五处 scheduler/cache patch 与当前 GLM 分支条件未改。
- [x] R1 prefill/decode 岔口、node1 空批陪跑、MTP eager 与候选保留位置未改。
- [x] 原日志路由图、七站 traceback 表、实际异常串与非 0 Worker 传播待核保留。
- [x] 原三超时的定义、Ascend 改写、CANN 模式、0 的含义、过时环境项与四版边界保留。
- [x] 原五张图的 YAML/SVG 10 个文件 SHA 全部不变；新图另建，不替换旧图。
- [x] 原 93 条 sources 前缀逐项完全相同；追加 47 条所选证据（94–140），原来源 7 复用于后台循环，不重复追加相同语义旧范围。
- [x] 原全部误解条目、来源对应关系、前后站链接、数字与计算边界保留；差异只有新增，无旧行删除。

机械差异、47 项原文件／摘录 SHA 和合法行范围核验见 `offline-queue-coverage/author.diff`、`author-check.json`。该核验用于证明身份与保留，来源是否支持主张仍需独立审查，不能靠行号检查代替。
