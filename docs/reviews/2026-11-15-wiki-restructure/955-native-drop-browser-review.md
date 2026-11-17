# 原生 SVG Drop：真实 Review 与静态阅读独立浏览器验收

2026-11-16 17:12 UTC 实测，砚砚 / gpt-6-astra。**本浏览器子批通过，0 P1 / 0 P2。** 这不批准整个 045：`953-native-drop-rereview.md` 的 128K 长篇修订预算 P2 仍未闭合。17:16 UTC 对最新 `9546dc27…` 代码运行原独立预算探针，仍为输入 28562 > 27403 字节；结果另存 `955-budget-current-probe.json`，原红灯不覆盖。

## Why / What

在全新隔离目录中以实际 `acceptBatch → startDrop → 默认 validateIntegration / AC11 → 整组 Review` 形成待审包，随后用真实 Chromium 点击批准发布，再以发布后的快照构建静态网站并断开全部 API 验收。原生 SVG 修改为两个页面共享图，YAML 不变；图有两个固定 Git blob pin，未在页面 `sources` 重复登记。

夹具使用确定性、零付费 RunAgent；模型语义质量不在本次证据范围。Review API、批准发布、快照、静态构建、正文与证据 UI 均运行真实代码，没有替换批准 API 或绕过资产验证。

## Evidence

- 脚本：`%TEMP%/infra-wiki-review-20261115/955-native-drop-ui-fixture.mts` 与 `955-native-drop-ui-browser.mts`，两次实际运行均 exit 0。
- 隔离根目录：`%TEMP%/infra-wiki-review-20261115/955-native-drop-ui-voLTQ8`。实际新 Review：`1f1230c360c7866eca8cb3292991c8199074df252187e07193377e5306676a38`。批准前新正式页不存在，原 SVG 保持原字节。
- `1440×900` Chromium、`/nested/` 子路径、临时回环端口 60830：审阅预览正确保留 CDATA 文本 `device A=4 / device B=4; ready && q < k` 与标题 `原生队列配置 & 边界`，未发布预览内证据按钮数为 0，活动脚本元素数为 0。
- 点击真实「批准此版本并发布」，发出 `POST /api/wiki/reviews/<id>/approve`，Review 变为 `published`；发布的 SVG 与输入原字节完全一致，包含原注释与排版。
- 实时发布后正文以及重新构建、全部 API 返回 503 的静态正文，两个 pin 都分别显示 `scheduler.py#L1-L2` 的 `NativeScheduler`、`#L2-L3` 的 `schedule_step`。逐行文本与本地固定 commit `e9db929573f826113135671bec3350dea77f7d4b` 完全一致。
- 静态首屏证据请求 0 次，首次点击及两个 pin 切换总共只下载 1 个证据 JSON；页面错误为空。正文右缘 830.8125 ≤ 面板左缘 893.8125，页面 scrollWidth 1440，无三栏重叠。
- 报告：`%TEMP%/infra-wiki-review-20261115/955-native-drop-ui-browser/report.json`，`allPassed=true`、`errors=[]`、`closed=true`。三张截图 `01-real-review-preview.png`、`02-published-native-live-pin.png`、`03-api-off-native-pin-1440.png` 已实际逐张查看；窄正文与审阅栏保留现有图内横向滚动及提示。

## 核对版本

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/drop-integration.ts` | `9546dc27004fd9ab0d1da0eea48e010b1a66f4f215765f2e387fbf39248e7312` |
| `scripts/wiki/drop-assets.ts` | `7985fb02c1a85956047194606ab2245e8b27209a93854db0f51f1c6c126d9c85` |
| `scripts/wiki/drop-receipt.ts` | `a18012a694b0f13f0b3c0d60b879270960de8596c81006b7c28600ca7f03a941` |
| `src/app/wiki/DropReviewPreview.tsx` | `c331faefa1a29271e40dcda38c6aa1ab443db17f6ec840450f858106577c4752` |
| `src/app/wiki/ReviewPane.tsx` | `9f28dff8792f87bffb1a8fb916dd44203d62601f043932ffcafadf8ae4da6862` |
| `src/content/wiki/WikiDiagram.tsx` | `16f83ba9ca3167f5bd3784a609e88410f3244f955b1cbb75b2b5433278e2e91c` |
| `src/app/wiki/EvidencePane.tsx` | `f06d1ff27b87f12645bca03efbb01d9c778396be62cea16ee881fdec0f0908c2` |
| `src/app/pages/WikiPage.tsx` | `b0bb9ffd2734ac581061aca8f7e6c68c06403e912adc0ae113d3e9668b6a3ae3` |

## Tradeoff / Open Questions

未改正式知识库、3D/仿真、旧 888 Review、原 210 次调用缓存及既有服务。临时 HTTP 服务和 Chromium 在 finally 中关闭，隔离文件与报告保留。可恢复发布中断路径已有本轮集成回归证据，本次浏览器只验证正常真实点击路径；不冒充四类样本总 E2E 或阶段一整体完成。

剩余唯一当前代码问题是 953 的预算 P2；无新增需用户决定的问题。作者无须重复本次未变的浏览器场景，先完成预算修复与定向回归。
