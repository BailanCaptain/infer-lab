# 真实前测与补写停点（2026-09-16）

> 本文保留原 $10 / 8 次阶段的真实失败记录。用户之后已扩额至累计 $30 以下，参数页已批准发布，六题前后测已完成；最新状态见 [扩额与真实对照](wiki-budget-30-review.md)，不能继续沿用下文的暂停、无草稿、后测 0/6。

用户要求连续推进后，已执行剩余五道前测及一次源码编译。六道前测共五道得到完整答案，一道失败；编译失败，没有有效草稿，也没有新增正式知识。完整答案不等于语义验收通过，后测仍为 0/6，F001–F004 仍为 in-progress。

## 真实前测

沿用 `scripts/wiki/eval-suite.json` 六道原题及判准：suiteRevision=`d8fde3370247e385fb1093df80f28c42235cc87bbcd1ef19af806d5e39ab5b80`，knowledgeRevision=`fbdf0fa799c44c1439fc02a931f67f52d0c13657e39bb1c7a4471e76dbaa84ab`。固定 claude-sonnet-4-6，每题独立会话，只读本地快照、禁止联网；判准未进入模型请求或编译材料。

| 场景 | 本轮实际观察 | 回执费用 USD |
|---|---|---:|
| chunk-constraints | 明确库内缺该配置，没有猜测三个条件 | 0.1204127 |
| chunk-paraphrase | error_max_budget_usd，退出 1，无完整答案；保留失败、不重试 | 0.1668683 |
| cache-read-write | 答出读用 block_table、写用 slot_mapping；裸 `[C1]` 未绑定页面，引用检查不通过 | 0.1318035 |
| timing-version | 明确库内缺该配置，不能比较两个版本 | 0.0383899 |
| slot-arithmetic | 算出逻辑块 1、偏移 2、物理槽 898；裸 `[C6]` 未绑定页面，引用检查不通过 | 0.0901257 |
| unsupported-speedup | 拒绝无证据的普遍两倍提速结论 | 0.0931646 |

六次前测费用合计 $0.6407647。原始回答、模型事件、费用和逐题观察保存在 `tools/wiki-runtime/eval-20260916-resume/`，汇总为 `summary.json`。两份引用失败的原始答案没有事后改写，也没有放宽其页面绑定检查。

## 真实拒答误判修复

`timing-version` 回答“知识库内没有任何页面涉及……”被引用检查误判。原因是 `src/content/wiki/retrieve.ts` 的统一识别规则只含“知识库中没有”，未覆盖“内”。最小修订为 `知识库[中内]没有`；正常无资料拒答可被识别，未绑定页面的编号及无依据断言仍拒绝。

- 先红：`baseline-abstention-red.log`，1 failed / 9 passed。
- 后绿：`baseline-abstention-green.log`，2 文件 / 38 项通过。
- 手机尺寸 390×844 浏览器实测：正常拒答不显示无引用警告；原有无引用断言仍显示警告。`baseline-abstention-browser.log`，2 passed（34.1s）。使用固定 SSE 回执，无收费调用；页面接口离线时使用构建快照。
- 完整 `pnpm check`：93 文件 / 645 项通过（250.96s），类型、Lint、依赖、内容和 Wiki lint 通过；`baseline-followthrough-check.log`。`pnpm build` 通过（5.50s），`baseline-followthrough-build.log`。
- 更新交接、feature 表及报告索引后，12 个文档的 97 个本地链接无断链，34 条 AC 全部保留，正式页 19、schema problems=0；`baseline-followthrough-doc-check.json`。`git diff --check` 通过。

这些证据证明误判修复，不能计作补知识后的回答改善。

## 已准备材料与编译失败

从本地固定提交逐字提取 `ascend_config.py`：新版本 `28bf3a2e8e8db396ee5dcfa6812626eee2d394ab` 的 464–488、1021–1057 行；旧版本 `2c59ff1047573f40a471cf7535f01a8877344415` 的 723–760 行。旧版范围包含完整类名及末尾分支，未改变评测协议。

材料完整 blob 哈希、范围和去重计划保存在 `tools/wiki-runtime/profiling-material-plan.json`；不可变材料为 `raw:sha256-9e727546228dccd4202221fadbabf5e7327a90a2133453ec62eaae1cc2bb2e88.md#L1-L130`。材料仅含固定源码及出处，不含测试判准。早先较短材料保留原样，未用于编译。

调用生产 `compileRaw` 及受限模型运行器，最多一次尝试、超时 180 秒、单次预留 $0.15。任务 `cf28e5a31cccfe8687ea7277340b5ec5e1569c1cccbd34016b2abe6a8a4a0209` 失败（退出 1），真实费用 $0.258216，未产出有效草稿。输入、回执和结果分别为 `profiling-compile-request.json`、`profiling-compile-response.json`、`profiling-compile-outcome.json`，日志 `profiling-compile.log`，均在 `tools/wiki-runtime/`。

这是直接源码补写尝试，不冒充生产 gap 自动闭环。主会话已看过判准，因此没有用手写标准答案代替失败的独立编译。没有可让用户审批的新知识包。

## 账本与接续

第二道前测实际费用超过单次预留，产生暂停。核对完整回执、确认没有新增未知费用后，依据用户“不要每一步都停下、直接往下推进”的持续授权，以新方案 `d92ee3893635ae7dac3ba7691334874a8f80671259ed4169e137268687bd3dbb` 留痕恢复，继续其他既定问题；未重放旧批准，未清零历史费用或提高原上限。见 `budget-known-cost-resume-preview.log` 和 `budget-known-cost-resume-applied.log`。

编译失败后最终共享账本：**累计占用 $9.8017672 / $10，calls=8/8，paused=true**。占用包含原有未知费用预留 $0.65，不等于全数确认实付。本轮新增五道前测及一次编译的有回执费用为 $0.778568，没有新增未知费用。虽然金额尚余约 $0.1982，调用次数已耗尽，不得再恢复、重试、换账本或扩大限制来继续收费。

接续顺序：保留全部回执与固定题目；明确新的费用及调用次数安排后，先完成独立源码编译并检查有效草稿，再交用户审批具体修订，批准发布后执行独立后测及逐题语义审阅。原失败前测保留，补跑必须另记，不能覆盖失败。费用安排未改变前只做零费用工作。生产 03:00 维护仍待实际到点回执，不能用隔离副本结果代替。F001 灌种、F002 全量参数页、F003 全库语料继续暂不执行。

当前状态的入口为 [交接文档](../../HANDOFF-LLM-WIKI.md)；此前恢复实现和首题记录见 [预算恢复记录](wiki-budget-resume-review.md)。
