# 679 分块预填充候选返修事实复审

2026-11-16，砚砚独立核验。承接用户恢复请求 `678`、返修派工 `680`，闭合 `668/672` 事实审查和 `671` 同轮重叠问题。本记录审定磁盘候选实物，不代替真实写管线的语义回执与整组 Review 发布。

## 结论与审定对象

**038 事实复审 Approved：0 P1 / 0 P2。** `039` 新旧讲法与 2D 复审仍由烁烁独立完成；正式知识库尚未发布该候选。

| 产物 | SHA-256 |
|---|---|
| `candidates/01-chunked-prefill.md` | `0370306fb60f343548703a516fee1aa7c9045e1252a0df37a27d6d1bcfd47cbe` |
| `candidates/01-chunked-prefill.mapping.md` | `10cdfeacde3b2158e740b6aed59b086453fe99745eede3462df509a230777f6f` |
| `candidates/chunked-prefill-flow.yaml` | `adfd77160698331c03dde8a2ce823df42c31ede2a6186501ceaaaa2b54855efd` |

工作区 Git HEAD 是 `f44c953f99e416b2dc174c3b2ad31a729b91d30f`，候选属于未提交改动；本结论绑定上表文件摘要，不能解释为对整个 HEAD 或工作区的批准。

## 三项返修闭合

1. **伪代码字段、简化前提和前推顺序**（正文 L179–L208）：不存在的 `num_computed_tokens_target` 已移除，等待新请求采用 `req.num_tokens`；`num_tokens_with_spec` 的含义在代码前解释。明确省略缓存命中、异步输出占位与借块回退，并设置 `num_output_placeholders = 0` 的简化前提。先记录请求步前位置与本步排入数量，整步计划形成后统一前推已算数、更新 `is_prefill_chunk`。已重新读取 `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py` L403–L410、L678–L700、L997–L1019，与此教学范围内的真实顺序一致；它仍是机制伪代码，不冒充完整可执行调度器。
2. **映射说明与实物一致**：正式图为 41 行，前置提炼归属 Task 558；四个 calc 的原始数字、五缓存组借还账、实际新增来源 52–56、真实标题和 `refresh_block_size` 的文件归属均已校准。正文仅改伪代码及其引导说明，其他已审段落未出现额外改写；4 个 calc 块逐字一致，原 51 条 sources 保持前缀顺序不变。
3. **流程图语义与连线**（YAML L8–L27）：先保存步前计划，位置与执行标签准备完成后，完整输入共同连入普通/线性注意力两类前向；两类前向均有出口，沿右侧汇合后从顶部进入采样。采样从左右两侧分流，原来与入线反向共线、看似绕过采样的路径已消除。未追平分支只标本例第 2 段末 `12 < 14`，不再误标为第 1 段。Chromium 截图实际检视可确认普通注意力没有断头、输入不再割裂、连线不穿字。

## 本轮实际验证

- `node --import tsx %TEMP%/infra-wiki-review-20261115/679-chunked-mechanical.mts`：exit 0。56 条来源中 55 条本地源码/快照通过，1 条外链标为 URL（不把它宣称为本轮联网验证）；页面解析、写作硬检查、图布局检查、图中源码 pins 检查均无问题。
- 相同检查确认 `id / verified / relations / rawSources` 与正式基线相同，全部既有 H2/H3 保留，4 个 calc 与冻结 `inference-mechanism:7` 围栏逐字一致。
- `node --import tsx %TEMP%/infra-wiki-review-20261115/679-chunked-prefill-preview.mts`：exit 0。仅在隔离副本覆盖候选与确定性生成 SVG，实际构建、启动短时预览、用 Chromium 打开文章并点击源码折叠区；两个图渲染成功，默认折叠及手动展开正常，页面宽 1440，无页面异常或 KaTeX 错误。图 2 截图已人工目视检查。
- 机械检查记录：`%TEMP%/infra-wiki-review-20261115/679-chunked-review/mechanical.json`。
- 浏览器证据目录：`%TEMP%/infra-wiki-review-20261115/679-chunked-prefill-preview-NPS3vW/`，含 `preview-check.json`、`chunked-prefill-diagram-1.png` 与伪代码截图。测试预览服务已关闭；未改动已有 4173/4174/4196 服务。

## 范围与下一步

没有修改正式 `wiki/`、生产代码、冻结 3D 或 210 次模型调用缓存。本轮仅完成独立事实复审；需要继续原 `039` 对比审查，以及修复 `649` 后通过真实整合、独立语义复核和整组 Review 发布。没有需要用户追加决定的问题。
