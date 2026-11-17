# 045 原生 SVG 共同入口第 1 轮：独立复审

结论：**Changes Requested，0 P1 / 2 P2**。已有 20 例配套/安全验收与 75 项回归通过，但新发现 XML 声明及 CDATA 在 Node 与实际浏览器间不一致，必须在本任务闭合后再接 Drop 第 2 轮。

接受来源：`0001794841791516-000902-52646371`；补充反例：904；作者交付：`0001794843032723-000907-e0d34fc4`。Task：`0001794686458967-000045-b7a20aea`。检视者：砚砚 / gpt-6-astra。HEAD `f44c953f99e416b2dc174c3b2ad31a729b91d30f`，未提交字节如下。

## 审定对象

| 文件 | SHA-256 |
| --- | --- |
| `scripts/wiki/native-svg.ts` | `807c66e22468d87810ce5bf0ce5ddde07a57a75d3a373894df5ff50d107ae9d2` |
| `scripts/wiki/diagrams.ts` | `7eea49adc5221a6c52475a109b96e261e68307bcfdc7075677ad233a7a0ae344` |
| `scripts/wiki-diagrams.ts` | `87a0a8e2c9cfcc6cf499f6a0c9752b0ea700780c112c42565b55673afe020bb3` |
| `scripts/wiki/drop-assets.ts` | `121314477f358e766edd07c1ce64ef9c710ae6d83620471ff212f160d40f6212` |
| `scripts/wiki/diagrams.test.ts` | `0bfb4f28e716ceeda0e12db48e691b7af4b40e82eb28a2fbd34c74a03301f4b8` |
| `scripts/wiki/diagram-cli.test.ts` | `fc33c70f5795639022148d99df3b72dede61778c39aef124b056316dc9790f89` |
| `scripts/wiki/figure.test.ts` | `c87d1f4a5499abc900e24930f957427be803486e15ae5a49d8a263636fe6f8a2` |

## P2-1：XML 语法入口仍与浏览器不一致

位置：`scripts/wiki/native-svg.ts:108`、`:161`。

声明分支只搜索 `?>` 然后跳过整段，没有校验内容。以下四种损坏声明均得到 `validateNativeSvg=[]`、`wiki-diagrams --check` exit 0，但真实 Chromium XML 解析报错，`sanitizeDiagram` 返回 null：

```xml
<?xml garbage?>
<?xml version="9.9"?>
<?xml encoding="UTF-8"?>
<?xml version="1.0" version="1.0"?>
```

在正常 SVG 前添加上述声明即可复现。隔离真实 Vite 构建同样成功，实际正文却显示「这张图没能渲染」。因此这不是仅限解析器的理论差异。

同一入口还有相反方向的误拒：合法属性 `viewBox="0 0\n600 240"` 在 Chromium XML 中会将字面换行正规化为空格，正常渲染；本实现未做 XML 属性空白正规化，直接交给 `allowedAttribute` 导致拒绝，CLI exit 1。修复需同时覆盖声明语法及受支持 XML 子集的属性值语义，保留合法声明、BOM、注释及实体规则；不要以拒绝全部声明或静默重写 SVG 绕过，也不要放宽共用安全属性表。字符引用所代表的空白与字面属性空白要按实际 XML 语义区分。

## P2-2：已接纳的 CDATA 正文被清洗掉，图注暴露标记

位置：`scripts/wiki/native-svg.ts` 的 CDATA 接纳分支；共同读者入口 `src/content/wiki/diagram-sanitize.ts:213`、`:276`。

Node 校验器和真实 Chromium 都接受以下合法 SVG 内容，但 `clean()` 只保留 nodeType=3，直接丢弃 CDATA 的 nodeType=4；`captionOf()` 又对 title 内串做正则截取，返回 CDATA 包装本身：

```xml
<text ...><![CDATA[score = q < k && raw]]></text>
<text ...>before <![CDATA[a < b]]> after</text>
<title><![CDATA[Q < K & V]]></title>
```

实际正式阅读组件结果分别为：图上文字为空；混合文字丢失 `a < b`；SVG title 为空、figcaption 显示 `<![CDATA[Q < K & V]]>`。正式与 Review 共用同一清洗器，均受影响。请在共用入口将 CDATA 安全地作为文本保留，标题按真实文本语义提取；不得当 HTML 拼接，不重复解码实体，也不通过禁止合法 CDATA 降低原生通道目标。补上混合文本、CDATA 内 `<script>` 字面值不执行、普通 `&amp;lt;` 单次解码的回归。

同根补充（910 返修轮内）：`910-native-xml-title-red.json` 增加三项实测。`<title id="caption-title">XML 原生文本</title>` 得到空 caption；注释内放 `<title>COMMENT_ONLY</title>` 后再放真实 title，caption 错选注释内容；`<title><![CDATA[&lt;literal&gt;]]> &amp;lt;</title>` 的真实 XML 文本为 `&lt;literal&gt; &lt;`，当前 caption 却重复解码 CDATA 并带包装。这三项均在 Node/CLI 与 Chromium 被接纳，属于相同的标题正则提取根因，合并在 P2-2 一次修复，不另增问题或短批。

## Root 实际验证

所有临时路径均以 `%TEMP%/infra-wiki-review-20261115/` 为根，未修改作者生产代码。

1. `node node_modules/vitest/vitest.mjs run scripts/wiki/diagrams.test.ts scripts/wiki/diagram-cli.test.ts server/snapshot-diagram.test.ts scripts/wiki/figure.test.ts scripts/wiki/diagram-audit.test.ts scripts/wiki/diagram-sanitize.test.ts scripts/wiki/drop-assets.test.ts src/content/wiki/WikiDiagram.test.ts --reporter=dot`：**8 files / 75 tests passed，exit 0**，`907-root-tests.log`。这些用例没有覆盖上面新发现的声明和 CDATA。
2. `902-native-acceptance-cases.mts --cli 907-root-native-acceptance-green.json`：**20/20 原约定场景满足预期**，合法 CLI 连续运行字节不变，19 类负例拒绝；原 baseline 与作者 green 均保留。
3. `907-native-xml-semantics-probe.mts 907-native-xml-semantics-expanded-red.json`：9 组输入逐一实际调用 Node 校验、CLI、Chromium DOMParser 与当前生产 sanitizer。四类非法声明漏放；合法属性折行误拒；三类 CDATA 显示/标题丢失。原始 8 组报告 `907-native-xml-semantics-red.json` 亦保留。
4. `907-native-ui-red-build.mts`：**真实 Vite 构建 exit 0**，独立目录 `907-native-ui-wt7fji/dist`。`907-native-ui-browser.mjs` 在 `/nested/`、1440×900、API 全中止下实际打开正文：非法声明图为 `wiki-diagram-failed`；CDATA 文本图 `data-status=ok` 但 text 为空；CDATA 标题图的 figcaption 原样显示包装标记。报告 `907-native-ui-red/report.json`，三张截图落盘，其中非法声明与 CDATA 标题截图已实际查看。`pageErrors=[]` 不代表这些内容显示正确。
5. `907-native-xml-semantics-probe.mts 910-native-xml-title-red.json`：扩至 12 组输入，保留前述全部红灯，另实证标题属性、注释干扰及 CDATA/普通实体混合三种同根失败；CLI 与浏览器均已实际执行。

临时 HTTP / Chromium 均在 finally 关闭，测试和构建句柄已退出。正式 wiki、3D/仿真、210 缓存、旧 888 Review 与既有端口保持原状。模型付费调用为 0。

## 返修边界

沿原 045 由原作者在一短轮收口上述共同入口与必要测试，保留现有正向属性表、CLI 原字节纪律及旧图兼容。本轮 Drop 新输出仍未接入属于已明确的下一段工作，不把它列作本段缺陷；不要在返修里叠加 React 2D 或其他主线。root 复跑原红灯与最小相关回归后给独立复审结果。无需用户重新批准。
