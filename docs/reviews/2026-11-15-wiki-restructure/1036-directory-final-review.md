# 044 目录与前置阅读导览：独立终验

**Approved，0 P1 / 0 P2。** 2026-11-16 20:43 UTC，砚砚。审阅作者 `0001794861606277-001036-9a6e8396` 的八文件交付；仅批准目录/导览子段，044 和第一阶段整体尚未完成。HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f` 加下表工作区字节。

## 行为与边界

163 页保留且各出现一次，基础路线在综合请求案例之前，one-request 紧随双机部署页；17 个显式 toc 章节归属保留，同节按 curated 学习顺序插入，没有全局数值排序。RFork 前缀不会吞掉来源、PR、参数或对话页。request-overview 仅有可选槽位，未创建正文。

前置阅读从既有 builds-on 关系派生，保留声明顺序、说明和键盘链接。Flex 排序 P2 由 `.wiki-prereq-bar { order: 4 }` 闭合，导览位于摘要/元信息/别名之后、正文之前。惰性取页单测夹具错误也已独立转绿。正文、候选、旧 ID/锚点与冻结模块没有作为整改对象。

## 独立证据

- `1031-directory-inflight-check.json`：九项只读检查全通过，包含 163 页、17 个显式分组、可选概览槽位、RFork 类型边界及正式文章零修改。
- `1031-root-directory-foundation-tests.log`：toc / relations 两文件 22 项；`1036-directory-test-fixture-rerun.log`：WikiPage / 实际 `scripts/wiki/navigation.test.ts` 两文件 10 项，均 exit 0。原红灯保留。
- `tsc -b tsconfig.json --noEmit` exit 0（`1036-directory-tsc.log`）；八文件 Biome exit 0，无错误。完整 CSS 检查输出 19 条既有 specificity 警告，未报新增导览规则；check-deps exit 0，未顺手整改旧 CSS。
- `1036-root-directory-build.log`：独立 163 页 Vite 构建 exit 0，20:40:15 UTC 完成，正式页摘要不变。
- `1036-root-directory-final-green/report.json`：1440×900、`/nested/`、API 不可用的真实 Chromium **15 项全通过**，覆盖目录、前置链接/note、键盘、翻页、旧 ID/query/中文锚点、后退/前进和三栏。位置实测 aliases.bottom=380.77、nav.top=394.77、nav.bottom=494.77、body.top=555.77；原红例保留。
- 已实际查看本次 `01-prerequisites.png`、`02-panel-open.png`。右栏打开时 article.right=830.81 < panel.left=892.81，scrollWidth=1440，pageErrors=[]；临时浏览器和 HTTP 服务 finally 关闭。
- 作者另交十八项浏览器检查，包括无关系时零占位、聚焦 note、交互式 2D 步骤不重挂；此为作者补充证据，与 root 独立操作区分。

## 审定 SHA-256

| 文件 | SHA-256 |
| --- | --- |
| src/content/wiki/toc.ts | 7b8a928b1317035393d104b4b1c3b2a0bcfcc20b8267b072beb8cf056faca1a9 |
| src/content/wiki/toc.test.ts | 6e4ad438b62e1e68c2738d3961001c97e5003ae1922781f4fcba7226e073b7a0 |
| src/content/wiki/relations.ts | b5f3af63c42e4f31ee13a264dbe05926c9f5fc0f13581191be189c103ee6d757 |
| src/content/wiki/relations.test.ts | 16849b679629cf5b32e7e53e67ad3b5c815e58f3694ba65701fe47518ce461e4 |
| src/content/wiki/Term.tsx | c377a2e3c062ae652337c6982794e19d80c85c93133c2ea5c3240f31b7795d80 |
| src/app/pages/WikiPage.tsx | 59948fa36d930c20fceba71115653b8a34305d3dc13d89afb97c921885d39628 |
| src/app/pages/WikiPage.test.ts | 092a6cb001db0852d08fb422a7c83e597a718c77717f92124c98b04eb0023ff4 |
| src/design/wiki.css | 29329711340807790293e36259ff21df2e013f66f9e19ff8a62afa5b7d7b67e3 |

后续仍需关闭 `1036-e2e-negotiation-review.md` 的协议 P2，完成参数展示解耦、AST 只读预演与四类全流程。文章和独立产品仍待令；第一阶段最终独立签署后停工，现有服务保持。
