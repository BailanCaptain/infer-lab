# 045 原生 SVG 共同入口：910 返修独立复验

结论：**Approved，0 P1 / 0 P2**。907 的两项 P2 已在下列最终字节的 CLI、真实 Chromium、生产页面与格式/类型/依赖检查上闭合。本结论仅覆盖原生 SVG 第 1 轮共同入口；Task 045 和 Drop 输出第 2 轮尚未完成。

接受来源：`0001794843369483-000910-7db5febf`；同根补充 912；原始范围 902、交付 907。检视者：砚砚 / gpt-6-astra，工作区 HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f`。首轮九文件审定时间：2026-11-16 15:58 UTC（915）。收到最终回执 `0001794844805217-000917-1fb809f0` 后，root 补验其中新增披露的快照入口与清洗器测试，2026-11-16 16:06 UTC 将审定范围补齐为以下 **11 文件**。批准基于在盘字节及独立实测，不以聊天自评替代验证。

## 最终审定字节

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/native-svg.ts` | `9e1bbdd306425ddb60334fefe5eb562dece8e6f8c1743338d23655219a8702a7` |
| `scripts/wiki/diagrams.ts` | `7eea49adc5221a6c52475a109b96e261e68307bcfdc7075677ad233a7a0ae344` |
| `scripts/wiki-diagrams.ts` | `87a0a8e2c9cfcc6cf499f6a0c9752b0ea700780c112c42565b55673afe020bb3` |
| `scripts/wiki/drop-assets.ts` | `121314477f358e766edd07c1ce64ef9c710ae6d83620471ff212f160d40f6212` |
| `scripts/wiki/diagrams.test.ts` | `ab1c31b7ae68af37def5ff9df284435c69efb6b6cd214b5c03d8750410f9ab30` |
| `scripts/wiki/diagram-cli.test.ts` | `fc33c70f5795639022148d99df3b72dede61778c39aef124b056316dc9790f89` |
| `scripts/wiki/figure.test.ts` | `c87d1f4a5499abc900e24930f957427be803486e15ae5a49d8a263636fe6f8a2` |
| `src/content/wiki/diagram-sanitize.ts` | `0f56971fb9fc2ebb21fce6dfddd18f702dbc44071776f7891aa7ae043cd2a01c` |
| `src/content/wiki/WikiDiagram.test.ts` | `f8487fda8b5a299718b0bd4089ba27620ea322a76a5c596f52e0f2c2da00c0ea` |
| `server/snapshot.ts` | `d0f347f66966620e4c0cfc5b745db2759276f79e493d1dd3b041ac4f43a41914` |
| `scripts/wiki/diagram-sanitize.test.ts` | `22d353848cf2bf59734f37e518744ca1f0c76ec3d3a0a5e4c566086c82d41e9c` |

## 修复核验

1. `scripts/wiki/native-svg.ts` 对 XML 声明的 version、encoding、standalone、顺序与重复属性显式检查；字面 CRLF/CR 先按 XML 文本输入规则处理，属性中的字面空白与字符引用分开解码。因此声明漏检和合法属性折行误拒同时闭合，不改写 SVG 原字节，也未放宽安全属性表。
2. `src/content/wiki/diagram-sanitize.ts` 将 CDATA 作为纯文本重建；标题扫描跳过注释、外部 CDATA 与处理指令，处理 title 属性、混合文本与单次实体解码。`<script>` / `<img onerror>` 字面文本不会变成元素，原有正向安全清洗、图内 id 作用域与 Review 隔离入口保留。

## Root 本轮实际证据

所有下列临时文件均位于 `%TEMP%/infra-wiki-review-20261115/`。root 未修改生产实现。

- `907-native-xml-semantics-probe.mts 910-root-xml-semantics-green.json`：12 组原反例逐一经过真实 Node 校验、CLI 与 Chromium。4 类非法声明被拒且不改 SVG；合法声明、属性折行、CDATA/混合文本、标题属性、注释干扰与 CDATA/普通实体混合均正确保留，exit 0。907/910 的原始红灯报告保留。
- `902-native-acceptance-cases.mts --cli 910-root-native-acceptance-green.json`：20 组既定配套/身份/尺寸/XML/安全案例全部符合预期，包含合法输入 check + 连续两次生成保留字节、19 类负例拒绝且不修改原文件，exit 0。
- `910-native-declaration-oracle.mts`：另做 17 种声明的 Node/Chromium 对照，无 Node 接纳而 Chromium 拒绝的输入。两个非法声明形式（version 中字符实体、encoding 内换行）被严格 Node 语法拒绝而 Chromium 较宽松；不要求放宽 Node 来接受这些形式。
- 9 文件 **80 测试 passed，exit 0**：`diagrams.test.ts`、`diagram-cli.test.ts`、`snapshot-diagram.test.ts`、`figure.test.ts`、`diagram-audit.test.ts`、`diagram-sanitize.test.ts`、`drop-assets.test.ts`、`WikiDiagram.test.ts`、`ReviewPane.test.tsx`。日志 `910-root-tests.log`。首次 Biome 检查指出三个文件格式差异和一处 optional-chain 建议，作者收口后 root 复跑 **TypeScript、9 文件 Biome、check-deps 均 exit 0**；最后改动仅格式和等价 optional-chain，浏览器 sanitizer 字节未再变化。最终字节上定向 `diagrams.test.ts` + `WikiDiagram.test.ts` **2 文件 19 测试全过**，日志 `910-final-targeted-tests.log`。不把首次格式失败记为绿灯，也不把两个测试集合相加冒充独立用例数。
- `910-native-ui-green-build.mts`：真实隔离 Vite 构建 exit 0，产物 `910-native-ui-HDsupb/dist`，日志 `910-root-native-ui-build.log`。API 全中止、`/nested/`、1440×900 Chromium 正文 10 种案例全部 `data-status=ok`，文字/title/figcaption 与 XML 原文精确相符；带 BOM 合法声明与注释正常展示。
- `910-native-ui-browser.mjs`：通过受控只读 Review API 响应打开生产 `ReviewSvgAssets`，同一 10 种输入均正确显示、没有未发布证据按钮；正文和 Review 中均无 script/img/iframe 元素，无脚本执行、无外部请求、`pageErrors=[]`。最终有效报告 **`910-root-native-ui-confirmed/report.json`，20/20 展示项通过，exit 0**；正文 CDATA、实体标题与 Review 预览三张截图已实际查看。此项只验收预览，没有点击批准或写正式库。
- `910-legacy-caption-probe.mts`：**351 张既有图**的图注与旧提取结果相同，YAML/SVG/渲染 SHA 与 894 实施前基线完全一致，`problems=[] failed=[]`，exit 0。
- 下一段依赖预核：`910-native-review-baseline.mts 910-native-review-valid-raw.json` 使用实际 raw 快照及默认批准校验（无 `validate` 绕过），在独立库 `910-native-review-MyC0DA` 组装页面+原生SVG+YAML。SVG 写入后受控中断，保持 `publishing`；再次批准恢复为 `published`，三份内容字节精确、`validateIntegration=[]`。这只是现有发布机制验证，不能替代尚未接通的 Drop caller 或四类真实问答 E2E。

探针修正如实记录：第一次 `910-root-native-ui-green/report.json` 在 BOM 案例的“期望值”计算上直接把文件 BOM 传入字符串 DOMParser，得到空值，实际产品已正确显示。修正 oracle 为先去文件 BOM 后解析，另写上述 confirmed，不覆盖首份记录。另一份 `910-native-review-baseline.json` 因夹具只有 example.invalid 来源被正常 source-domain 门禁拒绝，保持 pending/零写入；补充可核验的隔离 raw 后通过。二者均不计作产品缺陷或产品先红证据。

## 917 最终回执补验

- `server/snapshot.ts:47` 的生产实现指纹纳入 `scripts/wiki/native-svg.ts` 与 `src/content/wiki/diagram-sanitize.ts`，新进程不会复用旧校验器生产的磁盘缓存；`server/snapshot.ts:193` 对 `.yaml` / `.svg` 诊断均提取同一图 ID。维持既有 reader `skip` 与 chat `reject` 两种政策；**含坏图的静态阅读构建可以成功且跳过相关页面**，不把整次 Vite 构建失败作为新要求。
- `scripts/wiki/diagram-sanitize.test.ts:209` 的新增断言覆盖 title 属性、注释诱饵和 CDATA/普通实体单次解码。真实 XML 行为已由前述 Chromium 验证；该测试中的 parse5 替身不能单独证明严格 XML 语法正确。
- root 实跑 `vitest run server/snapshot-shared.test.ts server/snapshot-diagram.test.ts server/reader-skip.test.ts scripts/wiki/diagram-sanitize.test.ts --reporter=dot`：**4 文件 / 13 测试 passed，exit 0**；日志 `917-root-snapshot-supplement-tests.log`。两新增披露文件 `biome check` 无提示，实际 SHA 与 917 一致。先前全仓 TypeScript 已在同组生产代码上通过，本次没有新增生产修改。
- `917-root-cache-probe.mts` 在独立 `917-native-cache-2OGHrT` 创建可核验 raw 来源、健康页与原生图页，真实新进程逐步读写快照：初始原生图可见；校验指纹含两个新生产模块；人为植入摘要合法但生产指纹过时且正文被标记污染的**隔离缓存**，新进程丢弃并重建；破坏 SVG 后 reader 只跳过依赖页而保留健康页，chat 拒绝，reader 缓存不能提升为合法问答快照。报告 `917-root-cache-green.json` **9/9 true，exit 0**。没有改写项目生产文件或原 210 缓存。

## 边界与下一棒

本轮只审共同图契约、只读加载、CLI、XML/文本及必要调用方类型窄化。`stageDropDiagram` 对 native 的显式拒绝是下一段尚未实现的入口，不是完整原生通道已交付的证明。后续必须接通 generated/edited/section 共用资源输入、同名 SVG 纯数据传递、坏资源拒绝、整组 Review/恢复发布及真实页面/图 pin 浏览器闭环；再进入人工静态注册 React 2D。全部 3D、正式 wiki、原 210 缓存、旧 888 Review 和现有服务未被本轮探针写入。付费模型调用 0。无需用户再次批准。
