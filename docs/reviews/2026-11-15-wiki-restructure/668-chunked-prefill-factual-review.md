# 668：分块预填充候选稿独立事实与浏览器审查

审查人：砚砚（gpt-6-astra）。审查日期：2026-11-16。接受来源：线程 `thread_owned_956487d4f9f669c9e3c9c671b6bbd04ba9e56150`，交付消息 `0001794795803069-000664-2cc99e51`。

**结论：Changes requested，0 P1 / 3 P2。** 本记录只证明编辑候选审查，不是写管线的独立语义封存回执，不代表正式发布。当前并行轮不发起跨猫路由；串行续接时将下列意见与教学审查 `0001794796406462-000671-21b36b69` 合并为一轮返修。

## Why：实际讲法必须与固定源码和审查映射一致

新版补全了两队列调度、段末采样丢弃、普通/线性历史接力及执行标签的单位置尾段反例。问题集中于新增伪代码、映射说明和新图连线，不要求推倒已正确的正文。

## What：待关闭的三项 P2

1. **P2：伪代码使用不存在的属性，且省略项没有说明适用范围。**
   - 位置：`candidates/01-chunked-prefill.md:181–201`，尤其 L184、L189、L193、L200。
   - L193 的 `req.num_computed_tokens_target` 在固定 `vllm@0fc695fc` 中不存在。实际 `scheduler.py:680–699` 用 `request.num_tokens - num_computed_tokens`，局部已算数还承接本地/远端缓存处理；不是新的请求属性。
   - L184 的真实对应式在 `scheduler.py:403–410` 是 `request.num_tokens_with_spec + request.num_output_placeholders - request.num_computed_tokens`。省略异步占位项必须明确限制为无异步占位的简化示意，或保留真实项并解释，不能把省略后公式写成通用两队列算法。
   - 先后顺序也应明确：`scheduler.py:997–1013` 要求先保留本步输出中的旧进度、再统一推进已算数；目前两处直接在循环内递增，未表现这个前提。可用注释说明省略了计划生成、借块与入队，避免读者拿步末值编本步位置。
   - 收口方式：使用真实字段并解释 `num_tokens_with_spec`，给简化前提一句话；保留“步前位置 → 本步计划 → 已算数前推”的顺序。无需展开全部调度器。

2. **P2：映射说明混入不存在的章节、算式、来源及基线信息。**
   - 位置：`candidates/01-chunked-prefill.mapping.md:4–5,20–26,33–37`。
   - 正式旧图实际 **41 行**，SHA-256 为 `54d5a06b118b1c0dbff67b6abda2a76949964df58a21ac9f9af3118f88c632b6`，不是 L4 的 67 行及另一摘要；提炼任务是 `558`，不是 `043`。
   - L21–24 的算式说明与实际四个 calc 不符：第一个是“16 与 8”的单步量对比；第二个是历史范围 `6+12+14=32` 与 `105` 个因果位置对；第四个是 `8144/8144/3712` 对应的借块账，不能写成 `8190+8190+3620`。
   - L26 的新增来源说明错误：真实 sources 52–55 为 `single_type_kv_cache_manager.py` 四段，56 为 `7d825229` 的 batch invariance 文档；并非此处宣称的 scheduler/compilation/采样/状态机新增锚点。
   - L33 的“前两段不进采样”直接违背正文 L120、L161、L214、L320 及固定 runner：中间段照常采样，随后丢弃，带种子的 RNG offset 回拨。亦不能写预算变小必然增加步数。
   - `## 先跑一遍…`、`## 带着问题去看别的机制` 不在当前稿；`GDNAttention refresh_block_size` 也不是正文里的函数归属，实际是 `vllm_ascend/utils.py`。
   - 收口方式：只按本轮实际文件、diff 与固定源码更新映射；不要从撰稿计划反推“已经实现”的事实。正文相应位置大多正确，无需跟着错误映射修改。

3. **P2：新图的输入/输出连线会误导控制流，并混用了第 1、2 段的进度。**
   - 位置：`candidates/chunked-prefill-flow.yaml:13–25`，特别是 `items[4]`、`items[7]`、`links[5]`、`links[7]`。
   - Chromium 实图确认：普通注意力前向框没有接向采样的出边；准备位置/执行标签又各自只连接一种注意力，易让读者误以为两类层只需一半准备结果。
   - `links[5]` 向左进入采样与 `links[7]` 向右离开采样，在 `y=265, x=588..670` 反向共线重叠，看起来可从前向直接下行交付输出，绕过采样。
   - `items[7]` 写“第 1、2 段：12 < 14 / 下一步从 12 续排”，但第 1 段末是 `6 < 14`。本图已声明演示第 2 段，收口为“本例第 2 段末：12 < 14”即可。
   - 收口方式：两类前向共享完整输入准备、清楚汇入采样，再独立分流；避免入口和出口共用反向线段。按实际图复验，几何检查不能替代流程语义审查。

## Evidence：本轮实际验证

- 候选正文 SHA-256：`8ab65bb3bdc6cc3216ec513ba4471e5e800da87b78c386926ebcacf238bcd221`（359 行）。
- 候选映射 SHA-256：`040937fcc04f8ab2e91479f0ae8664fc0165f534923bc5327752ac25b8953017`（37 行）。
- 候选新图 SHA-256：`6c9ef2d1eaf22fb46c031013f444a020354983f0ac718d436cd6c25994d9111e`（36 行，888×424）。
- 原正式正文 SHA-256：`54c0fce9a21c9de8cd99865da3ded8df39d8a1345bb63690d0a4afd33d94ce19`。
- `%TEMP%/infra-wiki-review-20261115/668-chunked-mechanical.mts` 实跑 exit 0：parse、写作硬检查/建议、figureProblems/figureAdvisories、diagramAudit 均空；56 条来源中 55 条本地校验通过、1 条 URL（URL 未作为本轮新增结论依据）；原 51 条来源前缀、id/verified/relations/rawSources、冻结 wiki-scene、4 个 calc 块全等，旧 H2/H3 无删除。
- 固定 Git blob 实读：`vllm@0fc695fc:scheduler.py:340–420,650–704,997–1020`；`vllm-ascend@db701c1f:model_runner_v1.py:1444–1471,2628–2645`。`git grep num_computed_tokens_target 0fc695fc -- vllm` 无匹配。另核对 `7d825229` 和 `baa023ad` 的 `_build_attn_state`，版本表的状态判据一致。
- 隔离 build 与 Chromium 整页实际打开；截图已目视：`%TEMP%/infra-wiki-review-20261115/668-chunked-prefill-preview-lbXbAr/chunked-prefill-diagram-1.png`、`chunked-prefill-top.png`。
- 浏览器最终复验 `668-chunked-browser-recheck.mts` exit 0，报告 `browser-recheck.json`：HTTP 200、候选文本命中、2 张图、0 JS 错误、0 KaTeX 错误、源码区默认关闭/点击展开正常、页面宽 1440。首次驱动错选第三个 pre 导致超时，纠正选择器后只复跑浏览器、复用已构建产物；这不是产品失败。
- 机器检查详情：`%TEMP%/infra-wiki-review-20261115/668-chunked-review/mechanical.json`。本轮仅写审查记录与隔离验证材料，未修改候选正文/图、正式 wiki、3D 或 210 次调用缓存；专用 4197 检查服务已退出。

## Tradeoff / Open Questions

本轮三项为现有任务内返修，不延后、不换新流程。无须用户决策。Task `649` 的消息 `666` 仅交付根因与红灯断点：业务修复、转绿与隔离缓存验证仍待后续短回合，不能记为修复完成；本文不构成 `649` 代码复审结论。