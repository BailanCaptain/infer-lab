# 未被正式页面引用的图（2026-10-05）

初次盘点：299 份 YAML 中，11 份没有被 143 个正式页面引用。用户随后授权“没用的就删除掉”；逐一核对现有内容后，已删除以下 11 份 YAML 和同名 SVG，共 22 个文件，剩余 288 张图。正式页面未修改。

## 扫描口径

用现有 loadPages 和 diagramRefs 读取正式页面与 wiki-diagram 围栏；diagramRefs 会统一去掉 .yaml/.yml/.svg 后缀。再扫描草稿、源码、脚本与测试里的图文件引用。历史计划和评审提及保留为历史记录，不视作阅读页引用。诊断脚本在 tmp/inventory-diagrams-1005.ts，结果在 tmp/orphan-diagrams-1005.json。

初扫误列的 layers 系列 5 图、rfork-config-ports、rfork-troubleshooting 实际仍有带 .yaml 后缀的正式引用，已排除。

| 图 ID（wiki/diagrams/ 下同名 YAML + SVG） | 原图图注 |
|---|---|
| `ai-qos` | 固定 db701c1f 的默认 SDMA 映射；端点写入和交换机命令是两部分操作，图不表示所有 NPU 的网络拓扑 |
| `epd-disaggregation` | E+PD 只分离编码器，E+P+D 进一步分离语言模型两个阶段；编码结果与模型历史状态不同 |
| `flash-attention-3` | 8×8 分数关系与 2×4 工作块；分块改变中间结果存放方式，仍处理所有有效位置 |
| `one-request-block` | 一个块有 2048 个位置，这条请求的 237 个 token 只用掉开头一小片 |
| `one-request-layers` | 40 层里只有每第 4 层是全注意力，其余 30 层是线性注意力 |
| `one-request-memory` | 一条请求在一颗 NPU 上占的两块地方：注意力的笔记很小，线性注意力的状态大得多 |
| `ownership-boundary` | 从调度计划到设备状态：上方是每轮接口交接，下方展开资源记录、执行映射与缓存张量的对应关系；颜色表示数据语义 |
| `paged-attention` | B=4 的普通分页示意：请求 A、B 的逻辑顺序由块表保存，物理块可以分散；图中无共享、无额外预留 |
| `patch-inventory` | v0.23 维护分支上的 59 个补丁文件，一格一个文件（v0.26 分支上是 64 个） |
| `rfork-memory` | 教学地址：权重 W 只占分配块里的一小段；登记时同时写下 W 自己的范围和它所在的整块 |
| `superpod` | 两台服务器仅为位置示意；远端状态经过互联到达使用位置，内存池化软件提供统一访问与对象接口 |

## 内容核对与删除依据

- `one-request-block` / `one-request-layers` / `one-request-memory`：旧 2048/237、40 层和显存数字不适用于当前 GLM 主线；当前 `wiki/concepts/one-request.md` 的请求、块分配、逐层前向和收尾已有完整说明及现用图，不迁回旧示例。
- `ai-qos`：`wiki/concepts/ai-qos.md` 的“交换机映射队列”“设置服务先后”及现用 `ai-qos-intuition`、`ai-qos-flow` 已覆盖源标签、初始 VL、目标 VL 和优先级，并保留版本差异。该页面仍存在，只删除同名旧图。
- `epd-disaggregation`：`wiki/concepts/pd-disaggregation.md` 的“带图像的请求：再把编码器分出去（EPD）”已解释 E+PD / E+P+D，以及媒体表示和语言模型历史状态的区别。
- `flash-attention-3`：`wiki/concepts/attention-backend-family.md` 的 FA3 一节已保留分块、在线归一化统计与输出累积、避免完整矩阵写回的机制，以及硬件与适用条件。旧图的 8×8 / 2×4 是可舍弃的教学尺寸，不是部署事实。
- `ownership-boundary`：`wiki/concepts/request-call-chain.md` 的进程、通道与逐站函数图，以及 `wiki/concepts/block-table.md` 的分配、映射和实际读写说明，已覆盖旧图的职责划分；KDA 与 MLA 的布局差异由现有请求主线说明。
- `paged-attention`：`wiki/concepts/block-table.md` 与现用 `block-table`、`block-table-flow` 已覆盖逻辑顺序、物理块号和槽位映射，旧 B=4 的独立示例无需重复保留。
- `patch-inventory`：`wiki/concepts/ascend-patch-system.md` 的版本表保留 platform / worker / patch_v2 的 28/24/7、31/24/9 等计数及统计口径，比旧图的 59/64 总数更完整。
- `rfork-memory`：`wiki/concepts/rfork-transfer.md` 的“第一步：先把 B 的空位登记给传输引擎”保留完全相同的示意地址和计算：逻辑范围 (1128,128)、支撑范围 (1000,1024)，并解释生命周期与登记约束。
- `superpod`：`wiki/concepts/hardware-devices.md` 保留物理位置与统一编址的区别、MemFabric / MemCache 分层和本部署未启用的边界。

删除前重跑引用盘点，11 张候选仅有历史计划/评审提及，没有正式页面的图引用。历史记录保留，便于追溯。删除后验证结果见下节。

## 删除后验证

- 引用盘点：288 份 spec，未引用候选为 0。
- `pnpm wiki:diagrams --check`：288 张图与 spec 一致；保留既有非阻塞代码名提示，日志 `tmp/orphan-cleanup-diagrams.log`。
- `pnpm wiki:lint`：通过，保留既有 4 处 mark-flood 提示，日志 `tmp/orphan-cleanup-lint.log`。
- 图规格、CLI、引用审计的 3 组测试：16/16 通过，日志 `tmp/orphan-cleanup-tests.log`。
- `pnpm build`：含 TypeScript 检查的生产构建通过，日志 `tmp/orphan-cleanup-build.log`。
- 本轮只清理未引用资产及进度记录，未修改阅读页面；没有重跑整个 feature 的全量 E2E，不能据此宣布 P6 整体验收完成。
