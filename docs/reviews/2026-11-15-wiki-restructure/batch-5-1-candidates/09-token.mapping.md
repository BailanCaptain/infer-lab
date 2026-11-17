# `token.md` 候选稿三出口事实去向账本（`09-token.mapping.md`）

## 1. 基线与候选文件对齐

- **当前正式文件**：[wiki/concepts/token.md](file:///C:/Users/-/Desktop/infra-view-new/wiki/concepts/token.md)（共 458 行）
- **候选文件**：[09-token.md](file:///C:/Users/-/Desktop/infra-view-new/docs/reviews/2026-11-15-wiki-restructure/batch-5-1-candidates/09-token.md)（共 454 行）
- **Frontmatter 元数据**：`id: token`、`origin: gap`、**66 条 `sources`**（原页 64 条 + 末尾追加 `vllm@0fc695fc` 与 `vllm@568afb3a` 的 `vllm/v1/engine/input_processor.py#L314-L321` 共 2 条以锚定 `seq_len` / `max_tokens` 补齐逻辑）、3 条 `relations`、`verified: [releases/v0.23.0, releases/v0.26.0rc, main]`（保持原值不变）、`evidence: C`、2 条 `rawSources`。
- **跨页锚点保护**：原页全部 **18 个 H2/H3 标题**（9 个 H2 + 9 个 H3）100% 保留（`headersRemoved: []`），确保被 `prefill.md`、`sampling.md`、`embedding.md`、`streaming-output.md` 等引用的 `#生成的编号怎样变回文字`、`#deepseek-recipe控制标记与用户文字怎样分开`、`#落到-glm-双机分词器词表和-r1-的入口`、`#编号要落在-154880-行之内`、`#r1-在入口拿到了什么`、`#怎么开` 等锚点零断链。
- **2D 图与 `calc` 块**：原页 4 处 `wiki-diagram`（`token-intro`、`token-bpe`、`token-split`、`token-entry-flow`）与 3 个 `calc` 块 100% 保留。

## 2. 段落级三出口映射表（保留 / 迁移目标 / 证伪删除）

| 原文位置（`wiki/concepts/token.md`） | 事实 / 数值 / 条件内容 | 出口类型 | 候选稿位置（`09-token.md`）或去向说明 |
|---|---|---|---|
| `L1-L142` | Frontmatter（`id: token`、`title`、`summary`、`aliases`、`chapters: ['01']`、`order: 20`、原 64 条 `sources`、`verified`、`evidence: C`、3 条 `relations`、2 条 `rawSources`） | **保留（原位 + 末尾追加 2 条 `sources`）** | `L1-L144`：原 64 条 `sources` 与 `verified` 100% 保留，末尾追加 `0fc695fc` 与 `568afb3a` 的 `input_processor.py#L314-L321`（合计 66 条 `sources`）。 |
| `L144-L154` + `L159-L171` | `## Token 是什么？` 主干（`token-intro` 2D 图、`[9123, 40517, 2256, 1180]` 教学设定、Token ID vs 序列位置 vs 嵌入向量三行对照表） | **保留（原位）** | `L146-L169`：100% 保留，去掉 `L156` 在首屏中途的插断。 |
| `L156` | 分词器与模型词表大小不一定一致（模型可能留有额外 token、多模态分词器可能带模型词表外的占位编号，判断能否作为输入要结合对应输入处理路径） | **保留（收束至首节末尾）** | `L169`：从 `L154` 与 `L159` 之间收束至 `## Token 是什么？` 末尾（紧接三行对照表总结句之后），100% 保留全部条件。 |
| `L173-L253` | `## 为什么不按整词或单个字切，而要切成子词？`（`24 / 8 / 4` token `calc`、BPE/WordPiece/Unigram）、`## 字节级 BPE 怎样一步步切出 token？`（`token-bpe`、`24 − 16 − 4 = 4` `calc`、「犇」半字字节）、`## 聊天消息：先套模板，再分词`（`token-split`、6 个模板标记中 `<think>` 非 `special=true`、Transformers v4.44 无默认模板）、`## 生成的编号怎样变回文字？` 前半部分 | **保留（原位）** | `L171-L252`：100% 保留全部算例、图引用与条件边界。 |
| `L255-L257` | 流式增量反分词与停止字符串暂留边界，以及因 `stop` 结束且不输出停止内容时可跳过最后 1 个 token 的文字转换却仍将编号追加到内部记录（最终可见文字不足以还原完整输出编号序列） | **保留（原位，主文必要边界）** | `L254`：合并 `L255` 与 `L257` 为一段并**保留在 `## 生成的编号怎样变回文字？` 原位**——因为紧接“生成了 3 个 token，屏幕上的文字只更新了 2 次”的字节攒存表之后，此处正是解释“输出编号序列 ≠ 流式可见文本增量”的核心结论段落。 |
| `L260` | 输入长度 / 输出上限 / 上下文容量区分，以及阅读顺序指引（`按阅读顺序，本页之后接[嵌入](embedding.md)，再回到[模型总览](glm-5-3-flash.md)看这些向量经过哪些层。`） | **保留（阅读指引移至 GLM 主线末尾）** | `L256` 保留三个长度区分；阅读顺序指引句移至 `### 再交给某一个引擎等待调度` 末尾（`L310`），使 GLM 主线走完再引向下一站 `embedding.md`。 |
| `L262-L268` | `## DeepSeek Recipe：控制标记与用户文字怎样分开`（`render_conversation` 返回 `special_ranges`、避免用户文字与角色边界混淆、需绑定配套 tokenizer） | **保留（调整至 GLM 主线之后）** | `L312-L318`：将整节移至 `## 落到 GLM 双机：分词器、词表和 R1 的入口`（`L258-L310`）之后、`## 常见误解`（`L320`）之前，使通用切词与反分词直接衔接 GLM 双机 R1 入口，同时 100% 保留 `## DeepSeek Recipe：控制标记与用户文字怎样分开` 标题锚点与全文。 |
| `L270-L321` | `## 落到 GLM 双机：分词器、词表和 R1 的入口`（`ignore_merges`、BPE dropout 为空、`154880 = 154820 + 36 + 24` `calc`、36 个新增条目仅 18 个 `special=true`、3 个 EOS `154820/154827/154829`、上界 `154879`、`690b7052` + `tokenizers 0.22.1` 真实编码 `16 = 6 + 6 + 4` token、`token-entry-flow`、主机内存 vs 设备内存账） | **保留（前移紧接通用反分词）** | `L258-L310`：100% 保留全部算例、图引用与条件边界。 |
| `L323-L391` | `## 常见误解` 7 条与 `## 对照源码` 前三小节（`### 怎么开`、`### 会报什么错`、`### 开销和什么时候别开`） | **保留（原位）** | `L320-L386`：100% 保留全部参数表、`--limit-mm-per-prompt '{"image":1,"video":0}'`、`enable_mm_embeds` 例外、截断示例与报错原文。 |
| `L392-L427` | `### 版本差异`（原 `L394` 粗体 `v0.30.0rc2` `InputProcessor` 补丁段 + 三张版本表 `输入参数`、`核对项`、`模式集合` + Recipe `935817c6` 与 Mistral Transformers `5.15.0` 门槛说明） | **保留（并入版本核对表并区分核验范围）** | `L388-L421`：将已核对的 `InputProcessor` 输入长度与 `max_tokens` 默认补齐（`0fc695fc`/`568afb3a` 变量名 `seq_len`，`ced6857a` 变量名 `prompt_len` 并新增 `routed_experts_prompt_start` 处于 `[0, prompt_len]`）并入第 2 张 `核对项` 对照表，`main` 列明确标注“本页未单独重核此项”，未单列重核的行明确标示核验范围，不扩写未核结论；其余两张版本表与说明 100% 保留。 |
| `L428-L458` | `### 源码位置`（代码阅读顺序、来源索引与 25 处行内角标 `15 C + 9 S + 1 A`） | **保留（原位 + 补来源 65/66 对应说明）** | `L423-L454`：100% 保留原核验内容，并在 `L452` 补入来源 65、66 与来源 51 对 `InputProcessor` 长度计算与默认补齐的对应说明（行内角标总数 `25 <= 30`，`C` 占比 `15/25 = 60.0% <= 80%`）。 |

## 3. 证伪删除项

- **无（0 项删除）**：本候选稿未删除任何源码事实、公式、表格或适用前提。
