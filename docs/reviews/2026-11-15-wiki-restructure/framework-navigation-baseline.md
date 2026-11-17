# 阶段一导航兼容工程：当前断点与下一短批边界

依据唯一方案包 4、包 5及用户 `000741`，本页只记录可复现工程断点，不另立总方案，也不提前改动内容。

## 已实证的旧 ID 断点

root 运行 `%TEMP%/infra-wiki-review-20261115/framework-legacy-baseline.mts`，结果保存同名 JSON：

```json
{"manifestRetainsLegacyIds":false,"oldIdLoadsCanonicalPage":false,"oldIdHasPage":false,"loadPageCalls":[],"duplicateLegacyAccepted":true,"canonicalLegacyConflictAccepted":true}
```

- `src/content/wiki/schema.ts:177` frontmatter 未声明 `legacyIds`，解析后该字段被移除；`registrySchema` 没有此类全局冲突检查。
- `src/content/wiki/reader-store.ts` 的 `getPage`、`ensurePage` 只用精确 ID；输入旧 ID 不会加载对应规范页。
- `scripts/wiki/lint.ts:481` 起目前仅检查 ID/展示 aliases 冲突，没有旧路由 ID 的独立归属检查。
- 这批只增加机制与隔离样本，不迁移正式页、不把机器旧 ID 塞进展示 aliases。

## 同一导航路径上的已读实现

- `src/content/wiki/index.ts` 的 `rewriteRelativeLink(href, currentId)` 已能为纯页内锚点补当前页，但必须由调用方传 `currentId`。
- `src/app/wiki/ChatMarkdown.tsx:48` 不传当前页，纯 `#anchor` 原样进入 HashRouter 根路径；外链也未补新标签策略。
- `src/app/wiki/ChatDrawer.tsx:701` 推荐阅读仍为原生 `<a>`；需与正文使用同一 SPA 导航/滚动逻辑，验证页面及锚点变化。
- `src/app/wiki/DropReviewPreview.tsx` 的 `ReviewMarkdownLink` 已接 `currentId` 并区分外链/未发布 raw API；不要按旧方案行号重复改掉已修路径。审阅仍需验证，不可把未发布 raw 曝露到公开静态包。
- `src/content/wiki/anchors.ts` 已是标题 slug/百分号解码单一入口，`WikiPage` 已支持展开祖先 details 后滚动；旧路由重定向应保留 fragment 并复用它，不能另造锚点规则。

## 下一工程短批应证明的结果

1. 独立 `legacyIds` 字段，遵守 ID 语法；一个旧 ID 仅归一个规范页，不能占其他页的规范 ID。发布 lint 与 reader manifest/live install 均不得静默选中冲突页。
2. 构建快照与 live 快照共用规范解析；旧 URL 以 replace 重定向至规范 URL，保留原有查询/锚点，避免新增返回历史环路。加载只请求规范页一次；unknown 保持 missing，非路由 aliases 保持人类展示。
3. 实测直达旧 URL 的中文/百分号编码锚点、折叠区锚点、跨页/同页导航、返回键与快照切换，不能只测 helper。
4. 同一轮集中修复聊天页内锚点和推荐阅读的导航语义；共享实现只处理这些已证实路径，不扩成通用路由重构。桌面读者和原搜索入口保持可用。

本断点为 751 完成后的原 045 工程接续材料；751 的 UI 返修不混入本项。参数展示身份耦合已由另一个隔离探针 `framework-param-display-baseline.mts/json` 记录，留到 044 对应批次。全部正式内容、原缓存、旧 Review 与 3D 保留。
