# 证据核查与审视口径修正（2026-09-16）

继续在 `infra-view-new-llm-wiki / feat/llm-wiki` 工作；最新一轮已发布用户批准的显存预算修订，未调用收费模型、未导入批量内容、未提交。依据用户反馈，先将原理解释、证据归属、措辞精确度和真实事实错误分开。

## 审视标准与已撤回的提案

- 合理的原理推导保留，写清必要前提；单个测试没覆盖不等于原理被推翻。
- 原始资料格式不符合检查器预期，不等于资料缺失，更不等于知识错误。
- 只有源码或可靠材料直接反驳已有结论时，才作为实质纠错；普通措辞问题不阻断主线。
- `dd3bf215fb029b5c8f3ddcc13d3defb9866e6fea19f89331753c66b5baba434c` 已通过统一 review 入口标 rejected：它用测试边界说明取代前缀缓存原理，教学处理不当。正式 Prefix Caching 页未改；不再要求用户批准该包。更早两个版本也没有发布。

## 107 条旧 raw 提示的本轮逐条核查

输入沿用 `tools/wiki-runtime/legacy-raw-review.json`；读取原始 raw 并与每条引用的 Git commit blob 比较，未重写原 raw。结果及哈希在 `tools/wiki-runtime/legacy-excerpt-comparison.json`，脚本 `review-legacy-excerpts.mjs`。它是本次核对记录，不冒充历史 agent 读取回执，也不证明整篇正文所有结论正确。

| 结果 | 条数 | 解释 |
|---|---:|---|
| 原摘录与对应源码范围一致 | 99 | 仅统一换行和末尾空白；内容逐字对应 |
| 原摘录是引用范围内的连续原文 | 1 | 合法局部摘录 |
| 自动比较存在差异，逐项阅读如下 | 6 | 不能直接算六条事实错误 |
| URL | 1 | 已实际打开，当前可访问；不等于验证历史快照 |

六项阅读结果：

1. Block Table 的 `utils.py#L1167-L1181`：raw 多摘了紧接着的 `return`（L1182）。属于引用范围少一行，未发现这处正文原理错误。
2. Block Table 的 `ModelRunner_prepare_inputs.md#L153-L196`：raw 省略部分解释和展开算式，保留公式与结果；应视为整理后的摘录，不称逐字全文。
3. fuse_allreduce_rms 的 `ascend_config.py#L403-L406`：raw 实际对应 L404–L407，起止偏一行；字段内容存在，未发现这处字段结论被反驳。
4. layer_sharding 的 `platform.py#L338-L346`：raw 额外含上一行 `@classmethod`；不是内容缺失。
5. layer_sharding 的 `linear_op.py#L712-L724`：raw 在 down_proj 分支省略了 `and not is_moe_layer(prefix)`，确有摘录差异。正式该页讨论的是随后/之前的 o_proj 分派，检索正文没有 down_proj、mlp_tp、is_moe 的相关论断；不能据此推翻该页的 o_proj 说明。保留原 raw，后续编译这段分派时应以完整钉定源码为准。
6. layer_sharding 的 feature guide：raw 保存了启动命令，但嵌套同长度 Markdown fence 使本次提取器提前闭合；直接读取 raw L343–L362 可见命令，不是原材料缺失。

URL 为 [CPU Offload 官方说明](https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kv_cache_cpu_offload.html)。当前页面可访问，其 latest 内容已有多层卸载等新内容，不拿最新页面冒充旧版本证据。

现有 `wiki:audit` 只识别同版本完整引用串，因此仍会报告 107 条结构上的 raw 待核对；本轮没有放宽检查器或改旧 raw 来消掉数字。后续以“结构提示 + 本轮比对记录 + 正文语义检查”分别看待，不再把这 107 条统称缺失记录。

## 实质纠错：显存预算与上游的错误对比

**P2，`wiki/concepts/kv-cache-memory-profiling.md:49`**：原文“昇腾侧和上游的关键分歧在分母”会让学习者误以为上游按启动时空闲显存计算预算。

实际反证：`git ls-remote https://github.com/vllm-project/vllm.git refs/tags/v0.23.0` 返回 `0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665`。下载该固定提交的 [worker/utils.py L405–L425](https://github.com/vllm-project/vllm/blob/0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665/vllm/v1/worker/utils.py#L405-L425)，`request_memory` 同样计算 `total_memory * gpu_memory_utilization`，再用 free_memory 检查是否足够。昇腾 pin 的 `worker.py` 也使用 total_memory。

仅替换这个错误对比为“这里的预算按整卡显存计算，上游 vLLM v0.23.0 也是这样算的”，附新的固定源码依据；保留正确公式、例子与原结论历史。不引入额外推理环境、不运行性能测试。

用户批准后已发布 `e6061568bf6f6a08bac26cb5c95c07e877df66e930f43a76e207f0cf996b16d5`，日志 `tools/wiki-runtime/memory-approved-publish.log`。新来源保存为独立快照，同时原 raw 另存不可变归档；不是回填历史。

首次发布旧包 `18039172…` 时，生产校验发现“旧文来源”错误包含新加的第 22 条来源并拒绝写入。这暴露了上一轮验证的局限：本地生成器修改 gray-matter 共享解析缓存，同进程生成及校验未发现污染，独立进程发布才发现。修正生成器为独立解析后重建，独立进程逐字比较证明正文与修订决策完全相同，唯一差异是删除错误的旧来源第 22 条。旧包已 rejected；沿用用户对同一内容的批准，生产完整校验及正式写入成功。证据 `tools/wiki-runtime/memory-rebuild-verification.json`，未放宽校验或改生产实现。

发布后 `pnpm wiki:eval --phase before` 返回 prepared-only：既定六场景的 6 项来源验证通过、19 页知识快照准备完成、模型调用与费用均为 0。日志 `tools/wiki-runtime/post-memory-eval-precheck.log`；这只是预检，六题答案仍未验证。后续核清费用后，先做独立前测，再编译 `profiling_chunk_config` 材料、审阅发布并独立后测；不把材料整理或页数增加当作效果通过。

## 仍未通过的验收

发布前一轮核对：`pnpm wiki:lint` 通过，`git diff --check` 无空白错误（既有 CRLF 提示保留）；34 条 AC 完整、80 个本地链接无断链。`tools/wiki-runtime/evidence-review-final-check.json` 是当时 pending 状态的历史记录，不能用作当前发布状态。6 份旧 raw 哈希未改；19 页 schema 问题为 0。共享账本仍为 paused，占用 $8.9027865，calls=1，未新增调用。

发布后再次核对见 `tools/wiki-runtime/memory-publication-verification.json`：published、所有正式写入与批准包逐字一致、旧 raw 未改、34 条 AC 完整、19 页 schema 问题 0；当时 80 个本地链接无断链。`pnpm wiki:lint` 通过，`pnpm build` 通过（2.57s，`memory-publication-build.log`），`git diff --check` 无空白错误。预算暂停与累计占用不变。

本轮是证据和内容抽查，不是 19 页逐句全面语义验收，也不是真实问答前后对照。生产 03:00 维护的最后一次记录仍为失败，修复后尚无新到点结果。共享预算仍因未知费用暂停；三项批量工作仍未执行。工程全量测试的 638 项通过属于上一轮记录，本轮不冒充重跑。
