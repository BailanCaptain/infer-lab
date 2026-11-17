# 708 参数页标题门禁独立复审

- 结论：**Approved，0 P1 / 0 P2**。
- 授权：用户 `741` 框架优先；作者交付 `745`，任务 `0001794817151030-000708-d8ceeb60`。
- 检视人：砚砚；2026-11-16。工作区为未提交修改，以下文件 SHA 才是本次审定版本。

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/lint.ts` | `e7ad7cf20acc928692c242e5fa940e7db32f15e3135ca17025d4ee235a84d6cf` |
| `scripts/wiki/lint.test.ts` | `c1f66f5fd431fb5617ec952fbd276faa3c5e7e26e6c5ba9166ac6c27c9364122` |

## Why / What

参数页不再被四个固定标题阻挡。审查了 `lint.ts:190` 的标题配置、`:317` 的正文检查与 `:599` 的接入，并对照实际参数页候选。自定说明小节可通过，仅有生成区、来源区、空标题或代码示例的空壳仍被拒绝。旧标题仍在重复检测豁免表，来源编号、关系、事实表检查与发布时的旧事实、生成区保护未被本次改动取消。

## Evidence

砚砚独立执行：

- `node node_modules/vitest/vitest.mjs run --project wiki-integration scripts/wiki/lint.test.ts scripts/wiki/handbook.test.ts scripts/wiki/params/pages.test.ts scripts/wiki/params/ingest.test.ts scripts/wiki/revisions.test.ts`：**5 files / 98 tests passed**，exit 0，9.01s。
- `tsc -b --noEmit`、两文件 `biome check`、`node --import tsx scripts/check-deps.ts`：全部 exit 0。
- `vite build --outDir %TEMP%/infra-wiki-review-20261115/754-708-build-dist`：exit 0；日志 `754-708-build.log`，未覆盖现有预览服务使用的构建目录。
- 独立探针 `%TEMP%/infra-wiki-review-20261115/754-708-independent-probe.mts`：exit 0；同名 JSON 记录 7 个正反例，包括嵌套长度围栏内伪标题、波浪线代码块、纯生成区与空说明。完整正式页集合中仅在内存替换第三篇候选，得到 **errors=[] / warnings=[]**。
- 候选 `03-enable-super-kernel-ce990e186bfa.md` SHA `c18906ea533a6db74726d92089dcd7e8f451379761b2fcf87806d7b8bb8e1132`；正式页 SHA `c2cd68ecb004004228ef280b825812ef00c45cd656b76f4f754f17d18292a83d`。两个自动生成区逐字一致，未写正式页。

## Tradeoff

机器只判断有无说明结构与正文，不能据此宣称教学质量合格；实际事实与阅读审查仍独立进行。本次为参数页准入规则变更，无前端渲染改动。第三篇原有浏览器验收见 `734-super-kernel-rereview.md`；不把本次检查冒充新一轮教学验收或正式发布。

按用户741，框架工程可继续。24篇重做、163页内容改造及非工程必需教学精修保留为第二阶段。

## Open Questions

无。
