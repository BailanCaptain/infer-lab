# 覆盖判定快照契约独立复验

2026-11-17 00:18 UTC，砚砚。结论：**Approved，0 P1 / 0 P2**，限原 044 的 coverage 快照修复子批；阶段一整体仍未完成。

## 修改与判断

`server/coverage-work.ts:239` 从已经锁定的 `snapshot.pageTexts` 建立文件到完整源文本的映射，以同份 `snapshot.registry` 定位召回页，再 `parsePage(entry.file, original)` 提取正文。正文长度限制、truncated 披露、输入清洗、历史 revision 判断、结果引文校验及工作流锁检查保持原语义；没有读取变化中的磁盘页，也没有把 frontmatter 放回全文检索字段。

`server/coverage-work.test.ts:546` 增加真实快照回归：索引只含正文，`pageTexts` 保留 frontmatter，覆盖判定仍能读取正确正文且不向模型传入 frontmatter。实施过程中该用例曾被重复插入；1113 提醒后已移除重复副本，原有断言未删除。审阅差异中其余变化为导入顺序及格式化。

最终实际字节：

| 文件 | SHA-256 |
| --- | --- |
| `server/coverage-work.ts` | `18e5326d0837053018af3b4a61e4a05cfb556e48f2271745c20acc0b848efee8` |
| `server/coverage-work.test.ts` | `5465aa1c6534982820e91fa4f963305b0c8a3e72b4b003ac6601e6ab9bc35326` |

## root 实际验证

证据目录：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115`。

- 原红灯 `1094-coverage-isolated-red.log` 与全仓 `1083-root-full-vitest.log` 保留。相同生产修复字节独立运行 `vitest run server/coverage-work.test.ts scripts/wiki/worker.test.ts --reporter=dot`：2 文件 / 47 项通过，exit 0，45.01 秒，见 `1113-root-coverage-worker.log`。该次载入了上述临时重复用例；其后仅删除这一重复副本，独立回读确认测试语义未缩减，不把重复执行算作额外覆盖。
- `vitest run server/coverage.test.ts server/answer-quality.test.ts server/citations.test.ts --reporter=dot`：3 文件 / 41 项通过，exit 0，40.61 秒，见 `1113-root-coverage-adjacent.log`。包括相邻实际 HTTP、引用与问答质量路径。
- `tsc -b tsconfig.json --noEmit --pretty false`：exit 0，`1113-root-coverage-typecheck.log`；只读 Biome 两文件 exit 0，0 错误、1 条既有 optional-chain 警告、2 条既有字符串拼接提示；`node --import tsx scripts/check-deps.ts` exit 0。

有效覆盖包括召回与缺口分类、引文归属、受限正文、清洗、过期 revision、并发与回执复用、相关目录、补料及 worker 调用。不存在降低超时、放松断言、删除原测试或跳过门禁的变更。

作者最终回执 `0001794874799995-001115-a2467c17` 随后完整回读：两文件 SHA 与上表一致；五套完整回归通过，去重后单独运行 `coverage-work.test.ts` 为 36 / 36、exit 0；后台句柄为 0。该回执与 root 1114 已发布的独立 Approved 是同一组字节，不另开复审或返工。

## 边界与下一步

本结论关闭 `1094-coverage-snapshot-review.md` 的唯一 P2，不宣称完整 208 套全仓测试已通过；最终工程收口后仍须跑完整门禁。没有正式文章、3D、旧缓存、既有服务或付费模型调用变更。1107 回执两文件当前再次核对为审定 SHA，旧 1110 路径字面修改未保留。

下一独立短批是 `1108-negotiation-response-contract-review.md` 的实际模型预算响应契约，原批次停在 174 次；继续保留阶段一范围及终验后停工条件。用户待决事项：无。
