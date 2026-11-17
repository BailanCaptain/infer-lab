# 044 目录与导览：在途独立检查

2026-11-16 20:29 UTC，砚砚。此为 1031 当前代码的在途实证，不是作者最终交付验收；第一阶段与 044 均未完成。

## 已通过

- `1031-directory-inflight-check.json`：只读生产 `buildToc` 九项全部通过，163 页各一次、17 个显式分组归属保留、基础路线和综合请求页顺序、可选概览槽位与 RFork 类型隔离正确，正式文章未变。
- `1031-root-directory-foundation-tests.log`：toc / relations 两文件 22 项通过。首个命令误列了不存在的 `src/content/wiki/navigation.test.ts`，未计作已运行；随后按实际 `scripts/wiki/navigation.test.ts` 路径运行，见下方结果。
- `1031-root-directory-build.log`：独立 163 页生产构建 exit 0，完成于 20:27:51 UTC。
- `1031-root-directory-browser-green/report.json`：原十四项浏览器检查通过，包括语义导航出现、真实关系链接/说明、键盘 Enter、目录与翻页一致、旧 ID/query/中文锚点、单步后退与前进、1440px 三栏无重叠，pageErrors 为空、临时服务和浏览器均关闭。两张截图均已实际查看。

## 本段待修

**P2：页头导览视觉次序与约定相反。** `src/design/wiki.css` 的新 `.wiki-prereq-bar` 没有衔接 `src/design/knowledge-reader.css:591` 的页头 Flex 排序。现有标题 order 0、摘要 1、元信息 2、别名 3；新 nav 默认为 0，虽然 JSX 放在别名之后，实际显示在标题与摘要之间。应依 1014/1031 将紧凑导览置于摘要/别名之后、正文之前，保持视觉与阅读顺序一致。

复现：在同一生产构建的 `/#/wiki/quantization`、1440×900 视口测量。`1031-root-prerequisite-order-red/report.json` 中 nav.top=246.39、summary.bottom=408.77、aliases.bottom=492.77，`prerequisitesFollowSummaryAndAliases=false`，其余十四项仍通过。补充断言已加入 `1024-directory-browser.mts`，未覆盖原结果。

此外，新单测尚未转绿：`1031-root-directory-ui-tests.log` 运行 WikiPage 与真实 navigation 两文件，9 passed / 1 failed。`WikiPage.test.ts:131` 直接读取 `getPage("quantization")!.fm` 得到 undefined。应使用符合读者惰性加载/快照状态的独立夹具或初始化方式完成该断言，不能删除断言代替验证。这是当前在途验证结果，等待作者最终闭环。

正式文章、旧缓存、历史 Review、3D 与既有服务均未作为修复对象。
