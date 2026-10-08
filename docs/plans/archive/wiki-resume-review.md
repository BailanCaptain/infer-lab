# 整体审视与维护接续（2026-09-16）

> 后续状态：下文 Prefix Caching 提案 dd3bf215… 已撤回，不再待审；测试覆盖不足不能推翻缓存原理。107 条 raw 提示已逐项核查；显存预算与上游的错误对比已由用户批准，e6061568… 已发布。既定六场景已完成零费用资料与快照预检，真实问答仍待费用核清。见 [最新证据核查](wiki-evidence-review.md)。本报告维护修复和测试结果保留为当时证据。

工作目录 `C:/Users/-/Desktop/infra-view-new-llm-wiki`，分支 `feat/llm-wiki`，保留原有未提交现场。依据原始 `../infra-view-new/llm-wiki.md`、F001–F004 全部 34 条 AC、HANDBOOK 和实际实现审视。

**整体判断：架构符合 LLM-Wiki 的方向，产品效果仍未完整达标。** 原料留存、持久 Markdown、更新已有页、单向关系与派生反链、修订历史、人审发布都有实现。`draft-review.ts` 在编译后选取相关既有页做整合；`worker.ts` 对 gap 要求冻结题目和独立前后测。这些机制服务于知识积累，但正式库仍是 19 个 seed 页，不能证明真实独立回答已改善。真实 PR、投喂、gap、参数补文与维护判断仍按 feature 表保留缺项。没有以更多脚本或测试数替代真实产品验收。

三项暂缓批量工作不变：F001 灌种、F002 全量参数骨架、F003 全库语料初拉。未执行、未取消，也未计为 AC 通过。

## 本轮复现与修复

| 问题 | 证据 | 处理 |
|---|---|---|
| P2：维护失败没有持久错误上下文，`sync.ts` 只记通用摘要 | 真实任务 LastRunTime=09-16 03:00、LastTaskResult=1；FETCH_HEAD=03:00:05，lease 结束=03:01:00；无历史 stderr。新增回归先因缺 `last-run.json` 失败 | 在共用同步入口记录阶段、repo/ref、异常和每次运行结果；保留失败、暂缓、巡检发现、成功四种状态，正常和异常都释放 lease |
| P2：维护使用 PATH 中 Python 3.9，不能解析当前上游语法 | 禁联网、禁模型的临时副本复现 `c267db73:vllm_ascend/patch/platform/patch_speculative_config.py:125` AST invalid syntax；最小 starred subscription 测试同样先红 | 同步配置显式固定本机 Python 3.12；扫描器支持显式解释器并报告实际路径，未跳过任何无法解析的源码。独立命令/测试可用 `WIKI_PYTHON` 指定 |
| P2：非批量上限触发时整个维护退出，后续巡检不能运行 | Python 3.12 复验得到“新增骨架 13 超过上限 3”；CLI 回归先无巡检结果 | 用明确的暂缓类型保留上限；该 ref 整批不写页、不推进检查点，记录待处理差异，继续巡检；CLI 仍非零退出，不伪装完成 |

没有恢复到 03:00 的原始 stderr，因此上述是当前现场的稳定复现与修复，不能断言历史运行只有这一条根因。未重跑生产默认 sync、未联网 fetch。调度仍将在原定 03:00 执行；下一次真实调度结果尚未验证。

真实本地源码隔离复验（`tools/wiki-runtime/sync-controlled-green.log`）：main 的 13 页保持 deferred，上限 3；releases/v0.23.0 changed=false；patrol findings=[]；tasks=[]、modelCallsAllowed=false。生产页面、语料和同步检查点未被副本运行修改。副本运行结束不代表生产同步或全部维护验收完成。

## 纠错审阅（历史记录，提案现已撤回）

当时 revision：`dd3bf215fb029b5c8f3ddcc13d3defb9866e6fea19f89331753c66b5baba434c`，当时 pending，**现为 rejected**。完整历史 diff 在 `tools/wiki-runtime/prefix-claim-review.diff`；`prefix-review-rebuilt.log` 记录完整候选校验 0 错误、正式原文未变。`prefix-review-rebase-verification.json` 记录当时新旧 writes 和 decision 逐字一致、当时 base 无差异；旧 `6d313556…` 已 rejected。

当时重读 `28bf3a2e:tests/e2e/model_utils.py:27–54` 与 APC 测试，观察到只比较输出文本与 token ID，未比较 KV 张量，并据此提出修订。后续审视确认这不足以反驳原理，用测试边界替换原理说明不适合教学，已撤回；正式原文始终未发布修改。不得沿用当时的纠错结论。

## 验证与下一步

- 红例：`sync-red.log`、`sync-python-red.log`、`sync-deferred-red.log`；相应 4 文件 / 12 项定向测试通过，见 `sync-deferred-green.log`。
- 生产构建通过，3.03s，见 `resume-build.log`。本轮没有 UI 改动，没有重做浏览器验收，也不将历史浏览器记录冒充本轮。
- 首轮全量检查 637 passed / 1 failed：检查执行期间修改了 HANDBOOK，构建快照与实时快照的版本一致性断言报红；保留日志 `resume-check.log`。冻结 Wiki 输入后完整 `pnpm check` 退出 0：92 文件 / 638 项通过，105.44s，类型、Lint、依赖、内容与 Wiki lint 均通过；既有 1 warning / 2 infos 保留。日志 `resume-check-final.log`，未降低断言。命令前设置 `WIKI_PYTHON` 为同步配置中相同的 Python 3.12 路径。
- 共享预算仍 paused，占用 $8.9027865，含 $0.65 未知费用预留；本轮无新增收费调用。内容批准与两笔真实费用回执仍需用户处理。核清前不跑真实 PR / gap / 投喂，不擅自解暂停。之后按原冻结场景继续一条真实积累闭环；107 条历史 raw 对应关系及正文语义债务仍未全面审完。

重要限制：本机同步配置固定了本地解释器的绝对路径，迁移环境须重新配置；这是运行环境依赖，不是 vLLM 推理环境。批量暂缓状态仍使调度返回非零，需读回执区分“需要用户决定的导入”与执行错误。
