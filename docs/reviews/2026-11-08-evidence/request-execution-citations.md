# 请求入口与执行链：暂停检查点交接

2026-11-08。**未完成整组验收。** 用户最新指示因共享 TPM 连续中断，改为主会话串行续跑；在当前最小条目（加载预取调用体）读完后暂停。未启动审查子代理，sessionID：无。独立复审由主会话统一安排。

## 实际完成与计数

- 8 页正文已全文阅读，当前 sources 合计 **523**。498 条 git 来源已按固定 commit/范围实际阅读；重叠范围合并显示，未把同源当作自动支持。
- 8 条 raw 来源含 327 段，全部与固定原文逐字相同（比较时仅剥离段首尾空白），并确认所有非空原文行都在本轮已读范围。它们是重复归档，不能增加独立证据数。
- 直接在线读完 Recipe 固定 README、Uvicorn settings，共 2 条。npu-model-runner 来源45与44是相同 commit、相同行的官网 blob/本地表示，原文按44已读，网页可访问性未查。
- 因而 **509/523 项的原始内容已读或经过等价去重阅读；14 项原文阅读未闭合**。这不是 509 条支持判定。
- 新 JSON 仅保存 **19 条作者逐项语义判断**，其余 **504 条尚未逐项落账**。19 条中含范围不足、部分支持及原说法不成立，不能计为全部通过。
- **正式 wiki 页面、图、旧总账均未修改。** 页面哈希保存在 JSON 的 pages[].sha256。

## 已读原文定位

目录：`.tmp/wiki-evidence-resume-2026-11-08/request-execution/`。

`read-01.txt` 至 `read-27.txt` 全部实际读完。每个 FILE 头列固定仓库、commit、路径和对应的全部 `页面:来源编号`，正文前缀是上游行号。抽取仅去空行；约 16,925 行含文件头。工具截断处已续读：read-06 的 867–885、read-18 的 838–1371。

最后一个安全检查点：`vllm@0fc695fc:vllm/model_executor/model_loader/weight_utils.py#L801-L892`。801–852 在 `extra-0.txt`，853–892 经本轮 shell 定点读出。**预取确实后台启动**：835 按 rank 分文件，890 `threading.Thread(..., daemon=True).start()` 后返回；内部 gather 只在线程里等。正文“后台预取与前台加载重叠”成立，不能误改成同步等待。建议补入 801–890 作为该细节的直接来源；当前来源16仅893–1027。

### 原文阅读尚未闭合的14项

| 页 | 来源编号 | 当前状态 |
|---|---|---|
| engine-processes | 1 | 固定 GLM 教程只读了其他引用覆盖的局部；全文已抽取 `extra-3.txt`，未读完 |
| engine-processes | 96 | PyTorch 2.10 distributed 指定网卡说明尚未取得/阅读 |
| engine-processes | 97–100、103–106 | 共8份已下载到对应 `external-engine-processes-N.txt`，**尚未阅读** |
| request-call-chain | 59–60 | 两份 HCCL 超时原文已下载到对应 `external-request-call-chain-N.txt`，**尚未阅读** |
| vllm-v1-shape | 36 | 官方 v0.23 architecture overview 尚未取得/阅读 |
| npu-worker-lifecycle | 1 | 与 engine-processes:1 相同全文，仍未读完 |

其中 CANN Markdown 的 webfetch 报 `application/octet-stream` 不支持，随后 urllib 成功取得文本；这是已取得但未阅读，不是“原文无法取得”。当前没有已经证实永久无法取得的原文。

其他准备产物：`extra-1.txt` 至 `extra-5.txt`、`diagrams-0.txt` 至 `diagrams-2.txt` **均未实际阅读**；不得把文件存在计作核读。`other.json` 只是25条非git来源的机械清单。`raw-differences.txt` 为空，因为归档327段均相同。

## 发现与下一轮修订入口

以下是作者基于本轮原文的待处理项，**尚未修订、尚未独立复核**。逐项 ref、claim、read_ranges、verdict、evidence 已写入 JSON；行号指当前未改页面。

1. **P2 — API 日志等级**：api-server-entry:356 把未知字段忽略写作“警告”，来源22实际是 `logger.debug`。INFO 看不到该消息，需改成 DEBUG 记录。
2. **P2 — ID fallback 条件**：api-server-entry:310/402 只写无header则随机；来源6与调用方证明请求字段 request_id 也可作 default。保留 header 优先级，补字段回退。
3. **P2 — 引用缺关键返回语句**：api-server-entry 来源15到L192，尚未覆盖输入预算减法；extra-1/2待读后再扩范围，不能用当前片段认证公式与截断条件。
4. **P2 — 执行器类名**：engine-processes:484/528 写 ExecutorBase，实际是 Executor；来源47应扩至L87，覆盖导入路径后的子类检查。
5. **P2 — 固定镜像混入另一分支日志调用**：request-call-chain:426 写记显存统计，但 db701c1f 599–666 没有 log_memory_stats，2c59ff10 L615才有。
6. **P1 — 消息类型的绝对化**：vllm-v1-shape:118/132 “EngineCore只认整数、代码里找不到任何张量”与 EngineCoreRequest.prompt_embeds、pooling_output、NewRequestData.prompt_embeds 矛盾。应讲清调度账本与模型张量执行的职责边界，限定纯文本编号例子。
7. **P2 — 零token出口遗漏条件**：npu-model-runner:197/287与专用图把零token统一写成设备不工作；实际 external_launcher+DP 先dummy，KV connector另有no-forward协作路径。request-call-chain已写条件，可统一引用。
8. **P2 — PP无状态出口遗漏协作**：npu-model-runner:207及图无状态出口遗漏异步PP采样广播与KV connector返回；非末段前向提前返回另受 not broadcast_pp_output 条件控制。
9. **P2 — 8卡都发回的说法错误**：npu-model-runner:263及专用图右下。MultiprocExecutor的Worker发送端994–995已按output_rank过滤；应写8卡执行、仅指定rank回传。
10. **P2 — 加载回退版本差异**：npu-worker-lifecycle:269/344应限定基线。v0.26/main在 fall_back_to_pt 上增加 `and not use_safetensors`；main远端下载索引又增加多文件条件。
11. **P2 — main异步默认差异未列全**：vllm-engine-core:311 还应记录 main 自动判定额外放行 draft_model、dspark，不能只列ROCm闸门；旧显式启用与自动默认不同。

还发现、但**未完成逐项判断与补证**的交叉风险，续作时应检查：

- vllm-v1-shape 与 vllm-engine-core 把每步1–4个token推成流式片段1–4；已读 OutputCollector 会合并多个delta，需要限制为单步产出并保留合并说明。
- vllm-v1-shape 首段“每一步至少一个新token”缺被调度/未取消等条件；本组其他页已有未排上、等待、取消分支。
- prepare-inputs-flow 的“块表只追加”遗漏 resumed_req_ids 替换块表条件；已读 CachedRequestData 的114–116可定位，但应继续跟消费者。
- 多个版本表用只覆盖函数开头的来源支持完整方法一致、支持范围缺失、文件退役等结论；需要对应方法/注册入口的补读，不能仅凭符号和行号有效认证。
- 直接源码字符串、图pins、主线算例的来源映射与算式还没有完整验收。不要把正文通读当作这些项目全部正确。

## 图、检查与接续顺序

20张专用图中，只实际读过 `api-server-entry-flow.yaml` 和 `npu-model-runner-code-flow.yaml`，尚未完成完整pin逐条落账；其余18张未读。没有生成SVG，也没有浏览器实测。布局与原有算例均保留。

建议主会话按单页恢复：先用新JSON定位已有19项判断和所有页哈希；每次只读当前页剩余来源、条件调用体与专用图，手写逐项判断，再用patch修订。旧账本只用于对齐，不能替代实际阅读。独立审查集中调度；本会话没有正在运行的子代理或后台任务。

本轮执行过的机械验证：8页计数/哈希；固定来源定点抽取；raw327段等价与已读非空行覆盖（均为0缺口）。尚未运行内容/链接/图检查、类型检查、lint、构建或浏览器验收；没有可交付的“整组通过”结论。

**Why**：按用户最新指示停止并行，保存可恢复的真实证据。**What**：新账本与交接报告，未动正式正文。**Evidence**：见上述原文定位、19条判断与JSON哈希。**Tradeoff**：509是原文阅读覆盖，正式逐项判定只有19，审查未闭合。**Open Questions**：无须用户作产品决定；余项由主会话继续核验与修订。
