# Copy-SFA / overlap 引文修订独立复核

审查者：`/root/review_first_pages`。日期：2026-11-03。范围仅作者提供的两份精确增量、改动所依赖的原始来源与邻接正文，不替代作者的两页逐项来源账本。未修改教学页；未运行 NPU、浏览器或视觉验收。

## 结论

两份增量接受。旧 overlap 的“不搬了”核心机制错误已改为未命中 KV 仍从主机搬入、计算流水化并更新 Selection Cache。Copy-SFA 的主要阶段数与实际 kernel 启动数分开，主开关关闭前仍校验配置、rc2 原生构建依赖及回退状态重置均有固定来源支撑。

复核另发现两处邻接 P2，作者已修改，审查者实际复读后关闭：

1. `use-fused-overlap-75a180fff6ab.md` 的摘要原先仍写“命中时由融合算子直接读主机池”，现已与正文统一为未命中搬运与缓存更新，避免把设备命中也解释成主机读取。
2. `fused-op-type-fc0f5fcd7be0.md:163` 的旧 C8 注释原先没有就地标明历史快照，现限定 `4ebb3090`，并明确 rc2 支持 int8 LI C8；C8 不是第三个枚举值。容量演算仍按旧快照保留。

## 实际读取范围

完整读取 `fused-op-citation-remediation.diff`、`overlap-citation-remediation.diff`，并在末次修复后复读两处落盘。读取两页 frontmatter、修改正文及相邻条件（overlap 168–243，fused-op 101–190）；未将未改动的全部历史谱系重新认证。

- `vllm-ascend@baa023ad` 原生 overlap README **全文 1–228**：Full/Selection KV、原位状态更新、数据类型、TopK、token 级模式和容量约束。产品支持表没有被当作整套服务支持承诺。
- 同 pin `fused_sparse_attention_overlap_kernel_mla.h:795–907`：完整分段计算/预取流水；`fused_sparse_attention_overlap_service_vector_mla.h:2493–2683`：完整选择缓存回写路径。KV 合并、依赖等待和设备缓存写回都有实际代码，不能解释成取消主机搬运。
- 同 pin `sfa_kv_offload.py:500–582,865–999`：选择状态分配、捕获中拒绝重分配、实际融合调用与输入校验。
- 同 pin `sparse_kv_offload_manager.py:473–554,720–860,1068–1120,1338–1477`：rank 0 共享主机池、注册时创建流/元数据、BF16 主 KV 检查、非 rank 0 恢复视图、捕获副流与非捕获同步计划条件。
- 同 pin `ascend_config.py:1467–1525,1570–1612,1640–1685` 和 `config_utils.py:31–50`：先构造子配置再看 enabled；Omni 顶层未知键过滤不适用于嵌套拼写错误。
- `vllm-ascend@2ed6cbba:ascend_config.py:1040–1100`：旧版逐字段读取，不消费新增字段。
- `vllm-ascend@4ebb3090:ascend_config.py:1620–1700`：旧 C8 注释、枚举/互斥先校验、enabled 后的能力和容量约束。
- 同 pin `sfa_kv_offload.py:269–302,645–783`：本次 bank 驻留历史和层内复用计数分别重置，LIM/Copy-SFA 外围仍有准备/拷贝分支。
- `vllm-ascend@7d825229:ascend_config.py:1693–1731,1757–1764`，`sfa_kv_offload.py:714–787,1625–1674`，`worker/v2/model_runner.py:372–403`：rc2 枚举、int8 LI C8 实际分支、纯 prefill / mixed batch 分流及 V2 初始化。
- 同 rc2 官方 Layerwise/Sparse KV 指南 **145–172、320–342**：原生扩展依赖、注册主机视图、LI C8 int8 与新版容量边界。这里只声明读取这些完整相关段落，不称全文读取指南。
- [PR #14957](https://github.com/vllm-project/vllm-ascend/pull/14957)：本轮打开并读取合并信息与作者正文 107–328，确认 2026-09-07 合并、用途与测试说明。作者的测试日志不冒充本项目执行结果。

## 最终文件哈希

| 文件 | SHA-256 |
| --- | --- |
| `wiki/params/use-fused-overlap-75a180fff6ab.md` | `1e7e9375f85973cef99b0d0fb48caba3c91ba5b388f919e7b24a47b93603e0a5` |
| `wiki/params/fused-op-type-fc0f5fcd7be0.md` | `9f0c727b9585d44c572f87877084308ab2de87fb3ba256db97793d82e9bd649c` |

未发现本次增量仍需处理的 P1/P2。实际时延、流量、峰值内存及目标硬件兼容性仍是运行验证边界；没有把源码路径核验当成部署验证。
