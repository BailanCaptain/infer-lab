# 性能页引用增量与 Super Kernel 呈现独立复核

审查者：`review_first_pages`，2026-11-03。仅验收根代理指定的三份精确差异及必要上下文，不代替整页全部来源核验。

结论：三份增量可接受，没有发现本次修改新增的 P1/P2。

- `inference-performance-analysis-citation-remediation.diff`：完整读取。实际读取 `vllm@ced6857a:vllm/logger.py` 175–218，包含配置冲突、JSON 字典校验、覆盖默认配置以及最后 `dictConfig`；扩展范围准确。实际读取 `vllm@0fc695fc:vllm/entrypoints/serve/profile/api_router.py` 全部 1–46，`profiler_config` 及其 `profiler` 字段非 None 才注册 start/stop 路由；读取同 pin `v1/engine/async_llm.py` 215–253，两条构造路径都把 disable_log_stats 取反后传入。当前教学页 216–263、280–304 的相邻说明已读，补充的来源映射与这些结论一致。没有据此宣称调用路由已经在现场产出 trace。
- `inference-performance-walkthrough-citation-remediation.diff`：完整读取。实际读取 `vllm@ced6857a:vllm/benchmarks/lib/endpoint_request_func.py` 402–434、526–561：ChatCompletion 和 audio 均在非空 choices 分支更新 TTFT/ITL/结束时间，content 可空；usage-only 分支不更新结束时间。当前正文 366–398 已读，修订正确区分 choices 块与有效文本消息，保留原教学时间线和版本边界。没有重验本段未改变的全部 profiler 实现。
- `super-marker-only.diff`：完整读取，并将实际改前文件与当前页比较。差异恰为首段 `[C4][C6][C20]` 和事实表 `[C8]` 四个重复标记删除；事实文字、source 列表、配置条件均未改变。当前 75–133 与 155 行对应段落已读；后文仍在 128/132/133/155 保留相关来源与结论映射，可以接受呈现整理。本项不声称重新审过所有 Super Kernel 源码。

Super Kernel 改前文件采用 CRLF：字节 SHA256 为 `367b5dbf44bb49624d1a5f328bfefb301b28758b98960284db8cd9f002bf33e5`；规范化 LF 文本 SHA256 为 `978e3cf7ead0ab8ae41e094ee1af2c9ecd730db094cfeec4a6899d5c91a8d33f`，后者与作者先前给出的哈希一致。当前页字节 SHA256 为 `ac6685b60429e0257602ba593193f9c015406ee0af39ae6ca1941d4954713601`。

所有固定源码均通过本地仓库 `git show` 实际读取，缓存于 `.tmp/evidence-2026-11-03/groups-01-02/source-cache/`。没有 UI、设备运行、性能测量或图视觉验收。这里只接受引文范围及表述条件，不将静态代码判断扩大为部署保证。
