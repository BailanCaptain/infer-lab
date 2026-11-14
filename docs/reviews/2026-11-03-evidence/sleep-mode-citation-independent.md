# Sleep Mode 来源收尾独立复核

root，2026-11-03。完整读取 `sleep-mode-citation-remediation.diff`，并读 rc2 Worker 246–299、sleep_mem_optimized 61–71 / 154–248 / 257–302、配套 vLLM model 342–344。接受本次默认值补齐、范围扩展与来源映射修订，不声明独立重读该页全部 38 项引文。

rc2 的 enable_sleep_mode 字段默认 False；通用字段旁的 CUDA/HIP 注释本身不能证明 Ascend 实现，后者有 Worker 与分配器的实际消费者。wake_up 先检查 NZ、恢复 allocator 和保存的 buffers，再按 RL cleanup 条件调用 manager；manager 先恢复 HCCL 与 MoE runtime，再按图条件恢复图，tags 为空或包含 kv_cache 时才释放生命周期锚点。补出的 243–248 包括真实业务组恢复循环，来源范围足以支持正文的恢复顺序。

与本轮已有 sleep-cleanup 独立记录衔接；没有新增硬件或视觉验收。页面当前 SHA256：`e9a4373c7cdafdb77d5ab798c51b0cb0cc3891ebf78711ff4b1c692a5d66562d`。
