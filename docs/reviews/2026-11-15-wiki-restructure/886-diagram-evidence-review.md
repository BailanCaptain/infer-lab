# 045 图下证据入口与多 pin 独立复审

结论：**Approved，0 P1 / 0 P2**。868 正文来源入口与本轮图入口合在一起，完成本次离线证据面板子批；不代表整个 045、框架阶段或全库内容改造完成。

接受来源：`0001794837016299-000878-aedb65fd`；作者交付：`0001794838638039-000886-ec703e94`；原 Task：`0001794686458967-000045-b7a20aea`。检视者：砚砚 / gpt-6-astra。工作树基点 HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f`，未提交审定字节以下列 SHA-256 为准。

## 审定对象

| 文件 | SHA-256 |
| --- | --- |
| `src/content/wiki/WikiDiagram.tsx` | `16f83ba9ca3167f5bd3784a609e88410f3244f955b1cbb75b2b5433278e2e91c` |
| `src/app/wiki/EvidencePane.tsx` | `f06d1ff27b87f12645bca03efbb01d9c778396be62cea16ee881fdec0f0908c2` |
| `src/app/pages/WikiPage.tsx` | `b0bb9ffd2734ac581061aca8f7e6c68c06403e912adc0ae113d3e9668b6a3ae3` |
| `src/design/wiki.css` | `6e55ec0b060378758ab4b43dbdc92ef61cc9187012501353e58a06264cc22b11` |
| `src/app/wiki/EvidencePane.test.tsx` | `aedfdae6f45debf596d0931bd7363af1c36d3083e2b9efb12f174cad12507444` |

测试与浏览器运行结束后再次读取，以上 SHA 均与 886 一致。`WikiPanel.tsx` 仍为 `798c0b0d…`；`DropReviewPreview.tsx` 仍为 `c331faef…`。

## 实现检视

- `WikiDiagram.tsx:33` 的可选入口只在调用者显式提供回调时出现。`ReviewPane.tsx:75` 的实际 `ReviewSvgAssets` 调用未传回调，因此未发布图不会根据正式页 ID 请求证据；本轮测试直接检查这一真实预览组件。
- `WikiPage.tsx:154` 将当前规范页 ID、revision 与图 ID 送到已审控制器；`WikiFence` 保持模块级组件类型，`DiagramEvidenceContext` 只注入回调，未改变 `wiki-scene` 分支或 3D 实现。浏览器确认开关证据与多 pin 切换不替换原 SVG 节点；这不是新的 3D 播放验收。
- EvidencePane 按图包的 `pinIndex`、精确 `ref` 与 `symbols` 显示，不用页级粗范围代替。相同文件和行段上的不同符号仍分别可选。无 pins 的概念图有明确空态，切换回正文来源后清除图 pin 列表。
- 新 CSS 仅增加图下按钮和符号文字样式。实际 1440px 下六个 pin 标签可读、可换行；右栏与正文、本页目录按钮分离。

## Reviewer 实跑证据

所有临时路径以下均以 `%TEMP%/infra-wiki-review-20261115/` 为根。

1. 独立旧构建红灯：`878-root-diagram-evidence-probe.mjs` 在 868 已审构建运行，58 项中仅四个尚未接线的图入口及量化六个异范围 pin 的计数失败，`errors=[]`。保留 `878-root-diagram-evidence-red/report.json`。新 UI 为无 pin 图提供专用 `evidence-diagram-empty` 后，探针只调整空态选择器，未降低真实数据断言。
2. `node node_modules/vitest/vitest.mjs run src/app/wiki/EvidencePane.test.tsx src/content/wiki/WikiDiagram.test.ts src/app/pages/WikiPage.test.ts src/app/wiki/ChatDrawer.test.tsx src/app/wiki/ReviewPane.test.tsx src/content/wiki/evidence.test.ts --reporter=dot`：**6 files / 20 tests passed，exit 0**；日志 `886-root-ui-tests.log`。
3. `tsc -b --noEmit`、`node --import tsx scripts/check-deps.ts`、五个审定文件的 `biome check`：**全部 exit 0**。Biome 为 **0 error / 19 个既有 CSS warnings**，不写成零告警；日志分别为 `886-root-tsc.log`、`886-root-deps.log`、`886-root-biome.log`。
4. `node --import tsx 868-evidence-ui-fixture-build.mts --existing`：**真实 Vite 应用隔离生产构建 exit 0**；日志 `886-root-ui-build.log`。四篇正式页副本与受控边界页位于 `868-evidence-ui-fixture-BkNv9z`，没有修改正式正文以适配验收。
5. `878-root-diagram-evidence-probe.mjs <fixture-dist> 886-root-diagram-evidence-green`：**Chromium 90/90 项通过，15 个 pin 全部实际操作，errors=[]**。使用随机临时环回端口、`/nested/`、1440×900 与全部 API 中止；报告 `886-root-diagram-evidence-green/report.json`。

| 真实页面样本 | 实际核验 |
| --- | --- |
| chunked-prefill | 两张图共 7 个 pin；逐行源码、行号、符号、固定外链准确；正文 repo、725 行 raw 快照及外链卡片保持可用 |
| quantization | 两张有 pin 图共 8 个 pin，6 个实例不同于页级来源范围；逐个精确匹配；两张无 pin 图显示空态 |
| enable-super-kernel-ce990e186bfa | 无图，不强塞图；repo、346 行 raw 快照及外链入口均精确显示 |
| inference-troubleshooting | 两张无 pin 图为空态；正式固定源码与外部参考入口可用 |

对每个有 pin 图：Enter 打开，Enter/Space 交替切换每个 pin，检查 `aria-pressed`、逐行文本、行号、符号与固定提交外链；重复点击图按钮回到首 pin，未重新下载证据包、未替换原 SVG。每个样本首次打开零证据请求，交互期间只请求本页一份证据包，零额外页面 JS；SPA 换页旧选择清空，保持同一浏览器文档。

1440px 几何：正文 `302–830.8125`，右栏 `892.8125–1440`，document scrollWidth `1440`。截图 `01-quantization-exact-pins.png`、`02-parameter-source.png` 已实际查看。临时 HTTP 服务与 Chromium 均在 finally 关闭；root 本轮三个命令句柄都已 exit 0。作者 886 另报告零后台句柄；作者记录与 root 实跑结果不混算测试总数。

## 下一批范围

沿唯一方案包 4 推进 figure 的 bend/等宽字体与三类提醒移除、伴生 YAML + 原生 SVG 双通道、人工白名单静态注册交互 React 2D，再处理既定 P3 阅读交互及 044 工程。这里的双通道不是“已有静态总览加分镜播放器”；不得把既有 DiagramPlayer 重做当作 native-svg 交付。

图 pins 独立阅读已具备，后续可以移除图符号必须在页级 sources 重复登记的限制，同时保留固定 Git blob 的 symbol 校验、几何门禁、正向 SVG 清洗与整组 Review。实际入口证据见 `868-2d-engineering-baseline.md`。框架四类录入到问答回流 E2E 与阶段二 24/163 内容仍未完成；3D、仿真、旧缓存、历史 Review、既有服务边界保持。无需用户再次决定。
