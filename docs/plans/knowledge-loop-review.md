# 真实知识积累验收记录

2026-09-15；实现位于 `C:/Users/-/Desktop/infra-view-new-llm-wiki`，`feat/llm-wiki`，HEAD `8175224` 的未提交工作区。主干未修改。用户授权本轮真实模型调用总额不超过 10 美元；不做批量导入。

## 当前结论

保存 → 受限编译 → 待审 → 驳回 / 批准 → 阅读刷新 → 独立复问已经使用真实模型产物和真实发布器跑通。隔离副本由 19 页变成 20 页；工作区正式知识页保持 19 页。这个结果证明持久化和复用成立，不证明回答永远正确，也不代表 F001–F004 全部完成。

Sonnet 与 Opus 的固定对照均已结束：缺失题、保留改写题和版本题获得了原库没有的答案，已有槽位推导保持正确；但完整回答仍有过度概括或证据表达问题，**严格效果验收未通过，不能标“完美验收”或关闭 M1a**。本轮已知模型费用 5.9398455 美元，另保留中断调用的 0.50 美元预留，合计按 6.4398455 美元记账；付费轮次均已关闭。

## 实验边界与可复核材料

- 原始理念：主干 `llm-wiki.md` 的 core idea 与 architecture，知识持久累积、不可变原文、增量维护和交叉引用；不是训练模型。
- 唯一题库 / 评分依据：`scripts/wiki/eval-suite.json`，suite revision `d8fde3370247e385fb1093df80f28c42235cc87bbcd1ef19af806d5e39ab5b80`。六题在编译前固定，没有挑换失败题。
- 钉定源码：main `28bf3a2e8e8db396ee5dcfa6812626eee2d394ab`，旧版 `2c59ff1047573f40a471cf7535f01a8877344415`。六段证据的完整 blob SHA-256 和原始行号在题库中，通过 `verifyEvalSuite` 对实际 `git show` 内容核对。
- 正式对照的补料前知识版本：`12c28745871a53b9c2d3539af8bd538362fe74a529360e4b2aa18ffbf1db411e`；补料后：`edf852a45caa5aad20ca8cd2434200622a7162a95100571a04bdd3f7e22cf731`。每个模型轮次的两边 HANDBOOK、模型配置和只读工具权限相同，仅知识内容不同。不同模型轮次分别统计。验收结束后同步 HANDBOOK「人类须知」的已实现状态，未回改这两份冻结快照或答案。
- 只读工具为 Read / Grep / Glob，无 Web、写入或执行工具；每题新会话，不接受旧 session / 历史问题。实际 CLI 2.1.270，原生 Windows 可执行文件。最初隔离探针实际读到目录内标记，读取目录外标记被 `--restricted` 拒绝；这是 CLI 工具边界验证，不是 OS 沙箱证明。
- 编译输入只包含原问题、三段配置源码和相邻 profiling 页；没有保留改写问题、其他测试问题或评分标准。补料与对照分开。归档回答作为 source / I 保存，没有自动提升为 C。
- 本任务按来源独立复核候选，并驱动浏览器批准**隔离副本**。这不等于用户已经人工批准工作区正式内容。真实 UI 的聊天保存动作另由固定输出浏览器测试覆盖；本轮真实回答从服务函数进入 capture / save，没有声称一次真人聊天 UI 操作覆盖所有步骤。

完整请求、原生 CLI 事件、模型 / 工具清单、答案、费用与 session ID 保留在忽略目录：

- [最初失败轮](../../tools/wiki-runtime/eval-20260915/closed.json)：规则冲突及被驳回的补料回答；原始输出不覆盖。
- [Sonnet 对照与实际发布](../../tools/wiki-runtime/eval-20260915-v2/before-output.log)、[补料后](../../tools/wiki-runtime/eval-20260915-v2/after-output.log)。每个 `before-N` / `after-N` 对应题库顺序，并有 `.request.json`、`.result.json` 和派生 `.answer.md`。
- [调用汇总](../../tools/wiki-runtime/eval-20260915-v2/calls.json)：费用由回执相加；汇总脚本不负责语义评分。
- [Opus 对照](../../tools/wiki-runtime/eval-20260915-opus/before-output.log)：同六题、同两份知识快照；保留 Sonnet 失败，不把换模型结果混成一次实验。

## Sonnet 的逐题结果

每格分别检查检索、核心事实、引用支持和版本范围；执行器 `ok: true` 只表示调用成功，不表示答案通过验收。

| 场景 | 检索：补料前 → 后 | 核心事实：前 → 后 | 引用与版本复核 |
|---|---|---|---|
| chunk-constraints 缺失题 | 无相关知识 → 新来源页第 1 位 | 无法回答 → clamp / PP 抛错 / balance 互斥均正确 | 后答明确 I，链接实际来源页，限定 main；通过本题所问范围。前答猜测源码路径，未作为合格知识采纳。 |
| chunk-paraphrase 保留改写 | 误召回显存 profiling → 新来源页第 1 位 | 混淆 PP / PCP、EPLB → 三项结果正确 | 后答仍误称三项“互不短路”；实际上第二项抛错会阻止第三项。严格整答未通过，不能用核心事实正确掩盖额外错误。 |
| cache-read-write 跨页综合 | 两边均找到 block-table / paged-attention | 两边均区分块表读和 slot 写 | 前后均有多页 C 编号归属不清的问题；后答还把 slot_mapping 称为“落盘地址”，与内存槽位含义不符。严格整答未通过。 |
| timing-version 版本反例 | 无相关知识 → 新来源页第 2 位 | 无法回答 → 旧版保留 True、main 警告改 False | 后答始终讨论配置对象，保留两个 commit；使用 I 与实际来源页，没有声称运行期一定计时。 |
| slot-arithmetic 已有知识 | 两边 block-table 第 1 位 | 两边正确推导 898 | 核心算式无退化；后答扩展到邻页时 C 编号归属仍不清，推导未按约定标 D。不能据此认定引用质量通过。 |
| unsupported-speedup 无证据 | 无相关知识 → 新来源页第 1 位 | 两边均拒绝保证两倍加速 | 后答虽拒绝编造数值，却把未来实测材料称为 S/C，证据分类错误；正确分类应为 M。严格整答未通过。 |

因此能确认的是**新增知识改善了三题的核心事实覆盖**；不能确认整套回答质量已经合格。引用存在、检索命中与事实正确是三个不同条件。

## Opus 的完整对照

请求使用 `opus`，实际回执为 `claude-opus-5` 标准上下文；前后固定相同配置。编译器实际为 `claude-opus-5[1m]`，两种配置分别记录，不能称为完全相同的上下文配置。[前答](../../tools/wiki-runtime/eval-20260915-opus/before-output.log)、[后答](../../tools/wiki-runtime/eval-20260915-opus/after-output.log) 与各题原始回执可复核。

| 场景 | 核心事实与检索前后 | 引用 / 版本 / 额外表述 |
|---|---|---|
| 缺失题 | 前答明确库内没有；后答命中新来源页并正确给出三项结果 | 后答保留 I 与 main commit；承认归档回答未经源码独立核对。源码警告字符串仍被转述成“代码注释”，不是原文逐字准确的复现。 |
| 保留改写 | 前答承认没有证据，仍引入邻近 KV 块大小类比；后答回到正确机制和三项结果 | 后答出现“min_chunk 可能静默变成别的数”及概括性的“检查不短路”，与 warning / 抛错停止的精确语义不一致。**这一题的严格整答仍不通过。** |
| 跨页综合 | 两边正确区分 block_tables 读与 slot_mapping 写，命中两页 | 后答的 C1/C2 明确跟随 PagedAttention 链接，另一 C1 跟随 Block Table，未再把 slot 叫落盘地址；main / 旧版写算子差异分开。 |
| 版本反例 | 前答无证据，后答正确给出旧版 True / main False；新页第 2 位 | 后答明确只比较解析，不讨论运行期。附带的 None 哨兵与告警之间的因果解释超出了这两个分支本身能直接证明的内容，应进一步收紧，不把它当额外已证实事实。 |
| 槽位回归 | 前后均为 898，Block Table 第 1 位 | 后答有 D、具体来源所属页和 CP=1 前提；还指出快照正文没有该常量名，按 CP 并行度理解。原前答尝试中断，下面单独记账；同一请求重试一次后成功，不能记成首次成功。 |
| 无证据反例 | 前后均不保证两倍收益 | 后答正确使用 M 表示实测，保留问答来源 I 与版本限制，没有伪造性能测量结果。 |

两种模型都表明“存入的新内容会被新会话取用”，也都表明“取用了内容”不足以保证每句改写准确。换到 Opus 改善了部分引用和边界表达，**没有把整答严格验收变成全绿**。本轮没有为了通过而改题、改评分标准或隐藏 Sonnet 输出。

## 费用与中断

| 轮次 | 启动尝试 | 已知费用（美元） |
|---|---:|---:|
| 最初探针 / 失败编译轮 | 10 | 1.1662855 |
| 修复规则后的 Sonnet / 保存 / 正常权限问答 | 16 | 1.8894370 |
| Opus 完整对照（含一次无回执中断） | 12 | 2.6950460 |
| 原第五题精确请求重试 | 1 | 0.1890770 |
| 合计 | 39 | 5.9398455 |

39 次已启动尝试中有 38 份最终回执，另一次不能认定实际费用为零。其 owner 进程及直接子进程已确认不在运行，使用 `WorkflowStore.recover()` 将 running 转为 failed，保留 0.50 美元预留；同一请求只在另行预留的 slot 重试一次，原失败不覆盖。见 [中断记录](../../tools/wiki-runtime/eval-20260915-opus/interruption.json)、[重试回执](../../tools/wiki-runtime/eval-20260915-opus-retry/retry.result.json)。

最终已知费用 + 未知预留 = **6.4398455 美元**；这不是把未知费用认作已经发生的精确扣款。最后一次新增调用前的总预留上限为 9.5557225 美元，没有扩大用户的 10 美元授权。所有轮次已写关闭记录，未使用额度不再自动消费。统计只包含本机模型 CLI 回执，不冒充账单核销。

## 实际保存与审阅

1. 最初源码补料回答因错误源码位置、无依据设计动机被要求修订，原回答及修订回执保留。
2. 首次真实编译依照 HANDBOOK 写出 `[I1]`，被 lint 拒绝。没有发布失败草稿来制造成功。
3. 统一规则后的候选通过结构校验，但把旧版 `config.get` 的缺省与显式 False 行为错误泛化，被驳回：[语义驳回](../../tools/wiki-runtime/eval-20260915-v2/semantic-rejection.json)。重新补充源码反例后产生新的回答与任务，旧候选仍为 rejected。
4. 最终候选 revision `3a6f52746e1ecf27051ce5d95c9f53c6a1a36fa79edf121bfb2099462911f30e`。浏览器实际核对 diff、批准、显示新页和精确版本：[批准记录](../../tools/wiki-runtime/eval-20260915-v2/approve.json)、[阅读截图](../../tools/wiki-runtime/eval-20260915-v2/browser-results-final/publication-real-compiler-candidate-approve-chromium/approve.png)。最终 candidate → 浏览器发布约 214 秒，包含校验、测试中断和恢复，不是人工审阅工时。
5. 同候选的另一个隔离副本实际驳回，版本保持不变，批准返回 409：[驳回记录](../../tools/wiki-runtime/eval-20260915-v2/reject.json)。重复保存和批准不调用模型、不增页，维持 20 页：[重放记录](../../tools/wiki-runtime/eval-20260915-v2/replay.json)，`calls: 0`、`state: published`。
6. 正常联网权限问答单列：[online-output.log](../../tools/wiki-runtime/eval-20260915-v2/online-output.log)。不能把联网配置与离线对照混算，也不能把工具可用当成实际访问过某 URL。

## 本轮处理的问题

| 级别 / 位置 | 影响与复现 | 处理与证据 |
|---|---|---|
| P1 · HANDBOOK answer-record 规则 | 要求 `[I1]`，统一 lint 禁止 I 带编号；真实编译照规则生成仍不能保存 | 改为统一 `[I]`，raw 从来源列表访问；未放宽 lint。真实规则样例交给实际 lint 的回归测试先失败后通过，见 `handbook-red.log` / `rules-green.log`。 |
| P2 · HANDBOOK 查询切片 | 声称缺口自动补页已实现；诱导用相似机制硬答 | 撤回过期能力承诺，明确查不到时不猜源码 / 版本 / 动机，精确问题优先回答所问范围。两个对照轮均使用相同的新规则；规则不能保证模型必然遵守，违反规则的回答仍记失败。 |
| P1 · server/snapshot.ts | Windows 上新目录 rename 连续 EPERM，阻塞新知识版本问答；7.6 秒诊断仍失败 | 放弃目录 rename，完整独立目录校验后原子发布就绪指针；旧快照兼容复用。目录重命名永久失败、指针写入失败、并发复用、指针篡改的测试覆盖，红例 2 failed / 1 passed → 3 passed；真实 after 对照已读取新对象目录。 |
| P2 · scripts/wiki/eval-call.ts | 未知 / 非法 / 超单次预留费用不能当成功验收；重复调用不能重置付费 | 固定总预算和 slot，绑定请求，缓存回执，未知费用停验收，关闭轮次禁止再消费。费用非法红例 3 failed / 2 passed → 5 passed，另补关闭轮次零调用测试；没有扩大用户总授权。 |
| P2 · scripts/wiki/eval-call.ts 的事件留存 | 进程在最终回执前退出，原先仅在内存中的事件全部丢失 | 新增逐事件同步追加到 `.events.jsonl`，最终结果与费用仍单独校验；测试断言 runner 返回前事件已存在，先红后绿，7 项通过。原中断没有日志可恢复，明确保留未知费用。 |
| P1 · WikiPage.tsx / 来源入口 | I 不带编号是正确规范，但旧读者只能从编号角标打开来源，问答页无法核对归档原文 | 页面新增可展开来源列表，直接复用 `page.sources` 与现有来源 URL 转换，无第二份引用定义；手机宽度打开原文、定位行号、HTML 不执行的浏览器红例转绿。 |

首次真实浏览器批准因完整库校验超过 fixture 的 15 秒等待而中断。调整为完整库的 60 秒功能等待，未修改断言；检查进程已退出后使用现有锁恢复入口。原失败 trace 留存，重跑实际 `1 passed (33.7s)`。没有声称首次就通过。

## 工程验证

| 实际命令 | 关键输出 |
|---|---|
| `pnpm check` | 61 files / 512 tests passed，typecheck、lint、依赖 / 内容检查、wiki lint 均通过；[最终日志](../../tools/wiki-runtime/eval-20260915-v2/check-final.log)。 |
| `pnpm build` | exit 0，`built in 2.68s`；[日志](../../tools/wiki-runtime/eval-20260915-v2/build-final.log)。 |
| `pnpm test:e2e tests/wiki.spec.ts tests/evidence.spec.ts tests/raw-source.spec.ts tests/wiki-review.spec.ts tests/wiki-reader.spec.ts --project chromium` | 生产预览 4173；26 passed (29.0s)，包含新增来源入口；[最终日志](../../tools/wiki-runtime/eval-20260915-v2/e2e-final.log)。其中模型使用固定输出，与真实模型对照分开。 |
| `pnpm exec playwright test --config tools/wiki-runtime/eval-20260915-v2/browser.config.ts --project chromium` | 真实模型候选的驳回通过；完整库批准调整等待并恢复后通过。实际页面与精确版本已截图复核。 |
| `pnpm exec playwright test --config tools/wiki-runtime/eval-20260915-v2/source.config.ts --project chromium` | 1 passed (2.3s)；只读打开隔离副本的真实已发布问答，展开唯一 raw 来源，点击打开原文并定位全部 11 行；[日志](../../tools/wiki-runtime/eval-20260915-v2/real-source-browser.log)、[来源入口截图](../../tools/wiki-runtime/eval-20260915-v2/browser-source-results/source-read-published-answ-4a7a0-ns-its-immutable-raw-record-chromium/real-source-list.png)、[原文截图](../../tools/wiki-runtime/eval-20260915-v2/browser-source-results/source-read-published-answ-4a7a0-ns-its-immutable-raw-record-chromium/real-raw-record.png)。已目视复核真实页面与手机宽度测试截图。 |
| `pnpm wiki:audit --seeds wiki/seeds/vllm-ascend.yaml` | 19 页 / 410 来源，403 本地行号有效，7 URL 未联网验证，107 raw 引用待核对；无无效 commit / 缺文件 / 越界 / 未知仓库；[日志](../../tools/wiki-runtime/eval-20260915-v2/audit.log)。这不是全库语义验收。 |

Vite 仍提示未来 native config loader 不支持当前部分无扩展名导入；本轮没有关闭警告。现有 loader 的构建通过，不宣称未来版本兼容已解决。

## 全 feature 与下一步

正式登记的全部 feature 仍为 **0/4 完整完成**，状态唯一维护在 feature：

- [F001](../features/F001-llm-wiki.md)：阅读 / 检索 / 保存基础推进到真实模型复用验证；严格回答质量与 PR 入口等仍不完整，批量灌种暂停。
- [F002](../features/F002-param-lineage.md)：部分谱系工具已有，参数扫描、骨架生成区和统一调度仍未完整交付。
- [F003](../features/F003-github-corpus.md)：plan 已存在，语料采集和 PR 接入尚未交付。
- [F004](../features/F004-knowledge-loop.md)：真实保存发布复用基础成立；自动缺口补写、drop / quarantine、巡检、全库交叉审视仍待实施。

收益排序：先让证据编号明确绑定来源页、限制模型越界概括并继续保留独立失败样本；再补自动缺口和来源投喂；再接参数 / PR 增量与统一维护。继续增加问答数量本身不会自动增加知识，当前积累仍依赖显式保存和审阅。

待用户确认：无。当前授权足以继续本地改进；不能把这次隔离发布当作正式知识库已经被用户批准。
