# 问答引用归属验收

2026-09-15，`feat/llm-wiki`，HEAD `8175224` 的未提交工作区；沿用 `infra-view-new-llm-wiki`，未做批量导入或新增模型调用。

## 结论与范围

本轮将问答引用检查接到实际知识快照：现有相对 Markdown 链接和 hash 路由须匹配页面；一手证据标记须直接链接到所属页，来源序号在范围内，原页正文确有同等级、同编号标记。失败显示具体原因，不提供保存；直接 capture 和旧回答记录的 save 同样检查，避免绕过 HTTP 提示启动付费编译。

这解决了可复现的引用结构漏洞，**不证明模型真正读过来源，也不验证结论含义**。两页都存在 S1 不能互换含义；测试专门保留“引用结构正确、事实相反”仍能通过的例子，防止将检查器误用为语义评分器。新增控制流与因果表述规则尚未做新的真实模型对照，不能宣称错误概括已经解决。严格效果验收仍未通过，见 [上一轮真实验收](knowledge-loop-review.md)。

## 问题、复现与处理

| 级别 / 位置 | 影响与稳定复现 | 本轮处理 |
|---|---|---|
| P1 · `server/chat-route.ts` 引用判定 | 回答 `见 [不存在](sources/missing.md)。` 或带有“尚未收录”时，原先只按链接外形判引用成功 | `server/citations.ts` 对本轮快照核对；伪造页不能被未收录声明掩盖。HTTP 用例先红后绿。 |
| P1 · `server/answers.ts` capture / save | `默认开启 [S1]，见 [A](sources/a.md)。` 未把编号绑定页面；`[C1](sources/a.md)` 可以捏造该页并无的源码证据。旧版生成的合法 hash 回答记录还能进入编译 | capture 和 save 复用同一检查器；旧记录在创建任务、预留预算之前拒绝，既不修改历史回答，也不消耗模型费用。 |
| P2 · `src/app/wiki/ChatDrawer.tsx` | 旧提示统一说“没有引用任何页面”，无法解释链接存在但编号有问题；还无依据地把回答归为模型自身知识 | 显示服务端具体原因，保留原回答与可跳转链接，暂停保存，不猜测回答来源。 |

原有 `citationCheck` 保留为通用的无引用 / 未收录判定；生产最终判定、capture 和 save 均调用 `checkAnswerCitations`。链接匹配和代码示例排除由 `retrieve.ts` 共用，标记语法复用 `EVIDENCE_MARK_RE`，规则只在 HANDBOOK「查询」定义。页内编号含义和页面 lint 未改变；严格链接格式仅用于新问答检查。

## 实际验证

- 红例：`pnpm exec vitest run server/chat-route.test.ts server/answers.test.ts` → **6 failed / 8 passed**；[日志](../../../tools/wiki-runtime/citations-red.log)。旧记录回归另行先红，旧代码实际进入 stub compiler；[日志](../../../tools/wiki-runtime/citations-legacy-red.log)。
- `pnpm check` → **62 files / 528 tests passed**，包含上述红例及两页同号、合法页面路由、越界编号、代码示例、推断与未收录兼容；类型、Lint、依赖方向、19 页内容检查和 wiki lint 通过；[日志](../../../tools/wiki-runtime/citations-check.log)。
- `pnpm build` → exit 0；[日志](../../../tools/wiki-runtime/citations-build.log)。
- `pnpm test:e2e tests/wiki.spec.ts tests/evidence.spec.ts tests/raw-source.spec.ts tests/wiki-review.spec.ts tests/wiki-reader.spec.ts --project chromium` → **27 passed (44.4s)**；生产预览 4173，实际 HTTP 快照 / capture / SSE 编排，模型输出为 fixture，无真实调用。[日志](../../../tools/wiki-runtime/citations-browser.log)、[已目视复核的截图](../../../test-results/wiki-review-real-citation--81485--marker-and-prevents-saving-chromium/citation-rejected.png)。新增用例确认具体原因可见、原链接可跳转、保存按钮不存在、编译调用数为 0；有效回答的原保存发布回归仍通过。
- `pnpm exec tsx tools/wiki-runtime/check-retained-citations.ts` → 使用历史请求绑定的冻结目录检查 **24 份**原回答；未改问题、请求、快照、回执或原语义评分。[结果](../../../tools/wiki-runtime/retained-citations.json)：Sonnet 前 / 后分别拦 3 / 2 份，Opus 前 / 后拦 2 / 1 份，共 8 份；其中 7 份未直接绑定编号，1 份无可识别页面引用。Opus 后答第 3 题的人类可理解引用也因不符新的直接链接格式被拦，这说明新契约更严格，不是新增的事实错误。其余通过不等于事实正确，上一轮的错误概括仍成立。
- 本轮新增模型费用 **0 美元**；之前的四个付费轮次保持关闭，总费用仍按已知 5.9398455 + 中断预留 0.50 = **6.4398455 美元**记账。

现有 Vite 关于未来 native config loader 的警告仍存在，未关闭或把它说成已解决。运行日志、冻结材料和截图在忽略目录，本地可复核；随代码交付的是此报告与稳定测试，原始材料需另行保留。

## 进度与剩余边界

全部 feature 仍为 0/4 完整完成，状态以各 feature 为准；本轮推进 F001 AC7 / AC8 和 F004 保存前校验，没有把完整 AC 勾成已完成。F003 / F004 的 plan 均已存在。

下一步仍需验证真实模型能否稳定遵守引用契约，以及如何减少控制流、因果和版本的错误概括；不通过修改旧答案或放宽评分制造通过。自动缺口记录 / 补页和持续维护尚未接入，当前知识积累仍需显式保存并审阅。

待用户决定：无。未解决：严格语义效果验收、自动知识积累与维护；本轮没有为这些项目声称完成。
