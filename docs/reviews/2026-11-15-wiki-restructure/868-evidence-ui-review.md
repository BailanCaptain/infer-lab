# 045 离线证据 UI 第 1 段独立复审

结论：**Approved，0 P1 / 0 P2**。仅审定 868 的正文角标/来源列表 → EvidencePane / WikiPanel 接线及下列五文件，不代表整个证据面板子批、045 或框架阶段完成。本结论来自 reviewer 实际在盘代码、构建与操作证据。作者随后通过 `0001794837088360-000880-7f0549c7` 提交最终回执，五个文件的 SHA-256 经再次读取全部与下表相同；作者报告本短轮临时服务、浏览器及命令句柄均已收口。

接受来源：本线程 `0001794835212181-000868-7352dd20`，原 Task `0001794686458967-000045-b7a20aea`，沿用户 741/839 框架优先授权。检视者：砚砚 / gpt-6-astra。HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f` 为未提交工作树基点，精确审定对象以下 SHA-256 为准。

## 审定文件

| 文件 | SHA-256 |
| --- | --- |
| `src/app/wiki/EvidencePane.tsx` | `d0974ba8034839a29613d13699d9c6e6da4935655fcae45e0b6464c14619562e` |
| `src/app/wiki/EvidencePane.test.tsx` | `7cd3358333b943a870bd7cd3264e2d3ef9ab2a4b97010810b437079ff978ccb7` |
| `src/app/wiki/WikiPanel.tsx` | `798c0b0dd264ff2ffd586ff1ba2fd90300fe7ceb17ad350122329bd8ab42d149` |
| `src/app/pages/WikiPage.tsx` | `0149570c2fbac83fccc4b200f31a82db6680b9f9526f6aeb4f6a40bcc6bb5ead` |
| `src/design/wiki.css` | `82033c81154496727c66f99fc5891f2b4c955fa6b9a509873dc51f282f1fd930` |

## 结果与源码检视

- 已知来源角标保留原外链 href；普通主键/键盘激活使用既有 plain-primary 守卫打开证据面板，修饰键保留原生浏览器操作。未知仓库即使无法构造外链也提供按钮入口。
- EvidencePane 通过已审控制器/reader-store 读取同版本证据包，状态分别显示加载、失败可重试、真实 repo/raw 摘录、无快照外部 URL 和不可用原因。摘录采用 React 文本节点及真实行号，未引入 HTML 直插。未指定范围的 405 行文件明确展示前 400 行。
- 来源列表同时保留就地核对按钮与原外链动作。WikiPanel 延用推挤网格、既有常驻状态与页签；关闭证据页签不会调用 chat.stop，跨页清空、同页新快照重查均接上控制器。
- 本轮未修改业务数据或正式文章。`WikiDiagram` 的图下证据入口仍未接线，属于紧接下一短段；多 pin 控制器/显示组件的存在不等于入口已交付。

## Reviewer 本轮实际验证

命令工作目录为项目根；Node 使用 `C:/Program Files/nodejs/node.exe`。

1. `node node_modules/vitest/vitest.mjs run src/app/wiki/EvidencePane.test.tsx src/app/pages/WikiPage.test.ts src/app/wiki/ChatDrawer.test.tsx src/content/wiki/evidence.test.ts src/content/wiki/reader-store.test.ts --reporter=dot`：**5 files / 25 tests passed，exit 0**。日志 `%TEMP%/infra-wiki-review-20261115/868-root-ui-tests-green.log`。
2. `node node_modules/typescript/bin/tsc -b --noEmit`、`node --import tsx scripts/check-deps.ts`、上述五文件 `biome check`：均 **exit 0**。Biome **0 error / 19 warnings**，警告位置均在原 CSS 段（最高到 3151 行，证据样式新增段始于 3188 附近），未把 warning 说成零；保留旧样式，不为本轮重排全库。日志 `868-root-ui-biome.log`。
3. `node --import tsx %TEMP%/infra-wiki-review-20261115/868-evidence-ui-fixture-build.mts --existing`：**实际 Vite 应用隔离构建 exit 0**，日志 `868-root-ui-final-build.log`。临时五页夹具含四篇正式页副本及一个受控证据边界页，使用固定 Git commit 和合法 published raw；正式 wiki 没有适配写入。
4. `868-root-evidence-ui-probe.mjs <fixture-dist> 868-root-evidence-ui-final`：真实 Chromium，随机环回端口，`/nested/`，全部 `/api/**` 中止；**23/23 项通过，errors=[]**。报告 `868-root-evidence-ui-final/report.json`：
   - 首屏零证据下载，第一包故障后无刷新重试；只请求当前页证据包。
   - 正文角标打开对应来源，repo `83–214` 行及 raw `1–4` 行全部与固定证据包逐行精确相等。
   - 原文 `<img onerror=...>` / `<script>` 作为可见文字呈现，无对应 DOM 元素、无副作用标记、无探针网络请求；外部 URL 不被自动抓取。
   - 无 GitHub 映射但已配置的仓库仍可看本地源码，未知仓库、缺文件和零起范围分别诚实显示；400/405 行截断提示正确。
   - 来源列表 Enter 激活、原外链入口保留、切换/关闭证据后的既有完成问答保留、跨页清空均通过。
   - 1440×900 下正文右缘 `830.8125`、面板左缘 `892.8125`，面板右缘 `1440`、文档 scrollWidth `1440`。本页目录退为可见按钮，右缘 `878.8125`，未被证据面板遮盖。
5. `868-root-evidence-live-probe.mts 868-root-evidence-live-final`：真实应用加临时服务返回**隔离目录实际 `readReaderSnapshotWithEvidenceLock` / `buildPageEvidenceFromLocked`** 的新快照，非手造 UI 数据；**6/6 项通过，errors=[]**。主动延迟旧静态包，使新 revision 的 `85–90` 行先到；释放旧 `83–214` 包后 UI 仍保持新行内容。该测试只验证刷新竞态，不宣称进行过正式发布或四类全链路 E2E。

本轮第一遍在作者仍收口时实测看到一处文案断言失败、测试夹具缺 `order`/`prerequisites` 的 TS2769 和来源列表 index key lint 错误。作者已落盘修正，以上门禁为修正后重新运行的最终结果，没有降低断言或跳过用例。首版浏览器 probe 的 TOC 选择器修正为真实 `.wiki-pagetoc-side` 后，在最终构建另加可见目录按钮检查，不用旧 null 值冒充目录验证。

截图：`868-root-evidence-ui-final/01-error-retry.png`、`02-raw-literal.png`、`03-desktop-push-layout.png`；已目视检视原文纯文本截图与最终桌面三栏截图。Live 截图 `868-root-evidence-live-final/01-live-current-range.png`。上述路径均在 `%TEMP%/infra-wiki-review-20261115/`。临时 HTTP/Chromium 均在 finally 关闭，root 没有存活命令句柄；author 句柄状态以其回执为准。

## 紧接下一棒与边界

下一独立短轮已通过 `0001794837016299-000878-aedb65fd` 在同一 045 派发：图下“对照源码”、精确多 pin 切换及概念/公式/参数/排障四类真实页浏览器回归。880 交付后，生命周期工具确认烁烁已由新 invocation `ab371edb-186f-477d-9ef4-3ac5f3bf73cc` 接续包含 878 的消息组，旧 868 轮次已结束；没有重复派工或中止正常执行。复用本轮隔离夹具，不把图 pin 偷换成页 sources 的粗范围。随后继续 2D 双通道、既定阅读交互、044 工程与四类真实读写问答 E2E；24/163 全库内容改造仍属阶段二。没有待用户决定的问题。
