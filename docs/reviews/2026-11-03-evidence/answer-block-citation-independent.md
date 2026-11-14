# 旧块分配问答增量独立复核

root，2026-11-03。完整读取 `answer-block-citation-remediation.diff` 与关联段落，实际复核新增来源 20–26 及扩展后的来源 10、12 全函数。接受本次范围修正与来源补齐，不把历史问答当成独立机制证据。

旧默认 16、生成模型的 chunked prefill / prefix caching 例外、block table int32、EngineCore → Scheduler → KVCacheManager 的所有权链均有实际代码。v0.26/main/rc2 的 cache_partial_block 操作传入块的哈希与事件元数据，没有分配或复制新的 KVCacheBlock；rc2 的替换旧哈希分支及 null / 对齐条件也已读。rc2 free_blocks 先分流其他 pool 的块，只有 ref_cnt 为零且非 null 才按有无哈希与 caching 条件入队。页面将“下一请求立刻取走”修正为队头优先，避免忽略其他请求操作。

接受范围仅为增量，保留旧单卡、全注意力、无命中与无额外预留的算例前提。没有运行 NPU 或将块号当作实测。当前页 SHA256：`7497d9087c551cb33c08b450ae2d4cc75d4a438951191c34d7280b9461654920`。
