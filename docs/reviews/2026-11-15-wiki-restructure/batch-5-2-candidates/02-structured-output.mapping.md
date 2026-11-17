# 02-structured-output.md 映射与核验台账

- **源页面**：`wiki/concepts/structured-output.md`（810 行）
- **候选文件**：`docs/reviews/2026-11-15-wiki-restructure/batch-5-2-candidates/02-structured-output.md`（807 行）
- **Frontmatter & Citations 盘点**：
  - `id: structured-output`，`type: feature`，`origin: direct`，`chapters: ['17']`，`order: 60`，`sources: 171 条`（`L63-L254` 逐行 100% 保留），`verified: 3 项`（`releases/v0.23.0`、`releases/v0.26.0rc`、`main`，`L255-L258` 100% 保留），`evidence: C`，`relations: 6 条`（`L260-L278` 逐行 100% 保留）。
  - 图表与算式块：2 处 `wiki-diagram`（`structured-output` `L294-L296`、`structured-output-flow` `L333-L335`）与 2 个 `calc` 块（`GLM 的一行 bitmask 和整块缓冲` `L357-L364`、`昇腾 V1 每张卡为 bitmask 搬的 logits` `L384-L389`）逐字 100% 保留。
  - 行内引用标签：共 `17` 处（`2` 处 `[S...]`：`[S1]`、`[S35]`；`1` 处 `[A]`；`12` 处 `[C...]`：`[C18]`、`[C3]`、`[C27]`、`[C2]`、`[C6]`、`[C7]`、`[C10]`、`[C4]`、`[C5]`、`[C23]`、`[C9]`、`[C24]`；`2` 处 `[D]`），全部位于 `### 源码位置`（`L784`、`L796-L797`），100% 保留。
- **H2 / H3 锚点核对（`headersRemoved: []`）**：
  - 原文全部 8 个 H2 与 13 个 H3（共 21 个标题）原样保留，未删改任何标题文本。

## 段落级重排与反引号恢复映射表

| 原文行号（`wiki/concepts/structured-output.md`） | 原文内容摘要 | 候选文件行号（`02-structured-output.md`） | 变更说明 |
|---|---|---|---|
| `L1-L282` | Frontmatter（含 171 条 `sources`、3 项 `verified`、6 条 `relations`） | `L1-L282` | 逐字 100% 原样保留 |
| `L284-L328` | `## 结构化输出怎样让模型只写出合法格式？`、`## 为什么需要它，代价在哪？` | `L284-L328` | 原样保留全部叙述与 `structured-output` 2D 图，按语义恢复被旧 `maxInlineCodePerK` 卡尺剥离的 JSON 字面量与标识反引号（`{"ok": 值}`、`null`、`{"ok":`、`␣false`/`␣null`/`␣true`、`{"ok": true`、`01010010`、`-1`、`reasoning parser`、`tool-call parser`） |
| `L345-L455` | `## 放到 GLM 双机：一个带 JSON schema 的请求走一步`（5 个 H3 步骤）与 `## 思考阶段、异步调度与收尾有什么不同？`（3 个 H3 子节） | `L329-L439` | 前移紧接在 `## 为什么需要它，代价在哪？` 之后，让读者先走完 GLM 双机五步主线与思考/异步/收尾机制；原样保留 `structured-output-flow` 2D 图与 2 个 `calc` 块，恢复 `response_format`、`json_schema`、`xgrammar`、`guidance`、`llguidance`、`outlines`、`lm-format-enforcer`、`auto`、`StructuredOutputManager`、`external_launcher`、`--max-num-seqs`、`fp32`、`torch.compile`、`enable_thinking`、`enable_in_reasoning`、`glm45`、`glm47`、`glm4`、`include_reasoning=false`、`reasoning_ended=True`、`max_tokens`、`eos_token_id`、`special` 等反引号 |
| `L329-L344` | `## 协议接受了 schema，是否就已经约束采样`（DeepSeek Recipe 边界）与 `## 工具调用能解析出来，就说明参数符合 schema 吗？`（工具解析与 schema 约束边界） | `L440-L455` | 归置到双机五步主线与思考/异步/收尾之后、`## 常见误解` 之前（`L452` 随位置变化将“旧 GLM 解析器的例外在下文说明”同步为“旧 GLM 解析器的例外在上文说明”），恢复 `check`、`ok`、`{"ok":"yes"}`、`required`、`response_format.json_schema.strict`、`tools[].function.strict`、`tool_calls` 反引号 |
| `L456-L469` | `## 常见误解`（11 条） | `L456-L469` | 11 条常见误解全部保留，恢复 `reasoning parser`、`auto`、`glm45`、`enable_in_reasoning`、`StructuredOutputManager` 反引号 |
| `L470-L714` | `## 对照源码` → `### 怎么开`、`### 会报什么错`、`### 开销和什么时候别开` | `L470-L714` | 完整保留全部请求示例、配置表格、报错矩阵与开销说明，系统恢复被剥离的字段名、配置键、环境变量（`VLLM_XGRAMMAR_CACHE_MB`、`VLLM_USE_V2_MODEL_RUNNER=1`、`VLLM_ENFORCE_STRICT_TOOL_CALLING`）、CLI 参数与报错短语反引号 |
| `L715-L763` | `### 版本差异`（含 `L717` `**v0.30.0rc2 配套上游调整了推理结束与草稿约束的交界。**` 补丁段与三张四版本对比表） | `L715-L760` | 将第一张四版本对比表中的控制流拆分为“上游控制流（并行门槛与缓冲尺寸）”（`L720`，四版相同）与“推理结束与草稿约束交界”（`L721`）两行：在 `v0.30.0rc2` 列完整并入原 `L717` 的约束起点计算与草稿截断/回滚说明，在 `固定 main` 列明确“按固定实现理解，不沿用 rc2 的约束起点计算说明（现有来源 38 仅覆盖 `84030bbe` 的 `#L60-L243` 并行门槛与缓冲共性）”，并在表下说明（`L727`）并入组合精度待核与 Recipe `935817c6` 边界；保留全部三张四版本对比表与 XGrammar `5433fdbe` 说明 |
| `L764-L810` | `### 源码位置`（12 行源码定位表、检索名称、正文与新增参数证据索引、推导口径、待核项及来源 44–45） | `L761-L807` | 完整保留全部源码位置、17 处内联引用标签、1–171 来源索引与 4 条待核项，恢复代码标识符反引号 |
