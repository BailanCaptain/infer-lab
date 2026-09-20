# 修订留痕与审阅 API 验收（2026-09-15）

**本轮补上显式修订分类、引擎生成的废弃记录、共用 HTTP 审阅接口，以及后端新请求读取新发布内容。** 工作位于 `infra-view-new-llm-wiki`，没有批量导入、真实 agent 调用或合入主干。完成状态只看 [F004](../../features/F004-knowledge-loop.md#design-decisions) 与 [F001 AC8](../../features/F001-llm-wiki.md#2026-09-14-当前验收核对)。

## 问题、影响与处理

| 级别与位置 | 影响、复现和证据 | 本轮处理 |
|---|---|---|
| P1 · HANDBOOK「整合」旧第 1 / 6 条 | 旧规则要求同 id 整页覆盖、新旧不同以草稿为准，不能满足旧结论被推翻时留痕的要求 | 修订必须显式分类与说明理由；推翻必须提供唯一匹配的旧文、新结论和来源，引擎保留废弃记录，人工审最终 diff |
| P2 · `server/index.ts` 启动时的 registry / index 常量 | 服务启动后发布新页，仍用旧索引；新知识无法进入新的预检索 | 改为 `server/snapshot.ts:11` 在共用短锁内逐请求读取正式 markdown、派生目录与关系及规则。实际服务不重启，页数从 1 变成 2，新检索命中 b |
| P2 · `server/index.ts:26` 输入处理 | 实际服务测试发送 JSON `null`，出现 `fetch failed / ECONNRESET`；原代码会直接访问字段并 `.trim()` | 入口用 schema 检查 message 和 sessionId；null、数字 message、空 message / 非字符串 sessionId 均返回 400，后续健康检查与批准继续成功 |

## 本轮实现与证据

1. **修订的单一机器契约**：`scripts/wiki/revisions.ts:8`。现有正文修改需声明 supplement / editorial / supersede 及理由；纯 frontmatter 改动可省略。supplement 检查旧正文非空行依序保留；editorial 的“未改变事实”仍由人审，不是假装算法能判定语义。
2. **废弃记录由引擎生成**：`scripts/wiki/revisions.ts:69`。旧说法须唯一匹配旧正文，替代结论须出现在候选正文，依据必须列入候选 sources；日期由整合器给出。历史原文放在代码块中，单列旧来源编号，新来源顺序不变；既有历史保留。原文不存在、替代结论不存在、依据未列入 sources、伪造历史和删改伪装成补充均有失败测试。
3. **批准再次核对历史**：`scripts/wiki/revisions.ts:133` 与 `scripts/wiki/review.ts`。包括旧政策下产生但尚未批准的提案；缺修订分类或历史被改不能靠旧 revision 跳过新检查，需重新整合。已完成的发布仍按原有幂等规则处理。
4. **HTTP 复用已有发布器**：`server/review.ts:77`、`server/review.test.ts:86`。GET 列表与完整候选 diff；POST 批准 / 驳回只接受既有 revision，不允许客户端传文件路径、内容或新的任务处置。路由和 body 的 revision 必须一致，关联 job 由 manifest 核对。跨站写、缺专用头、超大请求、非法方法、过期基础文件及重复批准均有实际 HTTP fixture。
5. **真实服务进程验证**：`server/snapshot.test.ts:28` 启动实际 `server/index.ts`，不是只 mock handler。批准前 health=1，模拟未完成发布时 health=503，经 HTTP 续写同一批准内容后 health=2；新检索命中新增页，之前取得的视图仍只有 1 页。全程没有调用问答模型。

完整路径的 fixture 使用同一条“X 默认开启”→“X 已被移除”修订：模拟 agent 提交声明 → 引擎生成历史 → 待审 diff → 真实 HTTP approve → 默认 lint / audit / build → 正式页同时保留新结论、旧原文、日期和依据。纯补充不会生成废弃节。源码行存在、来源 hash 正确仍不能证明语义解释正确。

## 验证命令

```text
pnpm check
  Test Files 52 passed (52)
  Tests      476 passed (476)
  ok 依赖方向检查通过
  ok 内容校验：registry 19 页
  ok 内容校验：尚无章节，Term 引用检查跳过
  ok wiki:lint 通过
```

exit 0，包含 typecheck / Biome。既有 CSS 1 warning、Biome 配置 2 infos 保留。新增 revisions / review API 测试先因缺模块失败，再实现并通过；输入异常测试实际先出现 ECONNRESET，再返回 400。没有把“no tests”算作通过。

server 目录不在现有 Biome 文件扫描范围内，因此额外将本轮 5 个 server 文件逐一送入 Biome stdin 检查；最终均 exit 0，格式化输出与当前文件逐字相同。`git diff --check`、`git diff --exit-code -- wiki/raw` 均 exit 0。

`pnpm build` exit 0，`built in 3.27s`。真实工作树的 `wiki:review list` 与 `wiki:jobs list` 都是 `[]`。文档正文的本地链接检查覆盖 19 份 feature / plan 文档、86 个链接，缺失 0；代码示例不作为实际文档链接。

## API 调用约定

- `GET /api/wiki/reviews`：列表；`GET /api/wiki/reviews/<revision>`：状态、决策、固定候选与 diff。
- `POST /api/wiki/reviews/<revision>/approve`：JSON `{ "revision": "<同一路由的 revision>" }`。
- `POST /api/wiki/reviews/<revision>/reject`：同上，加非空 `reason`。
- 写请求使用 `Content-Type: application/json` 与 `X-Wiki-Review: 1`；浏览器请求必须与本机 Host 同源，可通过现有 Vite 代理。无跨站 CORS 放行，不提供任意文件写入或解除隔离入口。
- 已批准发布的进程锁遗留仍按 CLI `wiki:review recover` 显式核对和恢复；HTTP 不自动清理死锁。

## 进度与限制

- F001 / F004 的共享地基前进了一步；F002、F003 本轮没有新增实现。T3 仍部分完成：脚本版本更新纳入 diff、浏览器审阅和完整问答保存链尚缺。
- AC7 的确定性保留行为已验证，**真实 agent 能否正确区分编辑与事实推翻尚未验证**；完整 AC 不打勾。人审须看分类、理由、旧文、新文及证据，而非只看来源是否存在。
- 后端预检索视图按请求固定，但运行中的 agent 仍读取正式目录；尚无覆盖整个 agent 生命周期的文件快照隔离。读者页面的刷新体验本轮未改、未做浏览器验收。
- 本轮没有真实聊天保存或独立模型会话复问。因此仍不能宣称“越用越聪明”闭环已完成；下一步接入答案保存和浏览器审阅，再验证后续会话的答案是否正确、有来源且保留版本边界。

待用户决定的问题：无。
