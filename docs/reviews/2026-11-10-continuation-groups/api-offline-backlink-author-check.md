# API 入口到离线队列的短回链

作者：queue_final_review。本项与后续结构化输出/工具边界修订分开保存，等待根代理独立审查。

在 API 页“几种变体”末尾增加一段：脚本分批准备输入、统一取结果时转到请求调用链的离线队列小节，并概括提交返回 ID、默认后台可先计算。完整机制留在唯一解释页。API 的原正文、来源、metadata 和四幅图均未删除或改写；来源及 frontmatter 比较相同，旧 8 个图文件 SHA 相同。

独立快照与差异：`.tmp/continuation-groups-2026-11-10/api-offline-backlink/before.zip`、`api-offline-only.diff`；改后冻结副本 `api-server-entry-after-offline.md`。结构化组随后以此版本另存基线，不将两项混作一个 diff。

- 改前 API SHA：`b220e4ce0dd028823aa654e641dd69fbf2e91e497738644729a280129dc0f109`
- 仅加回链后的 SHA：`224f773796f86f3e917c72d7e7bec3a672498bf322d353d79a4bee1744136f0f`

实际运行 `node .tmp/continuation-groups-2026-11-10/review-api-offline-backlink.mjs`，1440×1100 浏览器打开 API 页，查看前两屏、回链段落，并实际点击到目标小节；四张截图均逐张 view_image 阅读。目标标题位于顶部约 108 px，无错页或锚点丢失；errors=[]、overflow=false，浏览器前后 SHA 相同。证据在同目录 `browser.json` 及四张截图。未改模型运行行为、未运行模型推理；全站检查由根代理统一做。
