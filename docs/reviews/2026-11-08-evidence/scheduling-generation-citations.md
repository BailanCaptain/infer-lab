# Scheduling / generation 核验交接（用户要求暂停的安全检查点）

**状态：未完成。** 2026-11-08 用户因共享 TPM 持续限流要求串行续跑。本组停在 chunked-prefill 的本轮已读范围落盘处，不再读取下一页。逐条记录在同名 JSON；空 citations 是尚未判定，不是支持。

## 已保存的实际工作

- 原分配 12 页共 **739** 条来源；本轮精确补证后 **751** 条。
- 已落盘 **182** 条人工主张级判定：short-request-first 32、batch-job-aware-scheduler 43、balance-scheduling 38、dp-request-routing 30、chunked-prefill 39。包含部分支持与重复归档，不代表这五页通过验收。
- 上述五页正文与各自两张图 YAML 已完整阅读；图内 pins 与正文来源逐项对照。sampling 只读到当前原稿 L1045，后续版本表及来源区未读完；vllm-scheduler L1–377 正文已完整读，但尚未建立该页逐来源判断。其余页面未由本写手通读。
- 原文只用指定 commit 的 git show 范围读取。`.tmp/wiki-evidence-resume-2026-11-08/scheduling-generation/` 的摘录包记录原始行号；只有实际相同 Git blob 的重叠行、完全相同片段，以及逐段真实比对相等的 raw 汇编才复用。摘录包的存在不表示读过或支持；以 JSON 人工条目为准。
- `scheduling-decisions.yaml` 是人工判断底稿，`scheduling-ledger.py` 只填 ref/hash/来源计数并序列化；不会自动生成支持判断。两者位于 `.tmp/wiki-evidence-resume-2026-11-08/`。

## 本轮精确修订及原文依据

### P1：批作业输出长度估计把前端停止字符串当成引擎正常结束

- 位置：`wiki/concepts/batch-job-aware-scheduler.md`「每个作业有一个输出长度的估计值」及源码区。
- 影响：停止字符串负载不一定更新 EWMA，原文会让读者误判估计器学习了哪些请求。
- 原文：Ascend `2ed6cbba` `batch_job_aware_scheduler.py` L655–661 只观察 `FINISHED_STOPPED`；vLLM `568afb3a` `output_processor.py` L649–696 对前端停止字符串追加 abort，`async_llm.py` L685–689 发送取消，`core.py` L479–483 使用 `FINISHED_ABORTED`。
- 修订：明确引擎内 EOS/停止编号与前端字符串的状态区别；补 sources 41–43。尚待独立复审。

### P2：预留最小值与 EWMA 分类取整漏掉边界

- 同页原文声称 R=0 总留 m、每步至少 m；配置允许 m>M，实际 `min(R+m,M)` 可小于 m。
- 稳定反例实际运行输出：`R=0,m=10,M=8,P=8,P_at_least_m=False`。修为 `min(m,M)` 并保留预算 `max(0,...)`；专用流程图补预算最低 0。
- estimator 的 `predict()` 在 L141 返回 `int(ewma_average)`，补充 32.9 按32归入短作业的边界。
- source 27 扩至配置完整校验 L1337，source 28 扩至官方四个测试 L207；把“没有更大模型官方测试”收窄为“这份测试不覆盖”。

### P1/P2：DP 与跨组 EP 条件、路由推送时序

- `balance-scheduling` 原文将 DP 解释为复制完整模型；`dp-request-routing` 将 MoE 专家跨组切分写成无条件。修为 GLM 的跨组 EP 条件，保留稠密 DP 与实际模型组合的区别。
- `dp-request-routing` source 5 缺 `except ValueError: return None` 的 return 行，扩至 L411；新增 coordinator L145–173 的100ms默认来源。
- 协调器 L254–278 是轮询超时发布，含50ms聚合等待；修正文与图中“满100ms就立即推”的硬性说法。图明确单前端普通文本生成，以及派出到实际入waiting的时间差。
- `balance-scheduling` 补 CPU gloo 创建来源、v0.26环境值传参、四版实际闸门分支；不再用设计文档代替实现。GLM5.3教程只引DP8片段，收窄原“DP8/DP4都开”的泛化。

### P2：短请求图的等待上限、来源边界及 malformed relations

- `short-request-first-flow.yaml` 的“上限”改为“门槛”，与正文不承诺等待时限一致。
- `short-request-first` 补初始化waiting工厂来源32；删除未经本轮全仓扫描支持的“全仓搜不到”措辞，改成定点core目录与平台选类范围。
- 通过 `git ls-tree <commit>:vllm_ascend/core` / `models` 定点检查旧版目录；SRF 三版完整 Git blob 为 `f9628b2890443f37f49fde1494530ad87291d0a7`；batch-job三版为 `5a45d6bb5127a36ff8331150a56f5f2c0d243ecb`。
- 修复 short-request-first 与 chunked-prefill 的 relations.note 被逗号数字拆成额外 YAML key 的问题。

### P2：分块图文混用步前/步后已算数，逻辑访问量混作显存流量

- `chunked-prefill` `_update_after_schedule` 原文 L1000–1006 要求计划保留步前计数供输入；runner L858–867 用 input_batch 的步前计数编位置号。正文与流程图明确该边界。
- 保留6/6/2、105个因果位置对算例；将32对14的逻辑历史覆盖比较与实际HBM流量区分。
- 对齐函数范围补至完整返回 L338、模型支持函数补 return True L1811、丢弃范围扩至同步clear L2671；补 KDA 内部64常量来源39。
- SARATHI 的 arXiv 原站摘要已联网阅读，支持等长分块+decode搭车的概念；**未读论文全文**，不认证其性能数字。

## 已读图与 pins

| 页面 | 已读 YAML | 本轮判断 |
|---|---|---|
| short-request-first | short-request-first、short-request-first-flow | 16位置与A/B/C/D算例复算；flow pins对应等待/恢复/老化分支；“上限”修为“门槛” |
| batch-job-aware-scheduler | 同名、同名-flow | 6空闲块、预留3、X借3、Y等待与下一步跨块算例核对；流程补预算非负及引擎正常停止 |
| balance-scheduling | 同名、同名-flow | [4,2]最大值触发全体停止waiting；dummy参与互报，pins直接对应固定GLM补丁 |
| dp-request-routing | 同名、同名-flow | A显式rank不补账，B自动4W+R；单前端补1条件及消息/统计时间边界已补 |
| chunked-prefill | 同名、同名-flow | 6/6/2与最后段输出；pins对应截预算、前推、位置、标签、discard-mask；异步最终过滤尚待追完 |

**本轮 YAML 修改尚未定向生成 SVG，浏览器尚未验收。** 修改的图为 short-request-first-flow、batch-job-aware-scheduler-flow、dp-request-routing、dp-request-routing-flow、chunked-prefill-flow。不得把当前 YAML/SVG 当作已一致。标准 `pnpm wiki:diagrams` 无按id参数，应在下一工作单元用现有渲染导出函数只处理这些图；全站生成与构建由主代理协调。

## 准确未完成清单

### 尚无本写手逐条判定的569项

| 页面 | 当前sources | 正文阅读情况 |
|---|---:|---|
| sampling | 180 | L1–1045，未读完 |
| structured-output | 93 | 未由本写手通读 |
| request-teardown | 76 | 未由本写手通读 |
| prefill | 50 | 未由本写手通读 |
| streaming-output | 64 | 未读 |
| vllm-scheduler | 61 | 正文L1–377已读；未开始逐条判定，未读图 |
| concurrent-requests | 45 | 未读 |

### 有判定仍需补证/整改的项

- short-request-first sources16/25：平台片段不足单独证明功能不存在，补充了core/models定点目录证据；仍需独立审查完整入口边界。
- batch-job sources23/24：MTP如何归入use_eagle及133120公共块大小依赖跨组源码/主线底稿，当前记部分支持；交主代理共同底稿核验。尾状态块、KV预算及45层等跨页具体数字本轮未从共同原始规格闭合。
- balance source24：设计文档的“删除schedule副本”是方案描述，实际代码仍有副本；已避免把方案当完成事实，独审需复核。
- dp source29：仅有KV块估计函数，完整Dyntra暂停/接纳机制属于跨组页面，不由这段自动支持；本页main使用Docker默认v0.29.0的98dff2a8对照，其他专题84030bbe身份需集成时统一说明，不擅改seeds。
- chunked sources17/19/23/27/28：异步与spec结果过滤未追完；2051需模型字段闭合；DP节流有容量/运行请求条件且可能影响已有prefill；旧版batch-invariance文档的否定范围未核；v0.26标签来源不支持“丢弃采样也相同”。这些都如实为部分支持，**尚未关闭**。
- chunked的真实KV借块前提、main执行标签相同、旧版文档不提等边界需后续核验，不能以已有38/39条记录当作页完成。
- 五页所有本轮修订待独立审查、定向图生成、内容/引用检查和浏览器实际阅读；全站lint/typecheck/build由主代理统一执行。当前没有声称这些检查通过。

## 已启动的独立审查会话

- Session ID：`ses_e48bdde5dffeZ4GlSTSI1K11L4`。
- 原范围：sampling、structured-output、prefill、request-teardown，要求逐项原文审查，只写 `independent-scheduling-generation.json` / `.md`，不改wiki；不允许递归委派。
- 第一次默认模型执行因免费额度失败；随后**在同一session**指定 `openai/gpt-6-astra` 续跑。当前后台 shell ID：`sh_1b7427cbb001Y43Pl6x001886C`。本写手尚未收到完成通知，不轮询、不把它计入182项。
- 提示词：`.tmp/wiki-evidence-resume-2026-11-08/scheduling-review-prompt.md`。主代理恢复前先处理该会话，避免重叠；本组没有再启动其他子代理。

## 检查与哈希

- 已实际运行人工账本序列化，输出 `recorded 12 pages 182 citations`。
- JSON的每页sha256绑定当前文件；当前checkpoint的文件/计数摘要和SHA256另存 `scheduling-generation-checkpoint.json`。
- 旧 `docs/reviews/2026-11-03-evidence/groups-01-02-citations.json` 未修改。所有正文修改基于当前工作区精确patch，没有从HEAD回滚。
