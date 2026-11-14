# Sparse KV offload 本段验收

本段闭合的是一页教学补全、40 个冻结旧来源出现项及 8 个新增补证。不是 40 篇全文阅读，也不是整个缓存组或全站完成。独审见 [sparse-review.md](sparse-review.md)，逐项判断见 [sparse-judgments.json](sparse-judgments.json)。

补齐了原先只有开关、缺少部署前提的部分：旧 main 两侧 MemFabric 与驱动要求、P 侧 Memcache、D 侧 Clang/OpenMP；注册主机内存和连续内存检查入口；每 DP 预算、TP 共享及控制端口的不同计数；rc2 融合的原生接口/注册视图和容量条件；P 端 PP 与 38/40 层边界；921 后续已包含融合接口及默认值变化。

修正主历史与热副本、新 KV 临时设备张量到主机的顺序、单缓存组限制。独审发现的全命中仍必付 H2D、每步/每层同步、prefill 必然掩盖搬运三项 P2 及假设算式标题 P3 均已修订并复核关闭。旧数值、反例与待核保留，见 [保留清单](sparse-preservation.md)。

40 项为：26 有条件支持、3 修正主张、2 补证、2 背景范围、1 归档完整性、6 同版本重复。新增 8 项分别判断；不重复计入前批 500 或 221 个旧补证。活动旧队列由 1113 减至 1073，仍包括 221 个旧补证的最终账本工作；这个数不是全站未读篇数或完成率。

本轮五项检查：`pnpm check:content`、`pnpm wiki:audit`、`pnpm wiki:diagrams --check`、`pnpm build` 通过；`pnpm wiki:lint` 仍为用户暂缓 Chunked Prefill V2 的 3 处阻塞，另有原 9 项非阻塞提示。审计 164 页/6732 来源，6329 个本地行段有效、403 URL 未由该机械检查联网、2987 raw 待机械匹配；104/104 强制写作标准页通过。语义结论来自逐项核对，不来自机械计数。命令与退出码见 [sparse-verification.json](sparse-verification.json)。

写手在 Chromium 实际查看两屏、两张 SVG、5 表、2 算式、6 个新增段落截图，并点击设备预检、PP、CPU offload、抢占卸载四条链接；无 pageerror。修改后重新生成流程 SVG 和站点索引，复看第二屏、流程图、假设算式及版本/部署段。独审另行打开同页并操作三条链接，未发现裁切、重叠或导航错误。证据在 `.tmp/continuation-groups-2026-11-10/browser/sparse*` 和 `sparse-independent/`。

学习路径已能回答：为何 A2 GLM 基线不能照抄；同机 D DP2/TP8 为什么内存预算是 256 GiB 而端口是 16 个；为何普通 CPU 内存与注册视图不同；P 可 PP 不代表 D 可 PP；哪些是旧 main、rc2 与后续默认。固定 GLM 的 3.75 GiB/3 GiB 算例仍明确是不受支持布局的假设。

环境无 NPU，未验证实际注册、命中率、带宽、时延和融合精度。官方设计文档、RFC 与原图阅读范围另见 [sparse-official-reading.json](sparse-official-reading.json)；扩展阅读不冒记成本页引文数量。没有需要用户重新决定的问题，继续逐层卸载、KVPP/UCM 等缓存余项。
